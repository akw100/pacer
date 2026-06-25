import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../auth/AuthProvider';

// Step 3: Telegram link explainer. Optional/skippable.
// If /telegram/link-code isn't merged yet (separate slice), the placeholder
// code reads "—" and the deep link button is disabled — the rest of the step
// still teaches the feature.

interface StepTelegramProps {
  onContinue: () => void;
  onSkip: () => void;
}

const BOT = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TELEGRAM_BOT ?? 'pacer_bot';

export function StepTelegram({ onContinue, onSkip }: StepTelegramProps) {
  const { session } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    apiFetch<{ code: string }>('/telegram/link-code', { token })
      .then((res) => {
        if (!cancelled) setCode(res.code);
      })
      .catch(() => {
        // Telegram slice may not be merged yet — fail quietly.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const deepLink = code ? `https://t.me/${BOT}?start=${code}` : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="font-display text-2xl font-bold text-ink">Log without opening Pacer</h2>
        <p className="mt-1 text-sm text-ink-muted leading-relaxed">
          Text the bot{' '}
          <span className="text-ink font-medium">"ran 5k in 30 min"</span> — or send a photo of
          your watch — and it logs itself.
        </p>
      </header>

      <div className="rounded-card border border-border bg-surface p-4 flex flex-col gap-3 items-center">
        <span className="grid place-items-center w-12 h-12 rounded-full bg-accent/10 text-accent">
          <Send size={20} strokeWidth={1.8} />
        </span>
        {loading ? (
          <div className="h-6 w-32 rounded bg-ink/10 animate-pulse" />
        ) : code ? (
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-ink-muted">Your link code</div>
            <div className="font-display text-2xl font-bold text-ink tracking-[0.3em]">{code}</div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted text-center">
            The Telegram bot will be wired up in a follow-up release.
          </p>
        )}
        {deepLink ? (
          <a
            href={deepLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-pill bg-accent text-white px-4 py-2 text-sm font-semibold"
          >
            Open Telegram
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-muted"
          >
            Open Telegram
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-pill bg-accent text-white py-3 text-sm font-semibold"
        >
          Next
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="self-center text-xs text-ink-muted hover:text-ink"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
