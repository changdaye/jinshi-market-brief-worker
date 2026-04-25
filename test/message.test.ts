import { describe, expect, it } from "vitest";
import { buildDigestMessage, buildFallbackMessage, normalizeAnalysisText } from "../src/lib/message";
import type { JinshiDigestItem } from "../src/types";

function makeItem(overrides: Partial<JinshiDigestItem> = {}): JinshiDigestItem {
  return {
    id: "flash-1",
    sourceType: "flash",
    title: "欧盟正式批准向乌克兰发放900亿欧元贷款",
    link: "https://xnews.jin10.com/details/217456",
    publishedAt: "2026-04-23T19:45:12+08:00",
    important: true,
    rawTimeText: "2026-04-23 19:45:12 +08:00",
    ...overrides
  };
}

describe("buildDigestMessage", () => {
  it("includes the model label when provided", () => {
    const items = [makeItem({ id: "1", title: "第一条", link: "https://xnews.jin10.com/details/1" })];
    const result = buildDigestMessage(
      "一、核心判断\n市场风险偏好回落。",
      items,
      "https://cos.example/detail.html",
      "GPT 5.4 (xhigh)"
    );

    expect(result).toContain("🤖 模型：GPT 5.4 (xhigh)");
  });

  it("keeps the three-section report style and detail link", () => {
    const items = [makeItem({ id: "1", title: "第一条", link: "https://xnews.jin10.com/details/1" })];
    const result = buildDigestMessage(
      "一、核心判断\n市场风险偏好回落。\n\n二、重点事件\n1. 黄金（XAUUSD）偏强：避险需求升温。\n\n三、后续关注\n1. 关注美元波动。",
      items,
      "https://cos.example/detail.html"
    );

    expect(result).toContain("一、核心判断");
    expect(result).toContain("二、重点事件");
    expect(result).toContain("三、后续关注");
    expect(result).toContain("详细版报告:");
    expect(result).toContain("https://cos.example/detail.html");
  });
});

describe("normalizeAnalysisText", () => {
  it("normalizes loose output into the target report structure", () => {
    const raw = "核心判断\n黄金偏强，原油波动加大。\n\n1. 黄金（XAUUSD）偏强：避险需求升温。\n2. 原油（WTI）波动加大：受中东局势影响。\n\n后续关注\n美元波动\n美伊局势";
    const result = normalizeAnalysisText(raw);

    expect(result).toContain("一、核心判断");
    expect(result).toContain("二、重点事件");
    expect(result).toContain("三、后续关注");
    expect(result).toContain("黄金（XAUUSD）偏强");
  });
});

describe("buildFallbackMessage", () => {
  it("includes the model label when provided", () => {
    const items = [makeItem({ title: "第一条快讯" })];
    const result = buildFallbackMessage(items, "https://cos.example/detail.html", "Llama 3.2 1B Instruct");
    expect(result).toContain("🤖 模型：Llama 3.2 1B Instruct");
  });

  it("renders a readable fallback list when LLM is unavailable", () => {
    const items = [
      makeItem({ title: "第一条快讯" }),
      makeItem({ id: "news-2", sourceType: "news", title: "第二条文章", summary: "这是一段摘要。", link: "https://xnews.jin10.com/details/217468" })
    ];
    const result = buildFallbackMessage(items, "https://cos.example/detail.html");
    expect(result).toContain("说明: GPT 分析暂不可用");
    expect(result).toContain("详细版报告:");
    expect(result).not.toContain("时间:");
  });
});
