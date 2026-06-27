import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

// The routes the agent can jump to (mirrors App.tsx). Kept here so the model
// only ever navigates somewhere real.
const ROUTES: Record<string, string> = {
  home: '/',
  progress: '/progress',
  group: '/group',
  challenges: '/challenges',
  flows: '/flows',
  profile: '/profile',
}

// ── DOM helpers: the agent acts on the live page the user is looking at ──────

function isVisible(el: Element): boolean {
  const h = el as HTMLElement
  return !!(h.offsetParent || h.getClientRects().length) && getComputedStyle(h).visibility !== 'hidden'
}

function labelOf(el: Element): string {
  const h = el as HTMLElement
  const aria = h.getAttribute('aria-label')
  if (aria) return aria
  const text = (h.innerText || h.textContent || '').trim()
  if (text) return text
  return (
    h.getAttribute('title') ||
    h.getAttribute('placeholder') ||
    (h as HTMLInputElement).value ||
    h.getAttribute('name') ||
    ''
  )
}

// Score how well a candidate's label matches the spoken target. Higher = better;
// 0 = no match. Forgiving on purpose — speech is fuzzy.
function score(label: string, target: string): number {
  const a = label.toLowerCase().trim()
  const b = target.toLowerCase().trim()
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.startsWith(b) || b.startsWith(a)) return 80
  if (a.includes(b) || b.includes(a)) return 60
  const at = new Set(a.split(/\W+/).filter(Boolean))
  const bt = b.split(/\W+/).filter(Boolean)
  const overlap = bt.filter((t) => at.has(t)).length
  return overlap ? 20 + overlap : 0
}

// ponytail: matches elements by accessible label/text only — an icon-only
// button with no aria-label is invisible to it. Add a coordinate/vision tool
// if that becomes a real gap.
function bestMatch(els: Element[], target: string): Element | null {
  let best: Element | null = null
  let bestScore = 0
  for (const el of els) {
    if (!isVisible(el)) continue
    const s = score(labelOf(el), target)
    if (s > bestScore) {
      bestScore = s
      best = el
    }
  }
  return bestScore >= 20 ? best : null
}

const CLICKABLE =
  'button, a[href], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], input[type="submit"], input[type="button"], summary, label[for]'

const FIELD = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select, [contenteditable=""], [contenteditable="true"]'

// Field label: prefer the associated <label>, then aria/placeholder/name.
function fieldLabel(el: Element): string {
  const labels = (el as HTMLInputElement).labels
  if (labels?.[0]) return labels[0].innerText.trim()
  const h = el as HTMLElement
  return (
    h.getAttribute('aria-label') ||
    h.getAttribute('placeholder') ||
    h.getAttribute('name') ||
    h.getAttribute('id') ||
    ''
  )
}

// React tracks input state via the native value setter; calling it directly +
// dispatching input/change is what makes controlled inputs actually update.
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// A compact snapshot of the screen so the model knows what it can act on.
function readPage() {
  const grab = (sel: string, max: number) =>
    Array.from(document.querySelectorAll(sel))
      .filter(isVisible)
      .map((el) => labelOf(el).slice(0, 80))
      .filter(Boolean)
      .slice(0, max)

  const fields = Array.from(document.querySelectorAll(FIELD))
    .filter(isVisible)
    .map((el) => {
      const label = fieldLabel(el).slice(0, 60)
      const value = (el as HTMLInputElement).value ?? (el as HTMLElement).innerText ?? ''
      return { label, value: String(value).slice(0, 60) }
    })
    .filter((f) => f.label)
    .slice(0, 30)

  return {
    url: location.pathname,
    title: document.title,
    headings: grab('h1, h2, h3', 20),
    buttons: grab(CLICKABLE, 40),
    fields,
  }
}

const INSTRUCTIONS = `You are Pacer's hands-free voice assistant. Pacer is a fitness-tracking app.
You can SEE and OPERATE the page the user is on, on their behalf, using the provided tools.

Routes you can navigate to: home, progress, group, challenges, flows, profile.
There is a "+" button to log an activity (a run or workout) on most screens.

How to work:
- When unsure what's on screen, call read_page first — it returns the current URL, headings, buttons, and form fields.
- To move around the app, use navigate. To press something, use click with its visible label. To type into a field, use fill with the field's label and the text.
- Chain tools as needed: e.g. open the log sheet, then fill the distance, then save.
- After acting, briefly say what you did. Keep spoken replies to one short sentence.
- Confirm out loud before anything destructive (deleting, leaving a group). Never invent data — ask the user for values you don't have.
Speak naturally and concisely. You are talking while doing.`

// Spoken the moment a session connects, so the user knows the agent is listening
// and what it can do. Phrased as a prompt (not a fixed string) so it sounds natural.
const GREETING = `Open the conversation now: in one warm, short sentence, greet the user as Pacer's voice assistant and mention you can move around the app, log workouts, and fill things in for them. Then stop and listen.`

