import type { JinshiDigestItem, RuntimeState } from "../types";
import { truncate } from "./value";

const MAX_MESSAGE_LENGTH = 2600;
export function buildDigestMessage(analysis: string, items: JinshiDigestItem[], detailedReportUrl?: string, modelLabel = ""): string {
  const lines = modelLabel ? [`🤖 模型：${modelLabel}`, "", normalizeAnalysisText(analysis)] : [normalizeAnalysisText(analysis)];

  if (detailedReportUrl) {
    lines.push("", "详细版报告:", detailedReportUrl);
  }

  return limitMessage(lines.join("\n"));
}

export function buildFallbackMessage(items: JinshiDigestItem[], detailedReportUrl?: string, modelLabel = ""): string {
  const lines = modelLabel ? [`🤖 模型：${modelLabel}`, "", "说明: GPT 分析暂不可用，以下为重点条目", ""] : ["说明: GPT 分析暂不可用，以下为重点条目", ""];

  for (const [index, item] of items.slice(0, 5).entries()) {
    lines.push(`${index + 1}. [${item.sourceType === "flash" ? "快讯" : "文章"}] ${truncate(item.title, 42)}`);
    if (item.summary) lines.push(`   摘要: ${truncate(item.summary, 50)}`);
  }

  if (detailedReportUrl) {
    lines.push("", "详细版报告:", detailedReportUrl);
  }

  return limitMessage(lines.join("\n"));
}

export function buildHeartbeatMessage(state: RuntimeState, intervalHours: number): string {
  return [
    "💓 金十市场简报 Worker 心跳",
    `心跳间隔: ${intervalHours}h`,
    `上次成功: ${state.lastSuccessAt ?? "无"}`,
    `连续失败: ${state.consecutiveFailures}`,
    state.lastError ? `最近错误: ${state.lastError}` : "最近错误: 无"
  ].join("\n");
}

export function buildFailureAlertMessage(state: RuntimeState, threshold: number): string {
  return [
    "🚨 金十市场简报 Worker 异常告警",
    `连续失败: ${state.consecutiveFailures}`,
    `告警阈值: ${threshold}`,
    `上次成功: ${state.lastSuccessAt ?? "无"}`,
    `最近错误: ${state.lastError ?? "unknown"}`
  ].join("\n");
}

export function buildWakeSummaryMessage(message: string, quietDigestCount: number): string {
  return [
    "🌅 隔夜汇总",
    `北京时间 22:00 - 08:00 静默时段内累计更新 ${quietDigestCount} 次，以下为最新一版摘要：`,
    "",
    message,
  ].join("\n");
}

export function normalizeAnalysisText(text: string): string {
  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sourceLines = cleaned
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "金十网页公开内容快照")
    .filter((line) => line !== "以下是基于金十网页公开内容输出的交易机会简报：")
    .filter((line) => line !== "以下是短报告：");

  const reportLines: string[] = ["一、核心判断"];
  let currentSection: "core" | "events" | "watch" = "core";
  let eventCount = 0;
  let watchCount = 0;
  let hasEvents = false;
  let hasWatch = false;

  for (const line of sourceLines) {
    if (/^(一、核心判断|核心观点|核心判断|市场主线|市场主线与情绪|今日机会)[:：]?$/.test(line)) continue;

    const normalized = line
      .replace(/^重点事件[:：]?$/, "")
      .replace(/^后续关注[:：]?$/, "")
      .replace(/^重点观察[:：]?$/, "")
      .replace(/^风险提示[:：]?$/, "")
      .trim();

    if (!normalized) continue;
    if (/^(时间:|主题:|摘要:)/.test(normalized)) continue;

    if (/^(重点事件|二、重点事件|二、今日机会|二、重点观察)/.test(line)) {
      if (!hasEvents) {
        reportLines.push("", "二、重点事件");
        hasEvents = true;
      }
      currentSection = "events";
      continue;
    }

    if (/^(后续关注|三、后续关注|重点观察|三、重点观察|风险提示|三、风险提示)/.test(line)) {
      if (!hasEvents) {
        reportLines.push("", "二、重点事件");
        hasEvents = true;
      }
      if (!hasWatch) {
        reportLines.push("", "三、后续关注");
        hasWatch = true;
      }
      currentSection = "watch";
      continue;
    }

    if (/^\d+[.、]/.test(normalized) || /^[-•]/.test(normalized)) {
      if (currentSection === "core") {
        reportLines.push("", "二、重点事件");
        hasEvents = true;
        currentSection = "events";
      }

      if (currentSection === "events") {
        if (eventCount >= 3) continue;
        eventCount += 1;
        reportLines.push(normalized.replace(/^[-•]\s*/, ""));
        continue;
      }

      if (currentSection === "watch") {
        if (watchCount >= 2) continue;
        watchCount += 1;
        reportLines.push(normalized.replace(/^[-•]\s*/, ""));
      }
      continue;
    }

    if (currentSection === "core") {
      reportLines.push(truncate(normalized, 120));
      continue;
    }

    if (currentSection === "events") {
      if (eventCount >= 3) continue;
      eventCount += 1;
      reportLines.push(`${eventCount}. ${truncate(normalized, 90)}`);
      continue;
    }

    if (currentSection === "watch") {
      if (watchCount >= 2) continue;
      watchCount += 1;
      reportLines.push(`${watchCount}. ${truncate(normalized, 70)}`);
    }
  }

  if (!hasEvents) {
    reportLines.push("", "二、重点事件", "1. 暂未提炼出明确高优先级事件，请结合原始快照复核。", "2. 关注消息催化是否向相关资产扩散。");
  }

  if (!hasWatch) {
    reportLines.push("", "三、后续关注", "1. 关注地缘风险与避险资产联动。", "2. 关注美元、黄金与原油波动是否放大。");
  }

  return reportLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function limitMessage(text: string): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return `${text.slice(0, MAX_MESSAGE_LENGTH - 15).trimEnd()}\n\n（内容已截断）`;
}
