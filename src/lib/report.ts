import type { JinshiDigestItem } from "../types";

const PROJECT_PREFIX = "jinshi-market-brief-worker";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMultilineText(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

export function buildDetailedReport(
  analysis: string,
  items: JinshiDigestItem[],
  aiAnalysis: boolean,
  now = new Date()
): string {
  const detailCards = items.map((item, index) => `
      <article class="item-card">
        <h3>${index + 1}. ${escapeHtml(item.title)}</h3>
        <dl>
          <div><dt>类型</dt><dd>${item.sourceType === "flash" ? "快讯" : "文章"}</dd></div>
          <div><dt>是否重点</dt><dd>${item.important ? "是" : "否"}</dd></div>
          ${item.rawTimeText ? `<div><dt>页面时间</dt><dd>${escapeHtml(item.rawTimeText)}</dd></div>` : ""}
          <div><dt>发布时间</dt><dd>${escapeHtml(item.publishedAt)}</dd></div>
          ${item.topic ? `<div><dt>主题</dt><dd>${escapeHtml(item.topic)}</dd></div>` : ""}
          <div><dt>链接</dt><dd><a href="${escapeHtml(item.link)}">${escapeHtml(item.link)}</a></dd></div>
          ${item.summary ? `<div><dt>摘要</dt><dd>${formatMultilineText(item.summary)}</dd></div>` : ""}
        </dl>
      </article>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>金十市场简报详细版</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; margin: 0; background: #f5f7fb; color: #1f2937; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 32px 20px 48px; }
    .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); margin-bottom: 20px; }
    h1, h2, h3 { margin-top: 0; }
    .meta { color: #64748b; line-height: 1.9; }
    .summary { line-height: 1.8; font-size: 16px; }
    .item-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin-top: 16px; }
    dl { margin: 0; display: grid; gap: 10px; }
    dt { font-weight: 700; }
    dd { margin: 4px 0 0; color: #334155; line-height: 1.8; }
    a { color: #2563eb; word-break: break-all; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="card">
      <h1>金十市场简报详细版</h1>
      <div class="meta">
        <div><strong>生成时间：</strong>${escapeHtml(now.toISOString())}</div>
        <div><strong>条目数量：</strong>${items.length}</div>
        <div><strong>AI 摘要：</strong>${aiAnalysis ? "是" : "否（使用回退摘要）"}</div>
      </div>
    </section>

    <section class="card">
      <h2>简报摘要</h2>
      <div class="summary">${formatMultilineText(analysis)}</div>
    </section>

    <section class="card">
      <h2>重点条目明细</h2>
      ${detailCards || "<p>本轮没有可展示的条目。</p>"}
    </section>
  </div>
</body>
</html>
`;
}

export function buildDetailedReportObjectKey(now = new Date()): string {
  const stamp = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds())
  ].join("");

  return `${PROJECT_PREFIX}/${stamp}.html`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