// Realtime uses the FLAT function-tool shape (name/description/parameters at top level).
const TOOLS = [
  {
    type: 'function',
    name: 'read_page',
    description: 'Read the current screen: URL, headings, clickable labels, and form fields with their values. Use to orient before acting.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'navigate',
    description: 'Go to a top-level screen of the app.',
    parameters: {
      type: 'object',
      properties: { page: { type: 'string', enum: Object.keys(ROUTES) } },
      required: ['page'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'click',
    description: 'Click a button, link, tab, or toggle by its visible text or label.',
    parameters: {
      type: 'object',
      properties: { target: { type: 'string', description: 'Visible text/label of the element to click.' } },
      required: ['target'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'fill',
    description: 'Type a value into a form field identified by its label, placeholder, or name. Use for pasting/entering data.',
    parameters: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Label/placeholder/name of the field.' },
        value: { type: 'string', description: 'Text to enter.' },
      },
      required: ['field', 'value'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'scroll',
    description: 'Scroll the page.',
    parameters: {
      type: 'object',
      properties: { to: { type: 'string', enum: ['top', 'bottom', 'up', 'down'] } },
      required: ['to'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'go_back',
    description: 'Go back to the previous screen.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const

export type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error'

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const navRef = useRef(navigate)
  navRef.current = navigate
  const { session } = useAuth()
  const tokenRef = useRef(session?.access_token)
  tokenRef.current = session?.access_token

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const callNames = useRef(new Map<string, string>())

  const send = (obj: unknown) => {
    const dc = dcRef.current
    if (dc?.readyState === 'open') dc.send(JSON.stringify(obj))
  }

  // Execute one tool against the live DOM and return a serializable result.
  const runTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    switch (name) {
      case 'read_page':
        return readPage()
      case 'navigate': {
        const path = ROUTES[String(args.page)]
        if (!path) return { ok: false, error: `unknown page "${args.page}"` }
        navRef.current(path)
        return { ok: true, url: path }
      }
      case 'click': {
        const el = bestMatch(Array.from(document.querySelectorAll(CLICKABLE)), String(args.target))
        if (!el) return { ok: false, error: `no clickable element matching "${args.target}"` }
        ;(el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
        ;(el as HTMLElement).click()
        return { ok: true, clicked: labelOf(el) }
      }
      case 'fill': {
        const el = bestMatch(Array.from(document.querySelectorAll(FIELD)), String(args.field))
        if (!el) return { ok: false, error: `no field matching "${args.field}"` }
        ;(el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
        ;(el as HTMLElement).focus()
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          setNativeValue(el, String(args.value))
        } else if (el instanceof HTMLSelectElement) {
          setNativeValue(el as unknown as HTMLInputElement, String(args.value))
        } else {
          ;(el as HTMLElement).innerText = String(args.value)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        return { ok: true, field: fieldLabel(el) }
      }
      case 'scroll': {
        const to = String(args.to)
        if (to === 'top') scrollTo({ top: 0, behavior: 'smooth' })
        else if (to === 'bottom') scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        else scrollBy({ top: to === 'up' ? -innerHeight * 0.8 : innerHeight * 0.8, behavior: 'smooth' })
        return { ok: true }
      }
      case 'go_back':
        history.back()
        return { ok: true }
      default:
        return { ok: false, error: `unknown tool "${name}"` }
    }
  }, [])

  const disconnect = useCallback(() => {
    dcRef.current?.close()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    pcRef.current?.close()
    if (audioRef.current) audioRef.current.srcObject = null
    dcRef.current = null
    streamRef.current = null
    pcRef.current = null
    callNames.current.clear()
    setStatus('idle')
  }, [])

  const connect = useCallback(async () => {
    if (status === 'connecting' || status === 'live') return
    setError(null)
    setStatus('connecting')
    try {
      const token = tokenRef.current
      if (!token) throw new Error('You need to be signed in.')

      const r = await fetch(`${API_URL}/voice/session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error('Could not start a voice session.')
      const { token: ephemeral } = (await r.json()) as { token: string }

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const audio = new Audio()
      audio.autoplay = true
      audioRef.current = audio
      pc.ontrack = (e) => {
        if (e.streams[0]) audio.srcObject = e.streams[0]
      }
      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) disconnect()
      }

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = mic
      mic.getTracks().forEach((t) => pc.addTrack(t, mic))

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onopen = () => {
        send({
          type: 'session.update',
          session: { type: 'realtime', instructions: INSTRUCTIONS, tools: TOOLS, tool_choice: 'auto' },
        })
        // Greet first so the user hears the agent come alive.
        send({ type: 'response.create', response: { instructions: GREETING } })
        setStatus('live')
      }
      dc.onmessage = (ev) => {
        let msg: { type?: string; item?: { type?: string; name?: string; call_id?: string }; name?: string; call_id?: string; arguments?: string; error?: unknown }
        try {
          msg = JSON.parse(ev.data)
        } catch {
          return
        }
        if (msg.type === 'error') {
          console.warn('[voice] realtime error', msg.error)
          return
        }
        // Remember each function call's name so we can act when its args finish.
        if (msg.type === 'response.output_item.added' && msg.item?.type === 'function_call') {
          callNames.current.set(msg.item.call_id!, msg.item.name!)
        }
        if (msg.type === 'response.function_call_arguments.done') {
          const name = msg.name ?? callNames.current.get(msg.call_id!)
          if (!name) return
          let parsed: Record<string, unknown> = {}
          try {
            parsed = JSON.parse(msg.arguments || '{}')
          } catch {
            /* keep empty args */
          }
          runTool(name, parsed)
            .catch((e) => ({ ok: false, error: String(e?.message ?? e) }))
            .then((result) => {
              send({
                type: 'conversation.item.create',
                item: { type: 'function_call_output', call_id: msg.call_id, output: JSON.stringify(result) },
              })
              send({ type: 'response.create' })
            })
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${ephemeral}`, 'Content-Type': 'application/sdp' },
      })
      if (!sdpRes.ok) throw new Error('Voice connection failed.')
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() })
    } catch (e) {
      const err = e as Error
      setError(err.name === 'NotAllowedError' ? 'Microphone access denied.' : err.message)
      setStatus('error')
      disconnect()
      setStatus('error')
    }
  }, [status, disconnect, runTool])

  const toggle = useCallback(() => {
    if (status === 'live' || status === 'connecting') disconnect()
    else connect()
  }, [status, connect, disconnect])

  return { status, error, toggle, connect, disconnect }
}
