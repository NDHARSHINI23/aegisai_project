import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  agentsTable,
  evalQuestionsTable,
  promptVersionsTable,
  registeredModelsTable,
  usersTable,
  type PromptVersion,
} from "@workspace/db/schema";
import evalQuestions from "./data/eval_questions.json";
import { mlflowClient } from "./services/mlflow_client";
import { hashPassword } from "./services/auth_service";

const modelConfigs = [
  { name: "gpt-4o-mini", version: "2026.08", framework: "OpenAI", status: "production" as const, accuracy: 0.891, latency: 182 },
  { name: "claude-3.5-sonnet", version: "2026.07", framework: "Anthropic", status: "production" as const, accuracy: 0.914, latency: 236 },
  { name: "llama-3.1-70b", version: "3.1", framework: "Meta", status: "staging" as const, accuracy: 0.848, latency: 318 },
  { name: "mistral-large", version: "2.0", framework: "Mistral", status: "archived" as const, accuracy: 0.806, latency: 274 },
];

async function main() {
  const [existingUser] = await db.select().from(usersTable).limit(1);
  const user =
    existingUser ??
    (
      await db
        .insert(usersTable)
        .values({ email: "admin@aegisai.local", name: "Platform Admin" })
        .returning()
    )[0];

  if (user.email === "admin@aegisai.local") {
    await db.update(usersTable).set({
      role: "admin",
      ...(process.env.AEGIS_ADMIN_PASSWORD ? { passwordHash: await hashPassword(process.env.AEGIS_ADMIN_PASSWORD) } : {}),
    }).where(eq(usersTable.id, user.id));
  }

  for (const config of modelConfigs) {
    const [existing] = await db
      .select()
      .from(registeredModelsTable)
      .where(eq(registeredModelsTable.name, config.name))
      .limit(1);
    if (!existing) {
      await db.insert(registeredModelsTable).values({
        name: config.name,
        version: config.version,
        framework: config.framework,
        description: `${config.framework} foundation model monitored by AegisAI.`,
        status: config.status,
        accuracy: config.accuracy,
        latencyMs: config.latency,
      });
    }
  }

  const questionCount = await db.select().from(evalQuestionsTable);
  if (!questionCount.length) {
    await db.insert(evalQuestionsTable).values(
      evalQuestions.map((item) => ({
        benchmark: item.benchmark,
        subject: item.subject,
        question: item.question,
        context: item.context,
        goldAnswer: item.gold_answer,
      })),
    );
  }

  const models = await db.select().from(registeredModelsTable);
  const agentSpecs = [
    {
      name: "Refund Resolver",
      description: "Handles refund requests with order lookup and customer communication.",
      llmModelId: models[0]?.id,
      tools: ["lookup_order", "issue_refund", "send_email"],
    },
    {
      name: "Contract Review Copilot",
      description: "Assists legal reviewers with clause search and summarization.",
      llmModelId: models[1]?.id,
      tools: ["search_clauses", "summarize"],
    },
    {
      name: "Incident Responder",
      description: "Coordinates incident triage and on-call paging.",
      llmModelId: models[2]?.id ?? models[0]?.id,
      tools: ["query_logs", "page_oncall", "create_ticket"],
    },
  ];

  const agents = [];
  for (const spec of agentSpecs) {
    if (!spec.llmModelId) continue;
    const [existing] = await db.select().from(agentsTable).where(eq(agentsTable.name, spec.name)).limit(1);
    if (existing) {
      agents.push(existing);
      continue;
    }
    const [created] = await db
      .insert(agentsTable)
      .values({
        name: spec.name,
        description: spec.description,
        llmModelId: spec.llmModelId,
        tools: spec.tools,
        status: "active",
        createdBy: user.id,
      })
      .returning();
    agents.push(created);
  }

  const promptChains = [
    {
      name: "refund-decision-prompt",
      versions: [
        "You are a refund assistant. Use lookup_order before deciding. Be concise.",
        "You are a refund assistant. Use lookup_order and issue_refund. Cite policy section numbers.",
        "You are a refund assistant. Use lookup_order, issue_refund, and send_email. Provide concise customer-facing rationale.",
      ],
    },
    {
      name: "contract-clause-extract",
      versions: [
        "Extract clause obligations from the contract text. Use search_clauses first.",
        "Extract clause obligations and risks. Use search_clauses and summarize with bullet points.",
      ],
    },
  ];

  for (const chain of promptChains) {
    let previousVersionId: string | null = null;
    for (const [index, content] of chain.versions.entries()) {
      const versionNumber = index + 1;
      const existingVersions = await db
        .select()
        .from(promptVersionsTable)
        .where(eq(promptVersionsTable.name, chain.name));
      const current = existingVersions.find((row) => row.versionNumber === versionNumber);
      if (current) {
        previousVersionId = current.id;
        continue;
      }
      const createdRows: PromptVersion[] = await db
        .insert(promptVersionsTable)
        .values({
          name: chain.name,
          content,
          versionNumber,
          parentId: previousVersionId,
          modelId: models[0]?.id ?? null,
        })
        .returning();
      const created: PromptVersion | undefined = createdRows[0];
      if (!created) {
        throw new Error(`Failed to create prompt version ${chain.name} v${versionNumber}`);
      }
      previousVersionId = created.id;
    }
  }

  const experiments = await mlflowClient.searchExperiments();
  if (!experiments.length) {
    throw new Error("MLflow has no experiments after seeding. Check MLflow server and logging.");
  }

  console.log("Seed complete:", {
    users: 1,
    models: models.length,
    agents: agents.length,
    experiments: experiments.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
