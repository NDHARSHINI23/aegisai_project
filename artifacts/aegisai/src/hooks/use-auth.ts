import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

export type Role = 'admin' | 'engineer' | 'security' | 'viewer';
export type User = { id: string; email: string; name: string; organization: string; role: Role; avatarUrl?: string | null; theme: string; notificationPreferences: Record<string, boolean>; twoFactorEnabled: boolean; createdAt: string };
export const authKey = ['/api/auth/me'] as const;

export function useCurrentUser() {
  return useQuery({ queryKey: authKey, queryFn: async () => { const response = await fetch('/api/auth/me', { credentials: 'include' }); if (!response.ok) throw new Error('Authentication required'); return response.json() as Promise<{ user: User }>; }, retry: false, staleTime: 60_000, gcTime: 0, refetchOnMount: 'always' });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (data: { email: string; password: string }) => customFetch<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }), onSuccess: (data) => client.setQueryData(authKey, data) });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (data: { name: string; email: string; password: string; organization: string; role: Exclude<Role, 'admin'> }) => customFetch<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }), onSuccess: (data) => client.setQueryData(authKey, data) });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => customFetch<void>('/api/auth/logout', { method: 'POST' }), onSuccess: () => { client.removeQueries({ queryKey: authKey }); } });
}
