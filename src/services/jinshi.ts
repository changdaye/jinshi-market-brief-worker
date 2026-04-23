import type { BriefConfig, JinshiDigestItem, JinshiSnapshot } from "../types";
import { stripHtml } from "../lib/value";

export async function fetchJinshiSnapshot(config: BriefConfig, now = new Date()): Promise<JinshiSnapshot> {
  const [homepageHtml, xnewsHtml] = await Promise.all([
    fetchText(config.jinshiHomeUrl, config.requestTimeoutMs),
    fetchText(config.jinshiXnewsUrl, config.requestTimeoutMs)
  ]);

  const homepageFlashItems = parseHomepageFlashItems(homepageHtml, config.maxItemsPerDigest, now);
  const xnewsItems = parseXnewsItems(xnewsHtml, config.maxItemsPerDigest, now);
  const items = dedupeItems([...homepageFlashItems, ...xnewsItems])
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, config.maxItemsPerDigest);

  return { homepageFlashItems, xnewsItems, items };
}

export function parseHomepageFlashItems(html: string, maxItems = 60, _now = new Date()): JinshiDigestItem[] {
  const starts = Array.from(html.matchAll(/<div[^>]+id="flash(\d{14})\d*"[^>]*class="jin-flash-item-container[^\"]*"[^>]*>/g));
  const items: JinshiDigestItem[] = [];

  for (let index = 0; index < starts.length && items.length < maxItems; index++) {
    const match = starts[index];
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? html.length;
    const segment = html.slice(start, end);
    const title = extractFirst(segment, /class="flash-text">([\s\S]*?)<\/div>/)?.trim();
    const link = extractFirst(segment, /href="(https:\/\/xnews\.jin10\.com\/details\/\d+)"/);
    if (!title || !link) continue;

    items.push({
      id: `flash-${match[1]}`,
      sourceType: "flash",
      title: stripHtml(title),
      link,
      publishedAt: parseJinshiTimestampFromId(match[1]),
      important: /is-important/.test(segment),
      topic: stripMaybe(extractFirst(segment, /class="remark-item-title">([\s\S]*?)<\/span>/)),
      rawTimeText: formatFlashTime(match[1])
    });
  }

  return items;
}

export function parseXnewsItems(html: string, maxItems = 60, now = new Date()): JinshiDigestItem[] {
  const starts = Array.from(html.matchAll(/<div data-id="(\d+)"[^>]*class="jin10-news-list-item[^\"]*"[^>]*>/g));
  const items: JinshiDigestItem[] = [];

  for (let index = 0; index < starts.length && items.length < maxItems; index++) {
    const match = starts[index];
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? html.length;
    const segment = html.slice(start, end);
    const link = extractFirst(segment, /href="(https:\/\/xnews\.jin10\.com\/details\/\d+)"/);
    const title = stripMaybe(extractFirst(segment, /class="jin10-news-list-item-title">([\s\S]*?)<\/p>/));
    if (!link || !title) continue;
    const summary = stripMaybe(extractFirst(segment, /class="jin10-news-list-item-introduction">([\s\S]*?)<\/div>/));
    const rawTimeText = stripMaybe(extractFirst(segment, /class="jin10-news-list-item-display_datetime">[\s\S]*?<span>([^<]+)<\/span>/));
    items.push({
      id: `news-${match[1]}`,
      sourceType: "news",
      title,
      summary,
      link,
      publishedAt: parseRelativeTimeText(rawTimeText, now) ?? now.toISOString(),
      important: /jin10-news-img-new/.test(segment),
      topic: stripMaybe(extractFirst(segment, /来自：[\s\S]*?class="open-link">([\s\S]*?)<\/span>/)),
      rawTimeText
    });
  }

  return items;
}

export function parseJinshiTimestampFromId(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+08:00`;
}

export function parseRelativeTimeText(value: string | undefined, now = new Date()): string | undefined {
  if (!value) return undefined;
  const minuteMatch = value.match(/(\d+)分钟前/);
  if (minuteMatch) {
    return new Date(now.getTime() - Number(minuteMatch[1]) * 60_000).toISOString();
  }
  const hourMatch = value.match(/(\d+)小时前/);
  if (hourMatch) {
    return new Date(now.getTime() - Number(hourMatch[1]) * 60 * 60_000).toISOString();
  }
  const todayMatch = value.match(/今天\s*(\d{2}):(\d{2})/);
  if (todayMatch) {
    return `${toDatePrefix(now, 0)}T${todayMatch[1]}:${todayMatch[2]}:00+08:00`;
  }
  const yesterdayMatch = value.match(/昨天\s*(\d{2}):(\d{2})/);
  if (yesterdayMatch) {
    return `${toDatePrefix(now, -1)}T${yesterdayMatch[1]}:${yesterdayMatch[2]}:00+08:00`;
  }
  const monthDayMatch = value.match(/(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (monthDayMatch) {
    const year = now.getUTCFullYear();
    return `${year}-${monthDayMatch[1]}-${monthDayMatch[2]}T${monthDayMatch[3]}:${monthDayMatch[4]}:00+08:00`;
  }
  const fullDateMatch = value.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (fullDateMatch) {
    return `${fullDateMatch[1]}-${fullDateMatch[2]}-${fullDateMatch[3]}T${fullDateMatch[4]}:${fullDateMatch[5]}:00+08:00`;
  }
  return undefined;
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Jinshi fetch HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return text;
}

function extractFirst(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1];
}

function stripMaybe(value: string | undefined): string | undefined {
  return value ? stripHtml(value) : undefined;
}

function formatFlashTime(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)} +08:00`;
}

function dedupeItems(items: JinshiDigestItem[]): JinshiDigestItem[] {
  const seen = new Set<string>();
  const result: JinshiDigestItem[] = [];
  for (const item of items) {
    const key = `${item.sourceType}:${item.link}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function toDatePrefix(now: Date, dayOffset: number): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const shifted = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const parts = Object.fromEntries(formatter.formatToParts(shifted).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
