import { describe, expect, it } from "vitest";
import { buildDetailedReport, buildDetailedReportObjectKey } from "../src/lib/report";
import type { JinshiDigestItem } from "../src/types";

const items: JinshiDigestItem[] = [
  {
    id: "news-1",
    sourceType: "news",
    title: "英伟达链条情绪升温，黄金高位震荡",
    summary: "AI 与避险资产同时活跃，市场风险偏好出现分化。",
    link: "https://xnews.jin10.com/details/217456",
    publishedAt: "2026-04-24T01:00:00+08:00",
    important: true,
    topic: "订阅美股市场动态",
    rawTimeText: "10分钟前"
  }
];

describe("buildDetailedReport", () => {
  it("renders a markdown detailed report for Jinshi items", () => {
    const report = buildDetailedReport("一、核心判断\nAI 与避险资产分化。", items, true, new Date("2026-04-24T01:02:03Z"));
    expect(report).toContain("# 金十市场简报详细版");
    expect(report).toContain("## 简报摘要");
    expect(report).toContain("AI 与避险资产分化");
    expect(report).toContain("### 1. 英伟达链条情绪升温，黄金高位震荡");
    expect(report).toContain("- 链接: https://xnews.jin10.com/details/217456");
  });
});

describe("buildDetailedReportObjectKey", () => {
  it("builds a stable markdown object key", () => {
    const key = buildDetailedReportObjectKey(new Date("2026-04-24T01:02:03Z"));
    expect(key).toBe("jinshi-market-brief-worker/20260424010203.md");
  });
});
