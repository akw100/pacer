import { useMutation } from '@tanstack/react-query';
import type {
  AssistantChatMessage,
  AssistantChatRequest,
  AssistantChatResponse,
} from '@pacer/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

// Pacer Coach (Assistant) — stateless v1.
//
// The backend at POST /assistant/chat is stateless: each call must send the
// full conversation history. We mirror that here with a plain mutation rather
// than a useQuery cache, so retries and errors stay simple. The caller's
// Supabase JWT is forwarded so every tool the assistant invokes runs under
// the user's own RLS (no service-role).
export function useChatCompletion() {
  const token = useAuth().session?.access_token ?? null;
  return useMutation<AssistantChatResponse, Error, AssistantChatMessage[]>({
    mutationFn: (messages) => {
      if (!token) throw new Error('Not signed in');
      const body: AssistantChatRequest = { messages };
      return apiFetch<AssistantChatResponse>('/assistant/chat', {
        token,
        method: 'POST',
        body,
      });
    },
  });
}
