import { useState } from 'react';
import { Loader2, Play, Trash2, AlertCircle, ExternalLink, Heart, Globe, Lock } from 'lucide-react';
import type { VideoRoutine } from '@pacer/shared';
import { Button } from '../components/Button';
import { EmptyState } from '../features/video-frames/EmptyState';
import { RoutineCarousel } from '../features/video-frames/RoutineCarousel';
import {
  useCreateVideoRoutine,
  useDeleteVideoRoutine,
  usePublicVideoRoutines,
  useSetRoutinePublic,
  useToggleLike,
  useVideoRoutines,
} from '../features/video-frames/useVideoRoutines';

export default function Frames() {
  const [tab, setTab] = useState<'mine' | 'public'>('mine');
  const mine = useVideoRoutines();
  const pub = usePublicVideoRoutines();
  const create = useCreateVideoRoutine();
  const del = useDeleteVideoRoutine();
  const setPublic = useSetRoutinePublic();
  const like = useToggleLike();
  const [url, setUrl] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const myRoutines = mine.data ?? [];
  const anyProcessing = myRoutines.some((r) => r.status === 'processing');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    create.mutate(value, { onSuccess: () => setUrl('') });
  }

  const list = tab === 'mine' ? myRoutines : (pub.data ?? []);
  const loading = tab === 'mine' ? mine.isLoading : pub.isLoading;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="font-display text-2xl font-bold text-ink">Workout Flows</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Turn a YouTube workout into a step-through routine.
      </p>

      <div className="mt-4 flex w-fit gap-1 rounded-pill bg-ink/5 p-1">
        {(['mine', 'public'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-panel text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t === 'mine' ? 'My Flows' : 'Discover'}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <>
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
        </>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : list.length === 0 ? (
          tab === 'mine' ? (
            <EmptyState />
          ) : (
            <p className="rounded-card border border-border bg-panel px-6 py-10 text-center text-sm text-ink-muted">
              No public flows yet — make one of yours public to share it.
            </p>
          )
        ) : (
          list.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              mine={tab === 'mine'}
              onOpen={() => setOpenId(r.id)}
              onDelete={() => del.mutate(r.id)}
              onRetry={() => create.mutate(r.youtube_url)}
              onTogglePublic={() => setPublic.mutate({ id: r.id, is_public: !r.is_public })}
              onToggleLike={() => like.mutate({ id: r.id, liked: !!r.liked_by_me })}
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
  mine,
  onOpen,
  onDelete,
  onRetry,
  onTogglePublic,
  onToggleLike,
}: {
  routine: VideoRoutine;
  mine: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onTogglePublic: () => void;
  onToggleLike: () => void;
}) {
  const ready = r.status === 'ready';
  return (
    <div className="flex items-center gap-2 rounded-card border border-border bg-panel p-3">
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

      {ready && (
        <button
          type="button"
          onClick={onToggleLike}
          aria-label={r.liked_by_me ? 'Unlike' : 'Like'}
          className="flex items-center gap-1 rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          <Heart size={16} className={r.liked_by_me ? 'fill-accent text-accent' : ''} />
          {!!r.like_count && <span className="text-xs">{r.like_count}</span>}
        </button>
      )}

      {mine && ready && (
        <button
          type="button"
          onClick={onTogglePublic}
          aria-label={r.is_public ? 'Make private' : 'Make public'}
          className="rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          {r.is_public ? <Globe size={16} className="text-success" /> : <Lock size={16} />}
        </button>
      )}

      {mine && r.status === 'error' && (
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

      {mine && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete routine"
          className="rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          <Trash2 size={16} />
        </button>
      )}
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
