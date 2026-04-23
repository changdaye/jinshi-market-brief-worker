import { describe, expect, it } from "vitest";
import { extractAssistantText, extractStreamedAssistantText } from "../src/services/llm";

describe("extractAssistantText", () => {
  it("prefers content when present", () => {
    expect(extractAssistantText({ choices: [{ message: { content: "ok" } }] })).toBe("ok");
  });

  it("falls back to reasoning_content when content is null", () => {
    expect(extractAssistantText({ choices: [{ message: { content: null, reasoning_content: "推理结果" } }] })).toBe("推理结果");
  });
});

describe("extractStreamedAssistantText", () => {
  it("collects delta.content chunks", () => {
    const raw = [
      'data: {"choices":[{"delta":{"content":"你"}}]}',
      'data: {"choices":[{"delta":{"content":"好"}}]}',
      'data: [DONE]'
    ].join('\n');

    expect(extractStreamedAssistantText(raw)).toBe("你好");
  });

  it("collects delta.reasoning_content chunks when content is absent", () => {
    const raw = [
      'data: {"choices":[{"delta":{"reasoning_content":"市场"}}]}',
      'data: {"choices":[{"delta":{"reasoning_content":"偏强"}}]}',
      'data: [DONE]'
    ].join('\n');

    expect(extractStreamedAssistantText(raw)).toBe("市场偏强");
  });
});
