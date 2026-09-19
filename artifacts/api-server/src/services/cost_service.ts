import { round } from "./hallucination_service";

const PROMPT_RATE = 0.000002;
const COMPLETION_RATE = 0.000006;

export function estimateUsd(input: { promptTokens: number; completionTokens: number }) {
  return round(
    input.promptTokens * PROMPT_RATE + input.completionTokens * COMPLETION_RATE,
    6,
  );
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export const costService = { estimateUsd, estimateTokens };
