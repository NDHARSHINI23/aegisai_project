import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  agentsTable,
  promptEvalResultsTable,
  promptVersionsTable,
  registeredModelsTable,
} from "@workspace/db/schema";
import { evaluationService } from "../services/evaluation_service";
import { round } from "../services/hallucination_service";

const router: IRouter = Router();

function toPromptVersion(row: typeof promptVersionsTable.$inferSelect, evalRow?: typeof promptEvalResultsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    version_number: row.versionNumber,
    agent_id: row.agentId,
    parent_id: row.parentId,
    model_id: row.modelId,
    created_at: row.createdAt.toISOString(),
    eval_score: evalRow?.evalScore ?? null,
    avg_tokens: evalRow?.avgTokens ?? null,
    avg_cost_usd: evalRow?.avgCostUsd ?? null,
    mlflow_run_id: evalRow?.mlflowRunId ?? null,
  };
}

router.post("/prompts", async (req, res): Promise<void> => {
  const body = req.body as {
    name?: string;
    content?: string;
    parent_id?: string;
    agent_id?: string;
    model_id?: string;
  };
  if (!body.name || !body.content) {
    res.status(400).json({ error: "name and content are required" });
    return;
  }
  let versionNumber = 1;
  if (body.parent_id) {
    const [parent] = await db
      .select()
      .from(promptVersionsTable)
      .where(eq(promptVersionsTable.id, body.parent_id))
      .limit(1);
    if (!parent) {
      res.status(404).json({ error: "parent_id not found" });
      return;
    }
    versionNumber = parent.versionNumber + 1;
  }
  const [row] = await db
    .insert(promptVersionsTable)
    .values({
      name: body.name,
      content: body.content,
      versionNumber,
      parentId: body.parent_id ?? null,
      agentId: body.agent_id ?? null,
      modelId: body.model_id ?? null,
    })
    .returning();
  res.status(201).json(toPromptVersion(row));
});

router.get("/prompts", async (_req, res): Promise<void> => {
  const names = await db
    .selectDistinct({ name: promptVersionsTable.name })
    .from(promptVersionsTable);

  const summaries = [];
  for (const { name } of names) {
    const [version] = await db
      .select()
      .from(promptVersionsTable)
      .where(eq(promptVersionsTable.name, name))
      .orderBy(desc(promptVersionsTable.versionNumber))
      .limit(1);
    if (!version) continue;
    const [evalRow] = await db
      .select()
      .from(promptEvalResultsTable)
      .where(eq(promptEvalResultsTable.promptVersionId, version.id))
      .orderBy(desc(promptEvalResultsTable.createdAt))
      .limit(1);
    let agentName: string | null = null;
    let modelName: string | null = null;
    if (version.agentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, version.agentId)).limit(1);
      agentName = agent?.name ?? null;
    }
    if (version.modelId) {
      const [model] = await db
        .select()
        .from(registeredModelsTable)
        .where(eq(registeredModelsTable.id, version.modelId))
        .limit(1);
      modelName = model?.name ?? null;
    }
    summaries.push({
      ...toPromptVersion(version, evalRow),
      agent_name: agentName,
      model_name: modelName,
    });
  }
  res.json(summaries);
});

router.get("/prompts/:name/versions", async (req, res): Promise<void> => {
  const versions = await db
    .select()
    .from(promptVersionsTable)
    .where(eq(promptVersionsTable.name, req.params.name))
    .orderBy(desc(promptVersionsTable.versionNumber));
  const ids = versions.map((v) => v.id);
  const evals = ids.length
    ? await db
        .select()
        .from(promptEvalResultsTable)
        .where(inArray(promptEvalResultsTable.promptVersionId, ids))
        .orderBy(desc(promptEvalResultsTable.createdAt))
    : [];
  const evalByVersion = new Map<string, typeof promptEvalResultsTable.$inferSelect>();
  for (const row of evals) {
    if (!evalByVersion.has(row.promptVersionId)) evalByVersion.set(row.promptVersionId, row);
  }
  res.json(versions.map((v) => toPromptVersion(v, evalByVersion.get(v.id))));
});

router.get("/prompts/:name/diff", async (req, res): Promise<void> => {
  const from = Number(req.query.from);
  const to = Number(req.query.to);
  if (!from || !to) {
    res.status(400).json({ error: "from and to version numbers are required" });
    return;
  }
  const rows = await db
    .select()
    .from(promptVersionsTable)
    .where(
      and(
        eq(promptVersionsTable.name, req.params.name),
        inArray(promptVersionsTable.versionNumber, [from, to]),
      ),
    );
  const fromRow = rows.find((r) => r.versionNumber === from);
  const toRow = rows.find((r) => r.versionNumber === to);
  if (!fromRow || !toRow) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  res.json({ from_content: fromRow.content, to_content: toRow.content });
});

router.post("/prompts/:id/evaluate", async (req, res): Promise<void> => {
  const [version] = await db
    .select()
    .from(promptVersionsTable)
    .where(eq(promptVersionsTable.id, req.params.id))
    .limit(1);
  if (!version) {
    res.status(404).json({ error: "Prompt version not found" });
    return;
  }
  const result = await evaluationService.runSample(version.content, {
    runName: `${version.name}-v${version.versionNumber}`,
  });
  const [evalRow] = await db
    .insert(promptEvalResultsTable)
    .values({
      promptVersionId: version.id,
      evalScore: result.evalScore,
      avgTokens: result.avgTokens,
      avgCostUsd: result.avgCostUsd,
      mlflowRunId: result.mlflowRunId,
    })
    .returning();
  res.json({
    prompt_version_id: version.id,
    eval_score: round(result.evalScore),
    avg_tokens: result.avgTokens,
    avg_cost_usd: result.avgCostUsd,
    mlflow_run_id: result.mlflowRunId,
    created_at: evalRow.createdAt.toISOString(),
  });
});

export default router;
