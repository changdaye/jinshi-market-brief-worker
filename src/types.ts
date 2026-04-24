export interface Env {
  AI: Ai;
  RUNTIME_KV: KVNamespace;
  BRIEF_DB: D1Database;
  FEISHU_WEBHOOK: string;
  FEISHU_SECRET?: string;
  MANUAL_TRIGGER_TOKEN?: string;
  TENCENT_COS_SECRET_ID: string;
  TENCENT_COS_SECRET_KEY: string;
  TENCENT_COS_BUCKET: string;
  TENCENT_COS_REGION: string;
  TENCENT_COS_BASE_URL?: string;
  LLM_MODEL?: string;
  DIGEST_INTERVAL_HOURS?: string;
  HEARTBEAT_INTERVAL_HOURS?: string;
  REQUEST_TIMEOUT_MS?: string;
  FETCH_WINDOW_HOURS?: string;
  MAX_ITEMS_PER_DIGEST?: string;
  FAILURE_ALERT_THRESHOLD?: string;
  FAILURE_ALERT_COOLDOWN_MINUTES?: string;
  JINSHI_HOME_URL?: string;
  JINSHI_XNEWS_URL?: string;
}

export interface BriefConfig {
  feishuWebhook: string;
  feishuSecret: string;
  manualTriggerToken: string;
  cosSecretId: string;
  cosSecretKey: string;
  cosBucket: string;
  cosRegion: string;
  cosBaseUrl: string;
  llmModel: string;
  digestIntervalHours: number;
  heartbeatIntervalHours: number;
  requestTimeoutMs: number;
  fetchWindowHours: number;
  maxItemsPerDigest: number;
  failureAlertThreshold: number;
  failureAlertCooldownMinutes: number;
  jinshiHomeUrl: string;
  jinshiXnewsUrl: string;
}

export type SourceItemType = "flash" | "news";

export interface JinshiDigestItem {
  id: string;
  sourceType: SourceItemType;
  title: string;
  summary?: string;
  link: string;
  publishedAt: string;
  important: boolean;
  topic?: string;
  rawTimeText?: string;
}

export interface JinshiSnapshot {
  homepageFlashItems: JinshiDigestItem[];
  xnewsItems: JinshiDigestItem[];
  items: JinshiDigestItem[];
}

export interface RuntimeState {
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastHeartbeatAt?: string;
  lastAlertAt?: string;
  lastError?: string;
  quietDigestCount?: number;
  quietDigestStartedAt?: string;
  quietDigestLastAt?: string;
  consecutiveFailures: number;
}

export interface DigestRunRecord {
  id: string;
  createdAt: string;
  source: string;
  itemCount: number;
  aiAnalysis: boolean;
  messageText: string;
  analysisText?: string;
  sourceItemsJson: string;
  feishuPushOk: boolean;
  pushError?: string;
}
