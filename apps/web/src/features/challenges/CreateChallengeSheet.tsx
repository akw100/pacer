import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '../../components/drawer';
import { toast } from 'sonner';
import { X, ChevronLeft, User, Users, Globe } from 'lucide-react';
import {
  CHALLENGE_METRICS,
  CHALLENGE_TEMPLATES,
  CreateChallengeInputSchema,
  displayDistanceToMeters,
  normalizeYouTubeUrl,
  type ChallengeAudience,
  type ChallengeMetric,
  type ChallengeTemplate,
  type CreateChallengeInput,
  type Group,
  type Units,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useCreateChallenge } from './useChallenges';
import { metricUnitSuffix, todayKey } from './format';

// 3-step challenge creation (spec §5 / §02-PAGES): Who → What → Preview. The
// metric catalog + templates come from @pacer/shared so this form, the API and
// the bot stay in lockstep. Distance targets are typed in the user's unit and
// converted to canonical meters on submit.

// Seed values for the form — used by "Challenge this group" and "Rematch".
// targetCanonical is meters for distance, raw count otherwise.
export interface ChallengePreset {
  audience?: ChallengeAudience;
  groupId?: string | null;
  metric?: ChallengeMetric;
  targetCanonical?: number;
  description?: string;
  youtubeUrl?: string | null;
}

interface CreateChallengeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: Units;
  /** Prefill the form (e.g. "Challenge this group" or a rematch of a finished one). */
  preset?: ChallengePreset | null;
}

type Step = 0 | 1 | 2;

