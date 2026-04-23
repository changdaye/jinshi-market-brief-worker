import type { BriefConfig, JinshiDigestItem } from "../types";
import { truncate } from "../lib/value";

const SYSTEM_PROMPT = `你是一位中文财经简报编辑，请基于公开网页快照生成一份短简报。
要求：
1. 先用2句话总结整体市场主线与情绪。
2. 再输出“重点事件”列表，按重要性排序，最多6条。
3. 再输出“接下来关注”列表，最多3条。
4. 不要编造未出现的信息；信息不足时直接说明。
5. 语言简洁、面向交易者，总字数控制在900字以内。
6. 不要使用 Markdown 标题符号 #，可直接用自然段和短列表。`;

export function buildChatCompletionUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/v1") ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;
}

export function extractAssistantText(data: {
  choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }>;
}): string {
  const message = data.choices?.[0]?.message;
  return message?.content?.trim() || message?.reasoning_content?.trim() || "";
}

export function extractStreamedAssistantText(raw: string): string {
  const chunks: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
      };
      const delta = parsed.choices?.[0]?.delta;
      const text = delta?.content ?? delta?.reasoning_content;
      if (text) chunks.push(text);
    } catch {
      continue;
    }
  }
  return chunks.join("").trim();
}

export async function analyzeWithLLM(config: BriefConfig, items: JinshiDigestItem[]): Promise<string> {
  const sourceText = items
    .slice(0, 24)
    .map((item, index) => {
      const flags = [item.sourceType === "flash" ? "快讯" : "文章", item.important ? "重要" : "普通"];
      const lines = [
        `${index + 1}. [${flags.join("/")}] ${truncate(item.title, 80)}`,
        `   时间: ${item.rawTimeText || item.publishedAt}`
      ];
      if (item.topic) lines.push(`   主题: ${truncate(item.topic, 40)}`);
      if (item.summary) lines.push(`   摘要: ${truncate(item.summary, 100)}`);
      return lines.join("\n");
    })
    .join("\n");

  const payload = {
    model: config.llmModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `以下是金十网页公开内容快照，请生成一份面向交易者的中文市场简报：\n\n${sourceText}`
      }
    ],
    temperature: 0.3,
    max_tokens: 1800
  };

  const url = buildChatCompletionUrl(config.llmBaseUrl);
  const response = await fetch(url, buildRequest(config.llmApiKey, config.requestTimeoutMs, { ...payload, stream: true }));
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM stream API HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  const streamed = extractStreamedAssistantText(await response.text());
  if (streamed) return streamed;

  const fallbackResponse = await fetch(url, buildRequest(config.llmApiKey, config.requestTimeoutMs, payload));
  if (!fallbackResponse.ok) {
    const text = await fallbackResponse.text();
    throw new Error(`LLM API HTTP ${fallbackResponse.status}: ${text.slice(0, 500)}`);
  }

  const fallbackData = (await fallbackResponse.json()) as {
    choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }>;
  };
  const content = extractAssistantText(fallbackData);
  if (!content) throw new Error("LLM returned empty response");
  return content;
}

function buildRequest(apiKey: string, timeoutMs: number, payload: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs)
  };
}
