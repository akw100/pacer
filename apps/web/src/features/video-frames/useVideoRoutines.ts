import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VideoRoutine, VideoRoutineWithUrls } from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

// Video-frames slice data layer. Mirrors the logging hooks (apiFetch + the live
// session token). No realtime — a job takes minutes, so we poll while anything
// is still 'processing' and stop once everything settles.

function useToken(): string | null {
  return useAuth().session?.access_token ?? null;
}

const keys = {
  all: ['video-routines'] as const,
  public: ['video-routines', 'public'] as const,
  one: (id: string) => ['video-routines', id] as const,
};

export function useVideoRoutines() {
  const token = useToken();
  return useQuery<VideoRoutine[]>({
    queryKey: keys.all,
    queryFn: () => apiFetch<VideoRoutine[]>('/video-routines', { token: token! }),
    enabled: !!token,
    refetchInterval: (q) =>
      q.state.data?.some((r) => r.status === 'processing') ? 5000 : false,
  });
}

export function useVideoRoutine(id: string | null) {
  const token = useToken();
  return useQuery<VideoRoutineWithUrls>({
    queryKey: keys.one(id ?? ''),
    queryFn: () => apiFetch<VideoRoutineWithUrls>(`/video-routines/${id}`, { token: token! }),
    enabled: !!token && !!id,
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 5000 : false),
  });
}

export function useCreateVideoRoutine() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (youtube_url: string) =>
      apiFetch<VideoRoutine>('/video-routines', {
        token: token!,
        method: 'POST',
        body: { youtube_url },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteVideoRoutine() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/video-routines/${id}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function usePublicVideoRoutines() {
  const token = useToken();
  return useQuery<VideoRoutine[]>({
    queryKey: keys.public,
    queryFn: () => apiFetch<VideoRoutine[]>('/video-routines/public', { token: token! }),
    enabled: !!token,
  });
}

export function useSetRoutinePublic() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_public }: { id: string; is_public: boolean }) =>
      apiFetch<VideoRoutine>(`/video-routines/${id}`, {
        token: token!,
        method: 'PATCH',
        body: { is_public },
      }),
    // keys.all is a prefix of both the mine and public lists, so one invalidate
    // refreshes both.
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useToggleLike() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      apiFetch<void>(`/video-routines/${id}/like`, {
        token: token!,
        method: liked ? 'DELETE' : 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
