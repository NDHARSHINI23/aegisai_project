import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { customFetch } from './custom-fetch';

export type AgentSummary = {
  id: string;
  name: string;
  description?: string | null;
  llm_model_id: string;
  model_name: string;
  model_version: string;
  tools: string[];
  status: string;
  max_tool_depth: number;
  created_by: string;
  created_at: string;
  trajectory_count: number;
  avg_hallucination_score: number;
  tool_success_rate: number;
};

export type AgentTrajectory = {
  id: string;
  agent_id: string;
  session_id: string;
  tool_calls: Array<{ name: string; success: boolean; output?: string }>;
  tool_call_count: number;
  tool_success_count: number;
  final_output: string;
  hallucination_score?: number | null;
  latency_ms: number;
  created_at: string;
};

export type AgentDetail = AgentSummary & { recent_trajectories: AgentTrajectory[] };

export type AgentInput = {
  name: string;
  description?: string;
  llm_model_id: string;
  tools?: string[];
  max_tool_depth?: number;
  created_by?: string;
};

export type PromptVersion = {
  id: string;
  name: string;
  content: string;
  version_number: number;
  agent_id?: string | null;
  parent_id?: string | null;
  model_id?: string | null;
  created_at: string;
  eval_score?: number | null;
  avg_tokens?: number | null;
  avg_cost_usd?: number | null;
  mlflow_run_id?: string | null;
};

export type PromptSummary = PromptVersion & {
  agent_name?: string | null;
  model_name?: string | null;
};

export type PromptEvalResult = {
  prompt_version_id: string;
  eval_score: number;
  avg_tokens: number;
  avg_cost_usd: number;
  mlflow_run_id: string;
  created_at: string;
};

export type ExperimentSummary = {
  experiment_id: string;
  name: string;
  run_count: number;
};

export type ExperimentRun = {
  run_id: string;
  experiment_id: string;
  run_name: string;
  status: string;
  start_time: number;
  end_time?: number | null;
  params: Record<string, string>;
  metrics: Record<string, number>;
  tags: Record<string, string>;
};

export type ExperimentRunDetail = ExperimentRun & {
  metric_history: Array<{ key: string; points: Array<{ step: number; value: number; timestamp: number }> }>;
  artifacts: Array<{ path: string; is_dir: boolean; file_size?: number | null; download_url?: string | null }>;
  mlflow_ui_url: string;
};

export type ExperimentRunCompare = {
  runs: ExperimentRun[];
  params: Array<{ key: string; values: Array<{ run_id: string; value: string | null }> }>;
  metrics: Array<{ key: string; values: Array<{ run_id: string; value: number | null }> }>;
};

export const getGetAgentsQueryKey = () => ['/api/agents'] as const;
export const getGetPromptsQueryKey = () => ['/api/prompts'] as const;

export function useGetAgents(options?: { query?: Partial<UseQueryOptions<AgentSummary[]>> }) {
  return useQuery({
    queryKey: getGetAgentsQueryKey(),
    queryFn: () => customFetch<AgentSummary[]>('/api/agents'),
    ...options?.query,
  });
}

export function useGetAgent(id: string, options?: { query?: Partial<UseQueryOptions<AgentDetail>> }) {
  return useQuery({
    queryKey: ['/api/agents', id],
    queryFn: () => customFetch<AgentDetail>(`/api/agents/${id}`),
    enabled: Boolean(id),
    ...options?.query,
  });
}

export function useCreateAgent(
  options?: { mutation?: UseMutationOptions<AgentSummary, Error, { data: AgentInput }> },
) {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<AgentSummary>('/api/agents', { method: 'POST', body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export function useGetPrompts(options?: { query?: Partial<UseQueryOptions<PromptSummary[]>> }) {
  return useQuery({
    queryKey: getGetPromptsQueryKey(),
    queryFn: () => customFetch<PromptSummary[]>('/api/prompts'),
    ...options?.query,
  });
}

export function useGetPromptVersions(name: string, options?: { query?: Partial<UseQueryOptions<PromptVersion[]>> }) {
  return useQuery({
    queryKey: ['/api/prompts', name, 'versions'],
    queryFn: () => customFetch<PromptVersion[]>(`/api/prompts/${encodeURIComponent(name)}/versions`),
    enabled: Boolean(name),
    ...options?.query,
  });
}

export function useGetPromptDiff(
  name: string,
  params: { from: number; to: number },
  options?: { query?: Partial<UseQueryOptions<{ from_content: string; to_content: string }>> },
) {
  const search = new URLSearchParams({ from: String(params.from), to: String(params.to) });
  return useQuery({
    queryKey: ['/api/prompts', name, 'diff', params.from, params.to],
    queryFn: () =>
      customFetch<{ from_content: string; to_content: string }>(
        `/api/prompts/${encodeURIComponent(name)}/diff?${search}`,
      ),
    enabled: Boolean(name && params.from && params.to && params.from !== params.to),
    ...options?.query,
  });
}

export function useCreatePrompt(
  options?: {
    mutation?: UseMutationOptions<
      PromptVersion,
      Error,
      { data: { name: string; content: string; parent_id?: string; agent_id?: string; model_id?: string } }
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<PromptVersion>('/api/prompts', { method: 'POST', body: JSON.stringify(data) }),
    ...options?.mutation,
  });
}

export function useEvaluatePrompt(
  options?: { mutation?: UseMutationOptions<PromptEvalResult, Error, { id: string }> },
) {
  return useMutation({
    mutationFn: ({ id }) =>
      customFetch<PromptEvalResult>(`/api/prompts/${id}/evaluate`, { method: 'POST' }),
    ...options?.mutation,
  });
}

export function useGetExperiments(options?: { query?: Partial<UseQueryOptions<ExperimentSummary[]>> }) {
  return useQuery({
    queryKey: ['/api/experiments'],
    queryFn: () => customFetch<ExperimentSummary[]>('/api/experiments'),
    ...options?.query,
  });
}

export function useGetExperimentRuns(
  experimentId: string,
  params?: { order_by?: string },
  options?: { query?: Partial<UseQueryOptions<ExperimentRun[]>> },
) {
  const search = params?.order_by ? `?order_by=${encodeURIComponent(params.order_by)}` : '';
  return useQuery({
    queryKey: ['/api/experiments', experimentId, 'runs', params?.order_by],
    queryFn: () => customFetch<ExperimentRun[]>(`/api/experiments/${experimentId}/runs${search}`),
    enabled: Boolean(experimentId),
    ...options?.query,
  });
}

export function useGetExperimentRun(runId: string, options?: { query?: Partial<UseQueryOptions<ExperimentRunDetail>> }) {
  return useQuery({
    queryKey: ['/api/experiments/runs', runId],
    queryFn: () => customFetch<ExperimentRunDetail>(`/api/experiments/runs/${runId}`),
    enabled: Boolean(runId),
    ...options?.query,
  });
}

export function useCompareExperimentRuns(
  params: { run_ids: string },
  options?: { query?: Partial<UseQueryOptions<ExperimentRunCompare>> },
) {
  return useQuery({
    queryKey: ['/api/experiments/runs/compare', params.run_ids],
    queryFn: () =>
      customFetch<ExperimentRunCompare>(
        `/api/experiments/runs/compare?run_ids=${encodeURIComponent(params.run_ids)}`,
      ),
    enabled: params.run_ids.split(',').filter(Boolean).length >= 2,
    ...options?.query,
  });
}
