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

interface WorkersAIResult {
  response?: string;
}

export async function analyzeWithLLM(config: BriefConfig, ai: Ai, items: JinshiDigestItem[]): Promise<string> {
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

  const result = (await ai.run(config.llmModel, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `以下是金十网页公开内容快照，请生成一份面向交易者的中文市场简报：\n\n${sourceText}`
      }
    ],
    max_tokens: 900,
    temperature: 0.3
  })) as WorkersAIResult;

  const content = result.response?.trim();
  if (!content) throw new Error("Workers AI returned empty response");
  return content;
}
