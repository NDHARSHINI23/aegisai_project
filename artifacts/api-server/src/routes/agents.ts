import { desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  agentTrajectoriesTable,
  agentsTable,
  registeredModelsTable,
  usersTable,
} from "@workspace/db/schema";
import { agentService } from "../services/agent_service";
import { round } from "../services/hallucination_service";
import {
  AgentDetailSchema,
  CreateAgentBody,
  CreateAgentResponse,
  GetAgentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function defaultUserId() {
  const [user] = await db.select().from(usersTable).limit(1);
  if (!user) throw new Error("No users found. Run seed first.");
  return user.id;
}

function toTrajectory(row: typeof agentTrajectoriesTable.$inferSelect) {
  return {
    id: row.id,
    agent_id: row.agentId,
    session_id: row.sessionId,
    tool_calls: row.toolCalls,
    tool_call_count: row.toolCallCount,
    tool_success_count: row.toolSuccessCount,
    final_output: row.finalOutput,
    hallucination_score: row.hallucinationScore,
    latency_ms: row.latencyMs,
    created_at: row.createdAt.toISOString(),
  };
}

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const [model] = await db
    .select()
    .from(registeredModelsTable)
    .where(eq(registeredModelsTable.id, body.llm_model_id))
    .limit(1);
  if (!model) {
    res.status(404).json({ error: "llm_model_id not found" });
    return;
  }
  const createdBy = body.created_by ?? (await defaultUserId());
  const [agent] = await db
    .insert(agentsTable)
    .values({
      name: body.name,
      description: body.description ?? null,
      llmModelId: body.llm_model_id,
      tools: body.tools ?? [],
      maxToolDepth: body.max_tool_depth ?? 5,
      createdBy,
      status: "staging",
    })
    .returning();
  const aggregates = await agentService.getAgentAggregates(agent.id);
  res.status(201).json(CreateAgentResponse.parse(toAgentSummary(agent, model, aggregates)));
});

function toAgentSummary(
  agent: typeof agentsTable.$inferSelect,
  model: typeof registeredModelsTable.$inferSelect,
  aggregates: { trajectoryCount: number; avgHallucinationScore: number; toolSuccessRate: number },
) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    llm_model_id: agent.llmModelId,
    model_name: model.name,
    model_version: model.version,
    tools: agent.tools,
    status: agent.status,
    max_tool_depth: agent.maxToolDepth,
    created_by: agent.createdBy,
    created_at: agent.createdAt.toISOString(),
    trajectory_count: aggregates.trajectoryCount,
    avg_hallucination_score: round(aggregates.avgHallucinationScore),
    tool_success_rate: round(aggregates.toolSuccessRate),
  };
}

router.get("/agents", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      agent: agentsTable,
      model: registeredModelsTable,
      trajectoryCount: sql<number>`count(${agentTrajectoriesTable.id})`,
      avgHallucinationScore: sql<number>`coalesce(avg(${agentTrajectoriesTable.hallucinationScore}), 0)`,
      toolSuccessRate: sql<number>`coalesce(avg(case when ${agentTrajectoriesTable.toolCallCount} = 0 then 0 else ${agentTrajectoriesTable.toolSuccessCount}::float / ${agentTrajectoriesTable.toolCallCount} end), 0)`,
    })
    .from(agentsTable)
    .innerJoin(registeredModelsTable, eq(agentsTable.llmModelId, registeredModelsTable.id))
    .leftJoin(agentTrajectoriesTable, eq(agentTrajectoriesTable.agentId, agentsTable.id))
    .groupBy(agentsTable.id, registeredModelsTable.id)
    .orderBy(desc(agentsTable.createdAt));

  res.json(GetAgentsResponse.parse(
    rows.map((row) =>
      toAgentSummary(row.agent, row.model, {
        trajectoryCount: Number(row.trajectoryCount),
        avgHallucinationScore: Number(row.avgHallucinationScore),
        toolSuccessRate: Number(row.toolSuccessRate),
      }),
    ),
  ));
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const [row] = await db
    .select({ agent: agentsTable, model: registeredModelsTable })
    .from(agentsTable)
    .innerJoin(registeredModelsTable, eq(agentsTable.llmModelId, registeredModelsTable.id))
    .where(eq(agentsTable.id, req.params.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const aggregates = await agentService.getAgentAggregates(row.agent.id);
  const trajectories = await db
    .select()
    .from(agentTrajectoriesTable)
    .where(eq(agentTrajectoriesTable.agentId, row.agent.id))
    .orderBy(desc(agentTrajectoriesTable.createdAt))
    .limit(20);
  res.json(AgentDetailSchema.parse({
    ...toAgentSummary(row.agent, row.model, aggregates),
    recent_trajectories: trajectories.map(toTrajectory),
  }));
});

router.put("/agents/:id/status", async (req, res): Promise<void> => {
  const status = (req.body as { status?: string }).status;
  if (!status || !["active", "staging", "archived"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [agent] = await db
    .update(agentsTable)
    .set({ status: status as "active" | "staging" | "archived" })
    .where(eq(agentsTable.id, req.params.id))
    .returning();
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const [model] = await db
    .select()
    .from(registeredModelsTable)
    .where(eq(registeredModelsTable.id, agent.llmModelId))
    .limit(1);
  const aggregates = await agentService.getAgentAggregates(agent.id);
  res.json(toAgentSummary(agent, model!, aggregates));
});

router.post("/agents/:id/trajectory", async (req, res): Promise<void> => {
  const body = req.body as {
    session_id?: string;
    tool_calls?: Array<{ name: string; success: boolean; output?: string }>;
    final_output?: string;
    context?: string;
    question?: string;
  };
  if (!body.session_id || !body.final_output || !body.context || !body.question) {
    res.status(400).json({ error: "session_id, final_output, context, and question are required" });
    return;
  }
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, req.params.id)).limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const trajectory = await agentService.recordTrajectory({
    agentId: agent.id,
    sessionId: body.session_id,
    toolCalls: body.tool_calls ?? [],
    finalOutput: body.final_output,
    context: body.context,
    question: body.question,
  });
  res.status(201).json(toTrajectory(trajectory));
});

router.get("/agents/:id/trajectories", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));
  const offset = (page - 1) * pageSize;
  const where = eq(agentTrajectoriesTable.agentId, req.params.id);
  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(agentTrajectoriesTable)
    .where(where);
  const items = await db
    .select()
    .from(agentTrajectoriesTable)
    .where(where)
    .orderBy(desc(agentTrajectoriesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json({
    items: items.map(toTrajectory),
    total: Number(countRow?.total ?? 0),
    page,
    page_size: pageSize,
  });
});

export default router;
