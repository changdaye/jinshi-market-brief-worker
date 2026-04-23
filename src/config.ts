import type { BriefConfig, Env } from "./types";
import { toInt } from "./lib/value";

export function parseConfig(env: Env): BriefConfig {
  if (!env.FEISHU_WEBHOOK) throw new Error("missing FEISHU_WEBHOOK");
  if (!env.LLM_BASE_URL) throw new Error("missing LLM_BASE_URL");
  if (!env.LLM_API_KEY) throw new Error("missing LLM_API_KEY");

  return {
    feishuWebhook: env.FEISHU_WEBHOOK.trim(),
    feishuSecret: env.FEISHU_SECRET?.trim() ?? "",
    manualTriggerToken: env.MANUAL_TRIGGER_TOKEN?.trim() ?? "",
    llmBaseUrl: env.LLM_BASE_URL.trim().replace(/\/+$/, ""),
    llmApiKey: env.LLM_API_KEY.trim(),
    llmModel: env.LLM_MODEL?.trim() || "gpt-5.4",
    digestIntervalHours: toInt(env.DIGEST_INTERVAL_HOURS, 3, 1),
    heartbeatIntervalHours: toInt(env.HEARTBEAT_INTERVAL_HOURS, 24, 1),
    requestTimeoutMs: toInt(env.REQUEST_TIMEOUT_MS, 15_000, 1000),
    fetchWindowHours: toInt(env.FETCH_WINDOW_HOURS, 3, 1),
    maxItemsPerDigest: toInt(env.MAX_ITEMS_PER_DIGEST, 60, 1),
    failureAlertThreshold: toInt(env.FAILURE_ALERT_THRESHOLD, 1, 1),
    failureAlertCooldownMinutes: toInt(env.FAILURE_ALERT_COOLDOWN_MINUTES, 180, 1),
    jinshiHomeUrl: env.JINSHI_HOME_URL?.trim() || "https://www.jin10.com/",
    jinshiXnewsUrl: env.JINSHI_XNEWS_URL?.trim() || "https://xnews.jin10.com/"
  };
}
