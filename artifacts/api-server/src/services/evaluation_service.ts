import { asc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { evalQuestionsTable } from "@workspace/db/schema";
import { costService } from "./cost_service";
import { hallucinationService, round } from "./hallucination_service";
import { mlflowClient } from "./mlflow_client";

export type EvaluationSampleResult = {
  evalScore: number;
  avgTokens: number;
  avgCostUsd: number;
  mlflowRunId: string;
  sampleCount: number;
};

function applyPromptTemplate(promptContent: string, question: string, context: string) {
  return `${promptContent}\n\nQuestion: ${question}\nContext: ${context}\nAnswer:`;
}

function synthesizeAnswer(
  promptContent: string,
  goldAnswer: string,
  index: number,
) {
  const emphasis = promptContent.includes("concise") ? goldAnswer.split(" ").slice(0, 6).join(" ") : goldAnswer;
  if (index % 3 === 0) {
    return `${emphasis} Additional unrelated detail about unrelated topics.`;
  }
  if (index % 3 === 1) {
    return emphasis;
  }
  return `${emphasis.slice(0, Math.max(8, Math.floor(emphasis.length * 0.7)))}...`;
}

export async function runPromptEvaluation(
  promptContent: string,
  options: { limit?: number; runName: string; experimentName?: string } = {
    limit: 10,
    runName: "prompt-eval",
    experimentName: "aegisai-prompt-evaluation",
  },
): Promise<EvaluationSampleResult> {
  const limit = options.limit ?? 10;
  const questions = await db
    .select()
    .from(evalQuestionsTable)
    .where(eq(evalQuestionsTable.benchmark, "TruthfulQA"))
    .orderBy(asc(evalQuestionsTable.createdAt))
    .limit(limit);

  if (!questions.length) {
    throw new Error("No TruthfulQA eval questions found. Run seed first.");
  }

  const { runId } = await mlflowClient.createRun(
    options.experimentName ?? "aegisai-prompt-evaluation",
    options.runName,
  );
  await mlflowClient.logParam(runId, "prompt_length", String(promptContent.length));

  let totalScore = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const [index, item] of questions.entries()) {
    const rendered = applyPromptTemplate(promptContent, item.question, item.context);
    const answer = synthesizeAnswer(promptContent, item.goldAnswer, index);
    const score = hallucinationService.score({
      question: item.question,
      context: item.context,
      answer,
    }).faithfulness_score;
    const promptTokens = costService.estimateTokens(rendered);
    const completionTokens = costService.estimateTokens(answer);
    const cost = costService.estimateUsd({ promptTokens, completionTokens });

    totalScore += score;
    totalTokens += promptTokens + completionTokens;
    totalCost += cost;

    await mlflowClient.logMetric(runId, "faithfulness_score", score, index);
    await mlflowClient.logMetric(runId, "cost_usd", cost, index);
  }

  const sampleCount = questions.length;
  const evalScore = round(totalScore / sampleCount);
  const avgTokens = Math.round(totalTokens / sampleCount);
  const avgCostUsd = round(totalCost / sampleCount, 6);

  await mlflowClient.logMetric(runId, "avg_faithfulness", evalScore, sampleCount);
  await mlflowClient.logMetric(runId, "avg_cost_usd", avgCostUsd, sampleCount);
  await mlflowClient.finishRun(runId);

  return { evalScore, avgTokens, avgCostUsd, mlflowRunId: runId, sampleCount };
}

export const evaluationService = { runSample: runPromptEvaluation };
