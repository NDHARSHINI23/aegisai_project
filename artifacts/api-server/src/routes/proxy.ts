import { Router, type Request, type Response } from "express";
import { securityService } from "../services/security_service";

const router = Router();

/**
 * ── FEATURE: LIVE LLM PROXY GATEWAY ──
 * This endpoint mimics the OpenAI /v1/chat/completions API format.
 * Rather than letting applications talk to OpenAI directly, they point their SDK here.
 * AegisAI intercepts the prompt, runs a real-time toxicity & injection scan using 
 * the Civil Comments ML model, and blocks malicious requests *before* inference.
 */
router.post("/v1/chat/completions", async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, model } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: { message: "Invalid messages array", type: "invalid_request_error" }});
      return;
    }

    // Extract the latest user prompt
    const latestUserMessage = [...messages].reverse().find(m => m.role === "user");
    const promptText = latestUserMessage?.content || "";

    // 1️⃣ INTERCEPT & SCAN
    // Real-time inference through our toxicity scanner (Phase 5 Civil Comments model)
    const scanResult = await securityService.scanText(promptText);

    if (scanResult.risk === "high" || scanResult.risk === "critical") {
      
      // 2️⃣ BLOCK & LOG
      // A genuine enterprise gateway registers the rejected event internally
      await securityService.registerEvent(
        promptText,
        model ?? "unknown-llm",
        "prompt_injection", // Categorize as an injection/toxic drop
        scanResult.risk,
        "AegisAI Proxy Gateway Intercept: Malicious prompt halted."
      );

      // Return unified OpenAI-style refusal
      res.status(403).json({
        error: {
          message: `Request blocked by AegisAI Guardrails. Detected ${scanResult.findings.length} violations (Risk: ${scanResult.risk}).`,
          type: "policy_violation",
          code: "content_policy_violation"
        }
      });
      return;
    }

    // 3️⃣ PASS-THROUGH TO ACTUAL LLM (e.g. OpenAI)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(req.body)
      });
      const data = await openAiResponse.json();
      res.status(openAiResponse.status).json(data);
    } else {
      // Mock Pass-through response if no real key is configured
      res.json({
        id: "chatcmpl-mock",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model ?? "unknown-llm",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "(AegisAI Proxy mode strictly for validation. The prompt passed guardrails cleanly, but no OpenAI API key was provided to forward the request to.)"
          },
          finish_reason: "stop"
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      });
    }

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ error: { message: "Internal Proxy Gateway Error" }});
  }
});

export default router;
