import type { BriefConfig, JinshiDigestItem } from "../types";
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

interface WorkersAIResult {
  response?: string;
}

export async function analyzeWithLLM(config: BriefConfig, ai: Ai, items: JinshiDigestItem[]): Promise<string> {
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

  const result = (await ai.run(
    config.llmModel,
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
  return content;
}
