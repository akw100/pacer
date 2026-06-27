import { useState } from 'react';
import { Loader2, Play, Trash2, AlertCircle, ExternalLink, Heart, Globe, Lock } from 'lucide-react';
import type { VideoRoutine } from '@pacer/shared';
import { Button } from '../components/Button';
import { Loader } from '../components/Loader';
import { Tooltip } from '../components/Tooltip';
import { useAuth } from '../features/auth/AuthProvider';
import { EmptyState } from '../features/video-frames/EmptyState';
import { RoutineCarousel } from '../features/video-frames/RoutineCarousel';
import { VideoPlayer } from '../features/video-frames/VideoPlayer';
import {
  useCreateVideoRoutine,
  useDeleteVideoRoutine,
  usePublicVideoRoutines,
  useSavedVideoRoutines,
  useSetRoutinePublic,
  useToggleLike,
  useVideoRoutines,
} from '../features/video-frames/useVideoRoutines';

export default function Frames() {
  const [tab, setTab] = useState<'mine' | 'public'>('mine');
  const userId = useAuth().session?.user.id;
  const mine = useVideoRoutines();
  const saved = useSavedVideoRoutines();
  const pub = usePublicVideoRoutines();
  const create = useCreateVideoRoutine();
  const del = useDeleteVideoRoutine();
  const setPublic = useSetRoutinePublic();
  const like = useToggleLike();
  const [url, setUrl] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [playVideoId, setPlayVideoId] = useState<string | null>(null);

  const myRoutines = mine.data ?? [];
  const savedRoutines = saved.data ?? [];
  const publicRoutines = pub.data ?? [];
  const anyProcessing = myRoutines.some((r) => r.status === 'processing');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    create.mutate(value, { onSuccess: () => setUrl('') });
  }

  const card = (r: VideoRoutine) => (
    <RoutineCard
      key={r.id}
      routine={r}
      owned={r.user_id === userId}
      onOpen={() => setOpenId(r.id)}
      onPlay={() => {
        const id = videoId(r);
        if (id) setPlayVideoId(id);
      }}
      onDelete={() => del.mutate(r.id)}
      onRetry={() => create.mutate(r.youtube_url)}
      onTogglePublic={() => setPublic.mutate({ id: r.id, is_public: !r.is_public })}
      onToggleLike={() => like.mutate({ id: r.id, liked: !!r.liked_by_me })}
    />
  );

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

      {tab === 'mine' ? (
        <div className="mt-6 space-y-3">
          {mine.isLoading ? (
            <Loader className="py-10" />
          ) : myRoutines.length === 0 && savedRoutines.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {myRoutines.map(card)}
              {savedRoutines.length > 0 && (
                <>
                  <h2 className="pt-2 text-sm font-semibold text-ink-muted">Saved from others</h2>
                  {savedRoutines.map(card)}
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {pub.isLoading ? (
            <Loader className="py-10" />
          ) : publicRoutines.length === 0 ? (
            <p className="rounded-card border border-border bg-panel px-6 py-10 text-center text-sm text-ink-muted">
              No public flows yet — make one of yours public to share it.
            </p>
          ) : (
            publicRoutines.map(card)
          )}
        </div>
      )}

      {openId && <RoutineCarousel id={openId} onClose={() => setOpenId(null)} />}
      {playVideoId && (
        <VideoPlayer videoId={playVideoId} onClose={() => setPlayVideoId(null)} />
      )}
    </div>
  );
}

function RoutineCard({
  routine: r,
  owned,
  onOpen,
  onPlay,
  onDelete,
  onRetry,
  onTogglePublic,
  onToggleLike,
}: {
  routine: VideoRoutine;
  owned: boolean;
  onOpen: () => void;
  onPlay: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onTogglePublic: () => void;
  onToggleLike: () => void;
}) {
  const ready = r.status === 'ready';
  // On your own flows the heart is a plain like; on others' it doubles as the
  // "save to My Flows" control.
  const likeLabel = owned
    ? r.liked_by_me
      ? 'Unlike'
      : 'Like'
    : r.liked_by_me
      ? 'Remove from My Flows'
      : 'Save to My Flows';

  return (
    <div className="flex items-center gap-2 rounded-card border border-border bg-panel p-3">
      {/* Thumb + text are grouped (gap-3) so the row looks exactly like before;
          only the click targets differ — thumb plays the video, text opens the
          frames carousel. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Tooltip label="Play video" className="shrink-0">
          <button type="button" onClick={onPlay} aria-label="Play video">
            <Thumb r={r} />
          </button>
        </Tooltip>
        <button
          type="button"
          onClick={ready ? onOpen : undefined}
          disabled={!ready}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
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
        </button>
      </div>

      {ready && (
        <Tooltip label={likeLabel}>
          <button
            type="button"
            onClick={onToggleLike}
            aria-label={likeLabel}
            className="flex items-center gap-1 rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <Heart size={16} className={r.liked_by_me ? 'fill-accent text-accent' : ''} />
            {!!r.like_count && <span className="text-xs">{r.like_count}</span>}
          </button>
        </Tooltip>
      )}

      {owned && ready && (
        <Tooltip label={r.is_public ? 'Make private' : 'Make public'}>
          <button
            type="button"
            onClick={onTogglePublic}
            aria-label={r.is_public ? 'Make private' : 'Make public'}
            className="rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            {r.is_public ? <Globe size={16} className="text-success" /> : <Lock size={16} />}
          </button>
        </Tooltip>
      )}

      {owned && r.status === 'error' && (
        <Button variant="secondary" onClick={onRetry} className="px-3 py-1.5 text-xs">
          Try again
        </Button>
      )}

      <Tooltip label="Open original on YouTube">
        <a
          href={r.youtube_url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open original on YouTube"
          className="rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          <ExternalLink size={16} />
        </a>
      </Tooltip>

      {owned && (
        <Tooltip label="Delete flow">
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete routine"
            className="rounded-pill p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <Trash2 size={16} />
          </button>
        </Tooltip>
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
    <span className="relative block h-16 w-28 shrink-0 overflow-hidden rounded-card bg-ink/5">
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
