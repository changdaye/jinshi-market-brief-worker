import type { BriefConfig, JinshiDigestItem, LLMAnalysisResult } from "../types";
import { truncate } from "../lib/value";

const SYSTEM_PROMPT = `你现在是一名中文财经分析师 / 财经研究员。
你的任务是输出“飞书上的市场简报”，风格要接近下面这种：

一、核心判断
用2句总结今天市场主线和整体情绪。

二、重点事件
写2到3条，每条都要是“事件 + 可能影响”的表达。
可以写到交易品种、股票代码、ETF、期货、外汇对。

三、后续关注
写2条，告诉读者今天盘中还要盯什么。

附加要求：
- 不要输出“网页快照”“样本数”“来源”等说明。
- 不要复述素材字段，不要输出“时间:”“主题:”“摘要:”。
- 不要写成素材清单。
- 不要写成长文，控制在450字内。
- 语气像财经晨报/午报，而不是聊天。`;
const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.2-1b-instruct";
const OPENAI_COMPAT_REASONING_EFFORT = "xhigh";

interface WorkersAIResult {
  response?: string;
}

interface OpenAICompatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export async function analyzeWithLLM(config: BriefConfig, ai: Ai, items: JinshiDigestItem[]): Promise<LLMAnalysisResult> {
  const sourceText = items
    .slice(0, 18)
    .map((item, index) => {
      const flags = [item.sourceType === "flash" ? "快讯" : "文章", item.important ? "重要" : "普通"];
      const lines = [
        `${index + 1}. [${flags.join("/")}] ${truncate(item.title, 72)}`,
        `   时间: ${item.rawTimeText || item.publishedAt}`
      ];
      if (item.topic) lines.push(`   主题: ${truncate(item.topic, 32)}`);
      if (item.summary) lines.push(`   摘要: ${truncate(item.summary, 80)}`);
      return lines.join("\n");
    })
    .join("\n");

  if (config.llmBaseUrl && config.llmApiKey) {
    try {
      return await analyzeWithOpenAICompatible(config, sourceText);
    } catch (error) {
      console.error("OpenAI-compatible LLM failed", error instanceof Error ? error.message : String(error));
    }
  }

  return analyzeWithWorkersAI(ai, config.llmModel.startsWith("@cf/") ? config.llmModel : DEFAULT_WORKERS_AI_MODEL, sourceText);
}

async function analyzeWithOpenAICompatible(config: BriefConfig, sourceText: string): Promise<LLMAnalysisResult> {
  const response = await fetch(`${config.llmBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llmApiKey}`,
    },
    body: JSON.stringify({
      model: config.llmModel,
      reasoning_effort: OPENAI_COMPAT_REASONING_EFFORT,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `以下是金十网页公开内容，请输出一份飞书市场简报：\n\n${sourceText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.2
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI-compatible HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const result = (await response.json()) as OpenAICompatResponse;
  const rawContent = result.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string"
    ? rawContent.trim()
    : rawContent?.map((part) => part.text ?? "").join("").trim();
  if (!content) throw new Error("OpenAI-compatible response returned empty content");
  return {
    analysis: content,
    modelLabel: `${formatModelLabel(config.llmModel)} (${OPENAI_COMPAT_REASONING_EFFORT})`,
  };
}

async function analyzeWithWorkersAI(ai: Ai, model: string, sourceText: string): Promise<LLMAnalysisResult> {
  const result = (await ai.run(
    model,
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `以下是金十网页公开内容，请输出一份飞书市场简报：\n\n${sourceText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.2
    }
  )) as WorkersAIResult;

  const content = result.response?.trim();
  if (!content) throw new Error("Workers AI returned empty response");
  return {
    analysis: content,
    modelLabel: formatModelLabel(model),
  };
}

function formatModelLabel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return "Unknown";
  const slug = trimmed.replace(/^@cf\//, "").split("/").pop() ?? trimmed;
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "gpt") return "GPT";
      if (lower === "llama") return "Llama";
      if (lower === "qwen") return "Qwen";
      if (lower === "gemma") return "Gemma";
      if (lower === "glm") return "GLM";
      if (lower === "mistral") return "Mistral";
      if (lower === "kimi") return "Kimi";
      if (lower === "deepseek") return "DeepSeek";
      if (lower === "fp8") return "FP8";
      if (lower === "awq") return "AWQ";
      if (lower === "it") return "IT";
      if (/^\d+(\.\d+)?b$/i.test(part)) return part.toUpperCase();
      if (/^\d+(\.\d+)?$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
