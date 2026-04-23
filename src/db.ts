import type { DigestRunRecord, JinshiDigestItem } from "./types";

function nowIso(now = new Date()): string {
  return now.toISOString();
}

export async function insertDigestRun(
  db: D1Database,
  input: {
    id: string;
    source: string;
    itemCount: number;
    aiAnalysis: boolean;
    messageText: string;
    analysisText?: string;
    sourceItems: JinshiDigestItem[];
    now?: Date;
  }
): Promise<void> {
  await db
    .prepare(`INSERT INTO digest_runs (
      id, created_at, source, item_count, ai_analysis, message_text, analysis_text, source_items_json, feishu_push_ok, push_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`)
    .bind(
      input.id,
      nowIso(input.now),
      input.source,
      input.itemCount,
      input.aiAnalysis ? 1 : 0,
      input.messageText,
      input.analysisText ?? null,
      JSON.stringify(input.sourceItems)
    )
    .run();
}

export async function markDigestRunPushed(db: D1Database, id: string, success: boolean, error?: string): Promise<void> {
  await db
    .prepare("UPDATE digest_runs SET feishu_push_ok = ?, push_error = ? WHERE id = ?")
    .bind(success ? 1 : 0, error ?? null, id)
    .run();
}

export async function listRecentDigestRuns(db: D1Database, limit = 20): Promise<DigestRunRecord[]> {
  const rows = await db
    .prepare("SELECT * FROM digest_runs ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<Record<string, unknown>>();

  return rows.results.map((row) => ({
    id: String(row.id),
    createdAt: String(row.created_at),
    source: String(row.source ?? ""),
    itemCount: Number(row.item_count ?? 0),
    aiAnalysis: Number(row.ai_analysis ?? 0) === 1,
    messageText: String(row.message_text ?? ""),
    analysisText: row.analysis_text ? String(row.analysis_text) : undefined,
    sourceItemsJson: String(row.source_items_json ?? "[]"),
    feishuPushOk: Number(row.feishu_push_ok ?? 0) === 1,
    pushError: row.push_error ? String(row.push_error) : undefined
  }));
}