function canonicalToInput(value: number, metric: ChallengeMetric, units: Units): string {
  if (CHALLENGE_METRICS[metric].unit === 'meters') {
    const v = units === 'km' ? value / 1000 : value / 1609.344;
    return String(Math.round(v));
  }
  return String(value);
}

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CreateChallengeSheet({ open, onOpenChange, units, preset }: CreateChallengeSheetProps) {
  const token = useAuth().session?.access_token ?? null;
  const create = useCreateChallenge();

  const [step, setStep] = useState<Step>(0);
  const [audience, setAudience] = useState<ChallengeAudience>('everyone');
  const [targetHandle, setTargetHandle] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [metric, setMetric] = useState<ChallengeMetric>('distance');
  const [targetInput, setTargetInput] = useState('');
  const [start, setStart] = useState(todayKey());
  const [end, setEnd] = useState(addDays(todayKey(), 7));
  const [description, setDescription] = useState('');
  const [youtube, setYoutube] = useState('');

  const groupsQuery = useQuery<Array<Group & { member_count: number }>>({
    queryKey: ['groups', 'mine'],
    queryFn: () => apiFetch('/groups', { token: token! }),
    enabled: !!token && open,
  });

  const meta = CHALLENGE_METRICS[metric];

  function reset() {
    setStep(0);
    setAudience(preset?.audience ?? (preset?.groupId ? 'group' : 'everyone'));
    setTargetHandle('');
    setGroupId(preset?.groupId ?? null);
    setMetric(preset?.metric ?? 'distance');
    setTargetInput(
      preset?.targetCanonical != null ? canonicalToInput(preset.targetCanonical, preset.metric ?? 'distance', units) : '',
    );
    setStart(todayKey());
    setEnd(addDays(todayKey(), 7));
    setDescription(preset?.description ?? '');
    setYoutube(preset?.youtubeUrl ?? '');
  }

  // Apply the preset whenever the sheet opens (it stays mounted between uses).
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function applyTemplate(t: ChallengeTemplate) {
    setMetric(t.metric);
    setStart(todayKey());
    setEnd(addDays(todayKey(), t.days));
    setDescription(t.description ?? '');
    // Distance template targets are meters → show in the user's unit.
    if (CHALLENGE_METRICS[t.metric].unit === 'meters') {
      const v = units === 'km' ? t.target / 1000 : t.target / 1609.344;
      setTargetInput(String(Math.round(v)));
    } else {
      setTargetInput(String(t.target));
    }
  }

  // Build the canonical target (meters for distance, raw otherwise).
  const targetCanonical = useMemo(() => {
    const n = Number(targetInput);
    if (!Number.isFinite(n) || n <= 0) return null;
    return meta.unit === 'meters' ? Math.round(displayDistanceToMeters(n, units)) : n;
  }, [targetInput, meta.unit, units]);

  function buildInput(): CreateChallengeInput | null {
    if (targetCanonical === null) return null;
    const raw = {
      audience,
      metric,
      target: targetCanonical,
      start_date: start,
      end_date: end,
      description: description.trim() || undefined,
      youtube_url: youtube.trim() ? (normalizeYouTubeUrl(youtube.trim()) ?? undefined) : undefined,
      target_handle: audience === 'user' ? targetHandle.trim().toLowerCase() || undefined : undefined,
      group_id: audience === 'group' ? groupId ?? undefined : undefined,
    };
    const parsed = CreateChallengeInputSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  function canAdvanceWho(): boolean {
    if (audience === 'user') return targetHandle.trim().length >= 3;
    if (audience === 'group') return !!groupId;
    return true;
  }

  function canAdvanceWhat(): boolean {
    if (targetCanonical === null) return false;
    if (youtube.trim() && !normalizeYouTubeUrl(youtube.trim())) return false;
    return end >= start;
  }

  async function submit() {
    const input = buildInput();
    if (!input) return toast.error('Some details are missing or invalid');
    try {
      await create.mutateAsync(input);
      toast.success('Challenge sent! 🏁');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create challenge');
    }
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-card border border-border bg-surface md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
        >
          <Drawer.Title className="sr-only">Create a challenge</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-10 rounded-pill bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pt-2 pb-3">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  aria-label="Back"
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
                >
                  <ChevronLeft size={18} strokeWidth={1.8} />
                </button>
              )}
              <h2 className="font-display text-lg font-semibold text-ink">
                {step === 0 ? 'Who' : step === 1 ? 'What' : 'Confirm'}
              </h2>
            </div>
            <button
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className="px-5 pb-5 flex flex-col gap-4 overflow-y-auto">
            <StepDots step={step} />

            {step === 0 && (
              <WhoStep
                audience={audience}
                setAudience={setAudience}
                targetHandle={targetHandle}
                setTargetHandle={setTargetHandle}
                groupId={groupId}
                setGroupId={setGroupId}
                groups={groupsQuery.data ?? []}
              />
            )}

            {step === 1 && (
              <WhatStep
                units={units}
                metric={metric}
                setMetric={setMetric}
                targetInput={targetInput}
                setTargetInput={setTargetInput}
                start={start}
                setStart={setStart}
                end={end}
                setEnd={setEnd}
                description={description}
                setDescription={setDescription}
                youtube={youtube}
                setYoutube={setYoutube}
                onTemplate={applyTemplate}
              />
            )}

            {step === 2 && (
              <PreviewStep
                units={units}
                audience={audience}
                targetHandle={targetHandle}
                groups={groupsQuery.data ?? []}
                groupId={groupId}
                metric={metric}
                target={targetCanonical}
                start={start}
                end={end}
                description={description}
                youtube={youtube}
              />
            )}

            {step < 2 ? (
              <button
                type="button"
                disabled={step === 0 ? !canAdvanceWho() : !canAdvanceWhat()}
                onClick={() => setStep((s) => (s + 1) as Step)}
                className="rounded-pill bg-accent text-white py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-transform"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={create.isPending}
                onClick={submit}
                className="rounded-pill bg-accent text-white py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-transform"
              >
                {create.isPending ? 'Sending…' : 'Send challenge'}
              </button>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-pill ${i <= step ? 'bg-accent' : 'bg-ink/10'}`} />
      ))}
    </div>
  );
}

function WhoStep({
  audience,
  setAudience,
  targetHandle,
  setTargetHandle,
  groupId,
  setGroupId,
  groups,
}: {
  audience: ChallengeAudience;
  setAudience: (a: ChallengeAudience) => void;
  targetHandle: string;
  setTargetHandle: (s: string) => void;
  groupId: string | null;
  setGroupId: (s: string | null) => void;
  groups: Array<Group & { member_count: number }>;
}) {
  const options: Array<{ id: ChallengeAudience; label: string; hint: string; icon: React.ReactNode }> = [
    { id: 'user', label: 'A person', hint: 'Challenge someone by handle', icon: <User size={18} strokeWidth={1.8} /> },
    { id: 'group', label: 'A group', hint: 'Invite all members at once', icon: <Users size={18} strokeWidth={1.8} /> },
    { id: 'everyone', label: 'Everyone', hint: 'Open — anyone can join', icon: <Globe size={18} strokeWidth={1.8} /> },
  ];
  return (
    <div className="flex flex-col gap-3">
      {options.map((o) => {
        const active = audience === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setAudience(o.id)}
            className={`flex items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${
              active ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:bg-ink/5'
            }`}
          >
            <span className={`grid place-items-center w-9 h-9 rounded-pill ${active ? 'bg-accent/15 text-accent' : 'bg-ink/5 text-ink-muted'}`}>
              {o.icon}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">{o.label}</span>
              <span className="block text-xs text-ink-muted">{o.hint}</span>
            </span>
          </button>
        );
      })}

      {audience === 'user' && (
        <label className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-ink-muted">Their handle</span>
          <div className="flex items-center gap-1">
            <span className="text-ink-muted">@</span>
            <input
              value={targetHandle}
              onChange={(e) => setTargetHandle(e.target.value)}
              placeholder="dana"
              autoFocus
              className="bg-transparent w-full text-ink text-base focus:outline-none placeholder:text-ink-muted/50"
            />
          </div>
        </label>
      )}

      {audience === 'group' && (
        <div className="flex flex-col gap-2">
          {groups.length === 0 ? (
            <p className="text-sm text-ink-muted">You're not in any group yet. Join or create one first.</p>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className={`flex items-center justify-between rounded-card border px-4 py-2.5 text-left transition-colors ${
                  groupId === g.id ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:bg-ink/5'
                }`}
              >
                <span className="text-sm font-medium text-ink">{g.name}</span>
                <span className="text-xs text-ink-muted">{g.member_count} members</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function WhatStep({
  units,
  metric,
  setMetric,
  targetInput,
  setTargetInput,
  start,
  setStart,
  end,
  setEnd,
  description,
  setDescription,
  youtube,
  setYoutube,
  onTemplate,
}: {
  units: Units;
  metric: ChallengeMetric;
  setMetric: (m: ChallengeMetric) => void;
  targetInput: string;
  setTargetInput: (s: string) => void;
  start: string;
  setStart: (s: string) => void;
  end: string;
  setEnd: (s: string) => void;
  description: string;
  setDescription: (s: string) => void;
  youtube: string;
  setYoutube: (s: string) => void;
  onTemplate: (t: ChallengeTemplate) => void;
}) {
  const metrics = Object.keys(CHALLENGE_METRICS) as ChallengeMetric[];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Quick templates</span>
        <div className="flex flex-wrap gap-1.5">
          {CHALLENGE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTemplate(t)}
              className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5"
            >
              {t.emoji} {t.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Metric</span>
        <div className="flex flex-wrap gap-1.5">
          {metrics.map((m) => {
            const active = metric === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? 'bg-ink text-surface' : 'border border-border text-ink-muted hover:text-ink'
                }`}
              >
                {CHALLENGE_METRICS[m].label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-ink-muted">
          Target ({metricUnitSuffix(metric, units)})
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          placeholder="30"
          className="bg-transparent w-full text-ink text-base focus:outline-none placeholder:text-ink-muted/50"
        />
      </label>

      <div className="flex gap-2">
        <label className="flex-1 flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-ink-muted">Start</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-transparent text-ink text-sm focus:outline-none" />
        </label>
        <label className="flex-1 flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-ink-muted">End</span>
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="bg-transparent text-ink text-sm focus:outline-none" />
        </label>
      </div>

      <label className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Description (optional)</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="50 push-ups a day for a week"
          className="bg-transparent w-full text-ink text-sm focus:outline-none resize-none placeholder:text-ink-muted/50"
        />
      </label>

      <label className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-ink-muted">YouTube link (optional)</span>
        <input
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          placeholder="https://youtu.be/…"
          className="bg-transparent w-full text-ink text-sm focus:outline-none placeholder:text-ink-muted/50"
        />
        {youtube.trim() && !normalizeYouTubeUrl(youtube.trim()) && (
          <span className="text-xs text-accent">That doesn't look like a YouTube video link.</span>
        )}
      </label>
    </div>
  );
}

function PreviewStep({
  units,
  audience,
  targetHandle,
  groups,
  groupId,
  metric,
  target,
  start,
  end,
  description,
  youtube,
}: {
  units: Units;
  audience: ChallengeAudience;
  targetHandle: string;
  groups: Array<Group & { member_count: number }>;
  groupId: string | null;
  metric: ChallengeMetric;
  target: number | null;
  start: string;
  end: string;
  description: string;
  youtube: string;
}) {
  const meta = CHALLENGE_METRICS[metric];
  const targetLabel =
    target === null
      ? '—'
      : meta.unit === 'meters'
        ? `${units === 'km' ? (target / 1000).toFixed(1) : (target / 1609.344).toFixed(1)} ${units}`
        : `${target} ${metricUnitSuffix(metric, units)}`;
  const who =
    audience === 'user'
      ? `@${targetHandle}`
      : audience === 'group'
        ? (groups.find((g) => g.id === groupId)?.name ?? 'your group')
        : 'everyone';

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div>
        <h3 className="font-display text-base font-semibold text-ink">
          {meta.label} · {targetLabel}
        </h3>
        <p className="text-xs text-ink-muted">Challenging {who}</p>
      </div>
      <p className="text-xs text-ink-muted">
        {start} → {end}
      </p>
      {description.trim() && <p className="text-sm text-ink">{description.trim()}</p>}
      {youtube.trim() && normalizeYouTubeUrl(youtube.trim()) && (
        <p className="text-xs text-ink-muted">📺 Video attached</p>
      )}
      <p className="text-xs text-ink-muted leading-relaxed">
        {audience === 'everyone'
          ? "Anyone can join this challenge once it's live."
          : audience === 'group'
            ? 'All current group members will be invited.'
            : 'They’ll get an invitation to accept or decline.'}
      </p>
    </div>
  );
}
