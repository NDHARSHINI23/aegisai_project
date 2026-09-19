import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { registeredModelsTable } from "@workspace/db/schema";
import { CreateModelBody, CreateModelResponse, GetModelsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function toApiModel(row: typeof registeredModelsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    framework: row.framework,
    endpoint_url: row.endpointUrl,
    description: row.description,
    status: row.status,
    accuracy: row.accuracy,
    latency_ms: row.latencyMs,
    registered_at: row.registeredAt.toISOString(),
    owner: row.owner ?? null,
    dataset_version: row.datasetVersion ?? null,
    git_commit: row.gitCommit ?? null,
    training_date: row.trainingDate?.toISOString() ?? null,
    environment: row.environment ?? null,
    benchmark_results: row.benchmarkResults ?? null,
    promotion_approval_status: row.promotionApprovalStatus ?? undefined,
  };
}

// GET all models
router.get("/models", async (_req, res): Promise<void> => {
  const rows = await db.select().from(registeredModelsTable).orderBy(desc(registeredModelsTable.registeredAt));
  res.json(GetModelsResponse.parse(rows.map(toApiModel)));
});

// POST register a new model
router.post("/models", async (req, res): Promise<void> => {
  const parsed = CreateModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(registeredModelsTable)
    .values({
      name: parsed.data.name,
      version: parsed.data.version,
      framework: parsed.data.framework,
      endpointUrl: parsed.data.endpoint_url ?? null,
      description: parsed.data.description ?? null,
      status: "staging",
      accuracy: 0,
      latencyMs: 0,
    })
    .returning();
  res.status(201).json(CreateModelResponse.parse(toApiModel(row)));
});

// PATCH approve/reject a model — wires the Approve button in the UI
const ApproveBody = z.object({
  action: z.enum(["approve", "reject", "pending"]).default("approve"),
});

router.patch("/models/:id/approve", async (req, res): Promise<void> => {
  const { id } = req.params;
  const parsed = ApproveBody.safeParse(req.body);
  const action = parsed.success ? parsed.data.action : "approve";
  const statusMap = { approve: "approved", reject: "rejected", pending: "pending" } as const;
  const promotionStatus = statusMap[action];

  const [updated] = await db
    .update(registeredModelsTable)
    .set({
      promotionApprovalStatus: promotionStatus,
      // Auto-promote model to production tier when approved
      ...(promotionStatus === "approved" ? { status: "production" } : {}),
    })
    .where(eq(registeredModelsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json(toApiModel(updated));
});

export default router;
