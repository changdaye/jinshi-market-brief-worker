import { describe, expect, it, vi } from "vitest";
import { analyzeWithLLM } from "../src/services/llm";
import type { BriefConfig, JinshiDigestItem } from "../src/types";

function makeConfig(): BriefConfig {
  return {
    feishuWebhook: "https://example.com/hook",
    feishuSecret: "",
    manualTriggerToken: "token",
    llmModel: "@cf/meta/llama-3.1-8b-instruct",
    digestIntervalHours: 3,
    heartbeatIntervalHours: 24,
    requestTimeoutMs: 15000,
    fetchWindowHours: 3,
    maxItemsPerDigest: 60,
    failureAlertThreshold: 1,
    failureAlertCooldownMinutes: 180,
    cosSecretId: "secret-id",
    cosSecretKey: "secret-key",
    cosBucket: "bucket",
    cosRegion: "na-ashburn",
    cosBaseUrl: "https://bucket.cos.na-ashburn.myqcloud.com",
    jinshiHomeUrl: "https://www.jin10.com/",
    jinshiXnewsUrl: "https://xnews.jin10.com/"
  };
}

function makeItem(overrides: Partial<JinshiDigestItem> = {}): JinshiDigestItem {
  return {
    id: "flash-1",
    sourceType: "flash",
    title: "英伟达产业链情绪升温，黄金回调后企稳",
    link: "https://xnews.jin10.com/details/217456",
    publishedAt: "2026-04-23T19:45:12+08:00",
    important: true,
    rawTimeText: "2026-04-23 19:45:12 +08:00",
    ...overrides
  };
}

describe("analyzeWithLLM", () => {
  it("calls Workers AI with the configured model and returns response text", async () => {
    const run = vi.fn().mockResolvedValue({ response: "一、核心判断\nAI与避险资产分化。" });
    const ai = { run } as unknown as Ai;

    const result = await analyzeWithLLM(makeConfig(), ai, [makeItem(), makeItem({ id: "news-2", sourceType: "news", title: "第二条文章" })]);

    expect(result).toContain("核心判断");
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toBe("@cf/meta/llama-3.1-8b-instruct");
    expect(run.mock.calls[0][1].messages[0].content).toContain("财经分析师");
    expect(run.mock.calls[0][1].messages[0].content).toContain("股票代码");
    expect(run.mock.calls[0][1].messages[0].content).toContain("交易品种");
  });

  it("throws when Workers AI returns an empty response", async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: "   " }) } as unknown as Ai;

    await expect(analyzeWithLLM(makeConfig(), ai, [makeItem()])).rejects.toThrow("Workers AI returned empty response");
  });
});
