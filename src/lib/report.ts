import type { JinshiDigestItem } from "../types";

const PROJECT_PREFIX = "jinshi-market-brief-worker";

export function buildDetailedReport(
  analysis: string,
  items: JinshiDigestItem[],
  aiAnalysis: boolean,
  now = new Date()
): string {
  const lines: string[] = [
    "# 金十市场简报详细版",
    "",
    `- 生成时间: ${now.toISOString()}`,
    `- 条目数量: ${items.length}`,
    `- AI 摘要: ${aiAnalysis ? "是" : "否（使用回退摘要）"}`,
    "",
    "## 简报摘要",
    "",
    analysis,
    "",
    "## 重点条目明细",
    ""
  ];

  items.forEach((item, index) => {
    lines.push(`### ${index + 1}. ${item.title}`);
    lines.push(`- 类型: ${item.sourceType === "flash" ? "快讯" : "文章"}`);
    lines.push(`- 是否重点: ${item.important ? "是" : "否"}`);
    if (item.rawTimeText) lines.push(`- 页面时间: ${item.rawTimeText}`);
    lines.push(`- 发布时间: ${item.publishedAt}`);
    if (item.topic) lines.push(`- 主题: ${item.topic}`);
    lines.push(`- 链接: ${item.link}`);
    if (item.summary) {
      lines.push("- 摘要:", item.summary);
    }
    lines.push("");
  });

  return `${lines.join("\n").trim()}\n`;
}

export function buildDetailedReportObjectKey(now = new Date()): string {
  const stamp = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds())
  ].join("");

  return `${PROJECT_PREFIX}/${stamp}.md`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
