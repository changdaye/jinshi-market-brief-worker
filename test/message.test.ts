import { describe, expect, it } from "vitest";
import { buildDigestMessage, buildFallbackMessage } from "../src/lib/message";
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
  it("formats digest header, source count and links", () => {
    const result = buildDigestMessage("市场风险偏好回落，地缘政治相关主题再度升温。", [makeItem()], new Date("2026-04-23T12:00:00.000Z"));
    expect(result).toContain("金十市场简报（网页快照版）");
    expect(result).toContain("样本数: 1");
    expect(result).toContain("市场风险偏好回落");
    expect(result).toContain("参考链接:");
    expect(result).toContain("https://xnews.jin10.com/details/217456");
  });
});

describe("buildFallbackMessage", () => {
  it("renders a readable fallback list when LLM is unavailable", () => {
    const items = [
      makeItem({ title: "第一条快讯" }),
      makeItem({ id: "news-2", sourceType: "news", title: "第二条文章", summary: "这是一段摘要。", link: "https://xnews.jin10.com/details/217468" })
    ];
    const result = buildFallbackMessage(items, new Date("2026-04-23T12:00:00.000Z"));
    expect(result).toContain("金十市场简报（降级版）");
    expect(result).toContain("GPT 分析暂不可用");
    expect(result).toContain("[快讯] 第一条快讯");
    expect(result).toContain("[文章] 第二条文章");
    expect(result).toContain("摘要: 这是一段摘要。");
  });
});
