import { describe, expect, it, vi } from "vitest";
import { analyzeWithLLM } from "../src/services/llm";
import type { BriefConfig, JinshiDigestItem } from "../src/types";

function makeConfig(): BriefConfig {
  return {
    feishuWebhook: "https://example.com/hook",
    feishuSecret: "",
    manualTriggerToken: "token",
    llmModel: "@cf/meta/llama-3.2-1b-instruct",
    digestIntervalHours: 3,
    heartbeatIntervalHours: 24,
    requestTimeoutMs: 15000,
    fetchWindowHours: 3,
    maxItemsPerDigest: 60,
    failureAlertThreshold: 1,
    failureAlertCooldownMinutes: 180,
    jinshiHomeUrl: "https://www.jin10.com/",
    jinshiXnewsUrl: "https://xnews.jin10.com/"
  };
}

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

describe("analyzeWithLLM", () => {
  it("calls Workers AI with the configured model and returns response text", async () => {
    const run = vi.fn().mockResolvedValue({ response: "市场风险偏好回落，黄金与原油相关主题升温。" });
    const ai = { run } as unknown as Ai;

    const result = await analyzeWithLLM(makeConfig(), ai, [makeItem(), makeItem({ id: "news-2", sourceType: "news", title: "第二条文章" })]);

    expect(result).toBe("市场风险偏好回落，黄金与原油相关主题升温。");
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toBe("@cf/meta/llama-3.2-1b-instruct");
    expect(run.mock.calls[0][1].messages).toHaveLength(2);
  });

  it("throws when Workers AI returns an empty response", async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: "   " }) } as unknown as Ai;

    await expect(analyzeWithLLM(makeConfig(), ai, [makeItem()])).rejects.toThrow("Workers AI returned empty response");
  });
});
