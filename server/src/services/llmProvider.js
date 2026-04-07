const axios = require("axios");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const DEFAULT_FREE_MODELS = [
  "google/gemma-3-4b-it:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const tryParseJson = (text) => {
  if (!text || typeof text !== "string") return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_err) {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = candidate.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch (_e2) {
        return null;
      }
    }
    return null;
  }
};

const tryRepairJsonViaOpenRouter = async ({ apiKey, model, rawContent, timeoutMs }) => {
  if (!rawContent || typeof rawContent !== "string") return null;

  const repairPrompt = [
    "Convert the following text into strict valid JSON.",
    "Return only JSON.",
    "Expected top-level keys: nodes, edges, assumptions, warnings.",
    "Do not add markdown or explanation.",
    rawContent,
  ].join("\n\n");

  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model,
        messages: [{ role: "user", content: repairPrompt }],
        temperature: 0,
        response_format: { type: "json_object" },
      },
      {
        timeout: timeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const repairedContent = response?.data?.choices?.[0]?.message?.content;
    return tryParseJson(repairedContent);
  } catch (_error) {
    return null;
  }
};

const callOpenRouter = async ({ prompt, constraints, allowedNodeTypes }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { success: false, reason: "OPENROUTER_API_KEY missing" };
  }

  const preferredModel = process.env.GRAPH_LLM_MODEL || "google/gemini-2.0-flash-exp:free";
  const configuredFallbacks = String(process.env.GRAPH_LLM_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const modelCandidates = [preferredModel, ...configuredFallbacks, ...DEFAULT_FREE_MODELS]
    .filter(Boolean)
    .filter((model, index, arr) => arr.indexOf(model) === index);

  const timeoutMs = Number(process.env.GRAPH_LLM_TIMEOUT_MS || 12000);

  const systemPrompt = [
    "You generate pharma supply-chain graphs.",
    "Return strict JSON only.",
    "JSON shape: { nodes: [...], edges: [...], assumptions: [...], warnings: [...] }.",
    "Never return markdown.",
    `Allowed node types: ${allowedNodeTypes.join(", ")}`,
    "Every edge must reference valid node IDs present in nodes[].",
    "Keep values realistic for India pharma operations.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    prompt,
    constraints,
    output_requirements: {
      nodes_required_fields: ["id", "name", "type"],
      edges_required_fields: ["id", "source", "target"],
      include_optional_fields: true,
    },
  });

  const failedModels = [];

  for (const model of modelCandidates) {
    try {
      const response = await axios.post(
        OPENROUTER_URL,
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        },
        {
          timeout: timeoutMs,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response?.data?.choices?.[0]?.message?.content;
      const parsed = tryParseJson(content);

      if (!parsed) {
        const repaired = await tryRepairJsonViaOpenRouter({
          apiKey,
          model,
          rawContent: content,
          timeoutMs,
        });

        if (repaired) {
          return { success: true, data: repaired, provider: "openrouter", model };
        }

        failedModels.push(`${model}: invalid JSON output`);
        continue;
      }

      return { success: true, data: parsed, provider: "openrouter", model };
    } catch (error) {
      const reason =
        error?.response?.data?.error?.message || error.message || "OpenRouter call failed";
      failedModels.push(`${model}: ${reason}`);
    }
  }

  return {
    success: false,
    reason: `Provider returned error. Tried models -> ${failedModels.join(" | ")}`,
  };
};

const callGeminiDirect = async ({ prompt, constraints, allowedNodeTypes }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, reason: "GEMINI_API_KEY missing" };
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const timeoutMs = Number(process.env.GRAPH_LLM_TIMEOUT_MS || 12000);

  const instruction = [
    "You generate pharma supply-chain graphs.",
    "Return strict JSON only with shape: { nodes: [...], edges: [...], assumptions: [...], warnings: [...] }.",
    "Never return markdown.",
    `Allowed node types: ${allowedNodeTypes.join(", ")}`,
    "Every edge must reference valid node IDs present in nodes[].",
    "Keep values realistic for India pharma operations.",
    `User prompt: ${prompt}`,
    `Constraints JSON: ${JSON.stringify(constraints || {})}`,
  ].join(" ");

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: instruction }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      },
      {
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const content =
      response?.data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("\n") || "";
    const parsed = tryParseJson(content);

    if (!parsed) {
      return { success: false, reason: "Gemini output was not valid JSON" };
    }

    return { success: true, data: parsed, provider: "gemini-direct", model };
  } catch (error) {
    return {
      success: false,
      reason:
        error?.response?.data?.error?.message || error.message || "Gemini direct call failed",
    };
  }
};

const callOllamaLocal = async ({ prompt, constraints, allowedNodeTypes }) => {
  const model = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct";
  const timeoutMs = Number(process.env.GRAPH_LLM_TIMEOUT_MS || 12000);

  const instruction = [
    "You generate pharma supply-chain graphs.",
    "Return strict JSON only with shape: { nodes: [...], edges: [...], assumptions: [...], warnings: [...] }.",
    "Never return markdown.",
    `Allowed node types: ${allowedNodeTypes.join(", ")}`,
    "Every edge must reference valid node IDs present in nodes[].",
    "Keep values realistic for India pharma operations.",
    `User prompt: ${prompt}`,
    `Constraints JSON: ${JSON.stringify(constraints || {})}`,
  ].join(" ");

  try {
    const response = await axios.post(
      OLLAMA_URL,
      {
        model,
        prompt: instruction,
        stream: false,
        format: "json",
        options: {
          temperature: 0.2,
        },
      },
      {
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const content = response?.data?.response || "";
    const parsed = tryParseJson(content);

    if (!parsed) {
      return { success: false, reason: "Ollama output was not valid JSON" };
    }

    return { success: true, data: parsed, provider: "ollama", model };
  } catch (error) {
    return {
      success: false,
      reason: error?.response?.data?.error || error.message || "Ollama call failed",
    };
  }
};

const callGraphLlm = async ({ prompt, constraints, allowedNodeTypes }) => {
  const providerOrder = String(process.env.GRAPH_LLM_PROVIDER_ORDER || "ollama,openrouter,gemini")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const failures = [];

  for (const provider of providerOrder) {
    let result;
    if (provider === "ollama") {
      result = await callOllamaLocal({ prompt, constraints, allowedNodeTypes });
    } else if (provider === "gemini") {
      result = await callGeminiDirect({ prompt, constraints, allowedNodeTypes });
    } else if (provider === "openrouter") {
      result = await callOpenRouter({ prompt, constraints, allowedNodeTypes });
    } else {
      failures.push(`${provider}: unknown provider`);
      continue;
    }

    if (result.success) {
      return result;
    }

    failures.push(`${provider}: ${result.reason}`);
  }

  return {
    success: false,
    reason: `All providers failed -> ${failures.join(" | ")}`,
  };
};

module.exports = {
  callOpenRouter,
  callGraphLlm,
  callGeminiDirect,
  callOllamaLocal,
};
