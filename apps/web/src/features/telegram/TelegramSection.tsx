import { useState } from 'react';
import { Send, Check, RefreshCw, Copy } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

// "Telegram" connection block, rendered inside Profile.tsx. Mirrors the
// onboarding StepTelegram flow but adds the connected/disconnect states so a
// user can link (or unlink) the bot any time, not just during onboarding.
//
// Backend seam: GET /telegram/status · POST /telegram/link-code · DELETE
// /telegram/link (all authed; the API scopes to the JWT's userId).

interface TelegramStatus {
  linked: boolean;
  telegram_username: string | null;
}
interface LinkCode {
  code: string;
  expires_at: string;
  // Built server-side from the bot's real username; null if the bot isn't
  // configured. Use this verbatim — never reconstruct it from a frontend env.
  deep_link: string | null;
}

const statusKey = ['telegram', 'status'] as const;

export function TelegramSection() {
  const token = useAuth().session?.access_token ?? null;
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error('Couldn’t copy — select the code and copy it manually.'),
    );
  }

  const status = useQuery<TelegramStatus>({
    queryKey: statusKey,
    queryFn: () => apiFetch<TelegramStatus>('/telegram/status', { token: token! }),
    enabled: !!token,
    staleTime: 30 * 1000,
  });

  const link = useMutation({
    mutationFn: () =>
      apiFetch<LinkCode>('/telegram/link-code', { token: token!, method: 'POST' }),
    onSuccess: (res) => {
      setCode(res.code);
      setDeepLink(res.deep_link);
    },
    onError: () => toast.error('Could not get a link code — try again.'),
  });

  const unlink = useMutation({
    mutationFn: () => apiFetch<void>('/telegram/link', { token: token!, method: 'DELETE' }),
    onSuccess: () => {
      setCode(null);
      setDeepLink(null);
      toast.success('Telegram disconnected.');
      void qc.invalidateQueries({ queryKey: statusKey });
    },
    onError: () => toast.error('Could not disconnect — try again.'),
  });

  return (
    <section
      aria-labelledby="telegram-heading"
      className="rounded-card border border-border bg-surface p-5 shadow-sm flex flex-col gap-4"
    >
      <header>
        <h2 id="telegram-heading" className="font-display text-lg font-semibold text-ink">
          Telegram
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          Log runs by texting the bot{' '}
          <span className="text-ink font-medium">“ran 5k in 28 min”</span> — or send a photo of
          your watch — without opening Pacer.
        </p>
      </header>

      {status.isLoading ? (
        <div className="h-12 rounded-card bg-ink/5 animate-pulse" />
      ) : status.isError ? (
        <div className="rounded-card border border-accent/30 bg-accent/5 p-3 text-sm text-ink-muted flex items-center justify-between gap-3">
          <span>Couldn’t load your Telegram status.</span>
          <button
            type="button"
            onClick={() => status.refetch()}
            className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-ink/5"
          >
            Retry
          </button>
        </div>
      ) : status.data?.linked ? (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
          <span className="grid place-items-center w-9 h-9 rounded-pill bg-accent/10 text-accent shrink-0">
            <Check size={16} strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink">Connected</div>
            <div className="text-xs text-ink-muted truncate">
              {status.data.telegram_username ? `@${status.data.telegram_username}` : 'Telegram account linked'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => unlink.mutate()}
            disabled={unlink.isPending}
            className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            {unlink.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : code ? (
        // Code issued — show it + the deep link, then let the user confirm back.
        <div className="rounded-card border border-accent/30 bg-accent/5 p-4 flex flex-col gap-3 items-center text-center">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-muted">Your link code</div>
            <div className="flex items-center justify-center gap-2">
              <span className="font-display text-2xl font-bold text-ink tracking-[0.3em]">{code}</span>
              <button
                type="button"
                onClick={copyCode}
                aria-label="Copy link code"
                className="grid place-items-center w-8 h-8 rounded-pill text-ink-muted hover:text-ink hover:bg-ink/5"
              >
                {copied ? (
                  <Check size={15} strokeWidth={2.2} className="text-accent" />
                ) : (
                  <Copy size={15} strokeWidth={1.9} />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Tap below, then send <span className="text-ink font-medium">/start {code}</span> to the
            bot. Come back and refresh once it replies “Linked!”.
          </p>
          <div className="flex items-center gap-2">
            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-pill bg-accent text-white px-4 py-2 text-sm font-semibold"
              >
                <Send size={15} strokeWidth={1.9} />
                Open Telegram
              </a>
            )}
            <button
              type="button"
              onClick={() => status.refetch()}
              disabled={status.isFetching}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              <RefreshCw size={14} strokeWidth={1.9} className={status.isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => link.mutate()}
          disabled={link.isPending}
          className="inline-flex items-center justify-center gap-2 self-start rounded-pill bg-accent text-white px-5 py-2.5 text-sm font-semibold shadow-sm shadow-accent/20 disabled:opacity-50"
        >
          <Send size={16} strokeWidth={1.8} />
          {link.isPending ? 'Generating…' : 'Connect Telegram'}
        </button>
      )}
    </section>
  );
}
