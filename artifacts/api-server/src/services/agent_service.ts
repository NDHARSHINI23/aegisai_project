import { count, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  agentTrajectoriesTable,
} from "@workspace/db/schema";
import { hallucinationService } from "./hallucination_service";

export async function recordTrajectory(input: {
  agentId: string;
  sessionId: string;
  toolCalls: Array<{ name: string; success: boolean; output?: string }>;
  finalOutput: string;
  context: string;
  question: string;
}) {
  const toolCallCount = input.toolCalls.length;
  const toolSuccessCount = input.toolCalls.filter((call) => call.success).length;
  const started = Date.now();
  const hallucination = hallucinationService.score({
    question: input.question,
    context: input.context,
    answer: input.finalOutput,
  });

  const [trajectory] = await db
    .insert(agentTrajectoriesTable)
    .values({
      agentId: input.agentId,
      sessionId: input.sessionId,
      toolCalls: input.toolCalls,
      toolCallCount,
      toolSuccessCount,
      finalOutput: input.finalOutput,
      hallucinationScore: hallucination.faithfulness_score,
      latencyMs: Date.now() - started,
    })
    .returning();

  return trajectory;
}

export async function getAgentAggregates(agentId: string) {
  const [row] = await db
    .select({
      trajectoryCount: count(agentTrajectoriesTable.id),
      avgHallucinationScore: sql<number>`coalesce(avg(${agentTrajectoriesTable.hallucinationScore}), 0)`,
      toolSuccessRate: sql<number>`coalesce(avg(case when ${agentTrajectoriesTable.toolCallCount} = 0 then 0 else ${agentTrajectoriesTable.toolSuccessCount}::float / ${agentTrajectoriesTable.toolCallCount} end), 0)`,
    })
    .from(agentTrajectoriesTable)
    .where(eq(agentTrajectoriesTable.agentId, agentId));

  return {
    trajectoryCount: Number(row?.trajectoryCount ?? 0),
    avgHallucinationScore: Number(row?.avgHallucinationScore ?? 0),
    toolSuccessRate: Number(row?.toolSuccessRate ?? 0),
  };
}

export const agentService = { recordTrajectory, getAgentAggregates };
