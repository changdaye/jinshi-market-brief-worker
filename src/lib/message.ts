import type { JinshiDigestItem, RuntimeState } from "../types";
import { formatBeijingDateTime, truncate } from "./value";

const MAX_MESSAGE_LENGTH = 3800;

export function buildDigestMessage(analysis: string, items: JinshiDigestItem[], now = new Date()): string {
  const lines = [
    `🧭 金十市场简报（网页快照版）`,
    `时间: ${formatBeijingDateTime(now)} 北京时间`,
    `样本数: ${items.length}`,
    `来源: jin10.com / xnews.jin10.com 公开网页快照`,
    "",
    analysis.trim()
  ];

  const messageLinks = items.slice(0, 5).map((item, index) => `${index + 1}. [${item.sourceType === "flash" ? "快讯" : "文章"}] ${truncate(item.title, 48)}\n${item.link}`);
  if (messageLinks.length > 0) {
    lines.push("", "参考链接:", ...messageLinks);
  }
  return limitMessage(lines.join("\n"));
}

export function buildFallbackMessage(items: JinshiDigestItem[], now = new Date()): string {
  const lines = [
    `🧭 金十市场简报（降级版）`,
    `时间: ${formatBeijingDateTime(now)} 北京时间`,
    `说明: GPT 分析暂不可用，以下为网页快照中的重点条目`,
    ""
  ];

  for (const [index, item] of items.slice(0, 10).entries()) {
    lines.push(`${index + 1}. [${item.sourceType === "flash" ? "快讯" : "文章"}] ${item.title}`);
    if (item.summary) lines.push(`   摘要: ${truncate(item.summary, 80)}`);
    if (item.rawTimeText) lines.push(`   时间: ${item.rawTimeText}`);
    lines.push(`   链接: ${item.link}`);
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

function limitMessage(text: string): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return `${text.slice(0, MAX_MESSAGE_LENGTH - 15).trimEnd()}\n\n（内容已截断）`;
}
