import * as zod from "zod";

export const AgentSummarySchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  description: zod.string().nullish(),
  llm_model_id: zod.string(),
  model_name: zod.string(),
  model_version: zod.string(),
  tools: zod.array(zod.string()),
  status: zod.string(),
  max_tool_depth: zod.number(),
  created_by: zod.string(),
  created_at: zod.string(),
  trajectory_count: zod.number(),
  avg_hallucination_score: zod.number(),
  tool_success_rate: zod.number(),
});

export const AgentTrajectorySchema = zod.object({
  id: zod.string(),
  agent_id: zod.string(),
  session_id: zod.string(),
  tool_calls: zod.array(zod.record(zod.string(), zod.unknown())),
  tool_call_count: zod.number(),
  tool_success_count: zod.number(),
  final_output: zod.string(),
  hallucination_score: zod.number().nullish(),
  latency_ms: zod.number(),
  created_at: zod.string(),
});

export const AgentDetailSchema = AgentSummarySchema.extend({
  recent_trajectories: zod.array(AgentTrajectorySchema),
});

export const GetAgentsResponse = zod.array(AgentSummarySchema);
export const CreateAgentBody = zod.object({
  name: zod.string(),
  description: zod.string().optional(),
  llm_model_id: zod.string(),
  tools: zod.array(zod.string()).optional(),
  max_tool_depth: zod.number().optional(),
  created_by: zod.string().optional(),
});
export const CreateAgentResponse = AgentSummarySchema;

export const PromptVersionSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  content: zod.string(),
  version_number: zod.number(),
  agent_id: zod.string().nullish(),
  parent_id: zod.string().nullish(),
  model_id: zod.string().nullish(),
  created_at: zod.string(),
  eval_score: zod.number().nullish(),
  avg_tokens: zod.number().nullish(),
  avg_cost_usd: zod.number().nullish(),
  mlflow_run_id: zod.string().nullish(),
});

export const PromptEvalResultSchema = zod.object({
  prompt_version_id: zod.string(),
  eval_score: zod.number(),
  avg_tokens: zod.number(),
  avg_cost_usd: zod.number(),
  mlflow_run_id: zod.string(),
  created_at: zod.string(),
});
