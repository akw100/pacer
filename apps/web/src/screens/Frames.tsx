import { useState } from 'react';
import { Loader2, Play, Trash2, AlertCircle, ExternalLink } from 'lucide-react';
import type { VideoRoutine } from '@pacer/shared';
import { Button } from '../components/Button';
import { EmptyState } from '../features/video-frames/EmptyState';
import { RoutineCarousel } from '../features/video-frames/RoutineCarousel';
import {
  useCreateVideoRoutine,
  useDeleteVideoRoutine,
  useVideoRoutines,
} from '../features/video-frames/useVideoRoutines';

export default function Frames() {
  const { data: routines = [], isLoading } = useVideoRoutines();
  const create = useCreateVideoRoutine();
  const del = useDeleteVideoRoutine();
  const [url, setUrl] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const anyProcessing = routines.some((r) => r.status === 'processing');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    create.mutate(value, { onSuccess: () => setUrl('') });
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="font-display text-2xl font-bold text-ink">Workout Flows</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Turn a YouTube workout into a step-through routine.
      </p>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube video URL"
          className="min-w-0 flex-1 rounded-pill border border-border bg-panel px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent"
        />
        <Button type="submit" disabled={create.isPending || anyProcessing || !url.trim()}>
          {create.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
        </Button>
      </form>
      {create.isError && (
        <p className="mt-2 text-sm text-accent">
          Couldn’t start — check the URL is a YouTube video and try again.
        </p>
      )}
      {anyProcessing && (
        <p className="mt-2 text-xs text-ink-muted">
          Processing a video — this can take a couple of minutes.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : routines.length === 0 ? (
          <EmptyState />
        ) : (
          routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              onOpen={() => setOpenId(r.id)}
              onDelete={() => del.mutate(r.id)}
              onRetry={() => create.mutate(r.youtube_url)}
            />
          ))
        )}
      </div>

      {openId && <RoutineCarousel id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function RoutineCard({
  routine: r,
  onOpen,
  onDelete,
  onRetry,
}: {
  routine: VideoRoutine;
  onOpen: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const ready = r.status === 'ready';
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-panel p-3">
      <button
        type="button"
        onClick={ready ? onOpen : undefined}
        disabled={!ready}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
      >
        <Thumb r={r} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">
            {r.title ?? r.youtube_url}
          </span>
          <span className="block text-xs text-ink-muted">
            {r.status === 'ready'
              ? `${r.sections?.length ?? 0} sections`
              : r.status === 'processing'
                ? 'Processing…'
                : (r.error ?? 'Failed')}
          </span>
        </span>
      </button>

      {r.status === 'error' && (
        <Button variant="secondary" onClick={onRetry} className="px-3 py-1.5 text-xs">
          Try again
        </Button>
      )}
      <a
        href={r.youtube_url}
        target="_blank"
        rel="noreferrer"
        aria-label="Open original on YouTube"
        className="rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
      >
        <ExternalLink size={16} />
      </a>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete routine"
        className="rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// The YouTube video id — prefer the worker-stored one, else parse the URL.
function videoId(r: VideoRoutine): string | null {
  if (r.video_id) return r.video_id;
  const m = r.youtube_url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

// Leading thumbnail: the YouTube poster with a status badge overlaid.
function Thumb({ r }: { r: VideoRoutine }) {
  const id = videoId(r);
  return (
    <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-card bg-ink/5">
      {id && (
        <img
          src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-ink/25 text-white">
        {r.status === 'ready' ? (
          <Play size={16} />
        ) : r.status === 'processing' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <AlertCircle size={16} />
        )}
      </span>
    </span>
  );
}
