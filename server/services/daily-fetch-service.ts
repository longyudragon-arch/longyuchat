import { createHash } from "node:crypto";

import { ApiError } from "@/server/http/api-error";
import type { DailySourceRuntimeConfig, UpsertDailySourceItemInput } from "@/types/daily";

interface FeedItem {
  externalId?: string | null;
  canonicalUrl: string;
  title: string;
  author?: string | null;
  publishedAt?: Date | null;
  language?: string | null;
  contentText?: string | null;
  contentHtml?: string | null;
  summaryRaw?: string | null;
  metaJson?: string | null;
}

interface AihotPublicItem {
  id: string;
  title: string;
  title_en?: string | null;
  url: string;
  source: string;
  publishedAt?: string | null;
  summary?: string | null;
  category?: string | null;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"].forEach((key) =>
      url.searchParams.delete(key),
    );
    return url.toString();
  } catch {
    return value.trim();
  }
}

function buildSourceItemKey(sourceId: string, externalId: string | null | undefined, canonicalUrl: string, title: string) {
  const base = externalId?.trim() || canonicalUrl.trim() || title.trim();
  const hash = createHash("sha1").update(base).digest("hex");
  return `${sourceId}:${hash}`;
}

function toContentHash(title: string, contentText: string | null | undefined) {
  const hash = createHash("sha1")
    .update(`${title.trim()}\n${(contentText ?? "").trim()}`)
    .digest("hex");

  return hash;
}

function parseDate(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractTagContent(block: string, tagName: string) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

function extractAtomLink(block: string) {
  const match = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

function parseRssItems(xml: string): FeedItem[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const items: FeedItem[] = [];

  for (const block of itemBlocks) {
    const title = extractTagContent(block, "title");
    const link = extractTagContent(block, "link");

    if (!title || !link) {
      continue;
    }

    const description = extractTagContent(block, "description");
    const contentEncoded = extractTagContent(block, "content:encoded");
    const author =
      extractTagContent(block, "author") ??
      extractTagContent(block, "dc:creator");
    const externalId = extractTagContent(block, "guid") ?? link;
    const contentHtml = contentEncoded ?? description;
    const contentText = contentHtml ? stripHtml(contentHtml) : null;

    items.push({
      externalId,
      canonicalUrl: normalizeUrl(link),
      title: stripHtml(title),
      author,
      publishedAt: parseDate(extractTagContent(block, "pubDate")),
      contentHtml,
      contentText,
      summaryRaw: contentText,
    });
  }

  return items;
}

function parseAtomEntries(xml: string): FeedItem[] {
  const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items: FeedItem[] = [];

  for (const block of entryBlocks) {
    const title = extractTagContent(block, "title");
    const link = extractAtomLink(block);

    if (!title || !link) {
      continue;
    }

    const summary = extractTagContent(block, "summary");
    const content = extractTagContent(block, "content");
    const contentHtml = content ?? summary;
    const contentText = contentHtml ? stripHtml(contentHtml) : null;
    const authorBlock = block.match(/<author\b[\s\S]*?<\/author>/i)?.[0] ?? "";
    const author = extractTagContent(authorBlock, "name");

    items.push({
      externalId: extractTagContent(block, "id") ?? link,
      canonicalUrl: normalizeUrl(link),
      title: stripHtml(title),
      author,
      publishedAt: parseDate(extractTagContent(block, "published") ?? extractTagContent(block, "updated")),
      contentHtml,
      contentText,
      summaryRaw: contentText,
    });
  }

  return items;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LongyuChat-AI-Daily/1.0 (+https://github.com/longyudragon-arch/longyuchat)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(502, `Failed to fetch source: ${url} (${response.status})`);
  }

  return response.text();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LongyuChat-AI-Daily/1.0 (+https://github.com/longyudragon-arch/longyuchat)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(502, `Failed to fetch source: ${url} (${response.status})`);
  }

  return (await response.json()) as T;
}

async function fetchAihotJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(502, `Failed to fetch AI HOT source: ${url} (${response.status})`);
  }

  return (await response.json()) as T;
}

function resolveFeedUrl(source: DailySourceRuntimeConfig) {
  if (source.feedUrl) {
    return source.feedUrl;
  }

  if (!source.baseUrl) {
    throw new ApiError(400, `Daily source ${source.name} is missing feedUrl/baseUrl.`);
  }

  const normalizedBaseUrl = source.baseUrl.replace(/\/+$/, "");

  if (source.kind === "GITHUB_RELEASES") {
    return `${normalizedBaseUrl}/releases.atom`;
  }

  if (source.kind === "GITHUB_REPO_EVENTS") {
    if (/github\.com\/[^/]+$/i.test(normalizedBaseUrl)) {
      return `${normalizedBaseUrl}.atom`;
    }

    throw new ApiError(400, `Daily source ${source.name} requires an explicit feedUrl for GITHUB_REPO_EVENTS.`);
  }

  return normalizedBaseUrl;
}

async function fetchFeedSource(source: DailySourceRuntimeConfig) {
  const xml = await fetchText(resolveFeedUrl(source));
  const items = xml.includes("<feed") ? parseAtomEntries(xml) : parseRssItems(xml);
  const limit = typeof source.config.limit === "number" ? source.config.limit : 20;
  return items.slice(0, limit);
}

function normalizeAihotMode(value: unknown) {
  return value === "all" ? "all" : "selected";
}

function normalizeAihotTake(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return 50;
  }

  return Math.min(100, Math.max(1, value));
}

function normalizeAihotLookbackHours(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 48;
  }

  return Math.min(24 * 7, Math.max(1, value));
}

async function fetchAihotSource(source: DailySourceRuntimeConfig) {
  const baseUrl = (source.baseUrl ?? "https://aihot.virxact.com").replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/api/public/items`);
  const lookbackHours = normalizeAihotLookbackHours(source.config.lookbackHours);
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  const category = typeof source.config.category === "string" ? source.config.category.trim() : "";

  url.searchParams.set("mode", normalizeAihotMode(source.config.mode));
  url.searchParams.set("take", String(normalizeAihotTake(source.config.take)));
  url.searchParams.set("since", since);

  if (category) {
    url.searchParams.set("category", category);
  }

  const payload = await fetchAihotJson<{
    items?: AihotPublicItem[];
  }>(url.toString());

  return (payload.items ?? [])
    .filter((item) => item.title?.trim() && item.url?.trim())
    .map((item) => ({
      externalId: item.id,
      canonicalUrl: normalizeUrl(item.url),
      title: item.title.trim(),
      author: item.source?.trim() || null,
      publishedAt: parseDate(item.publishedAt),
      language: "zh-CN",
      contentText: item.summary?.trim() || null,
      summaryRaw: item.summary?.trim() || null,
      metaJson: JSON.stringify({
        provider: "aihot",
        sourceName: item.source?.trim() || null,
        category: item.category ?? null,
        titleEn: item.title_en ?? null,
      }),
    } satisfies FeedItem));
}

async function fetchHackerNewsSource(source: DailySourceRuntimeConfig) {
  const storyList = typeof source.config.storyList === "string" ? source.config.storyList : "topstories";
  const limit = typeof source.config.limit === "number" ? source.config.limit : 20;
  const minScore = typeof source.config.minScore === "number" ? source.config.minScore : 0;
  const ids = await fetchJson<number[]>(`https://hacker-news.firebaseio.com/v0/${storyList}.json`);
  const selectedIds = ids.slice(0, limit);

  const stories = await Promise.all(
    selectedIds.map((id) => fetchJson<Record<string, unknown>>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)),
  );

  return stories
    .filter((story) => typeof story.title === "string" && typeof story.score === "number" && story.score >= minScore)
    .map((story) => {
      const url =
        typeof story.url === "string" && story.url.trim()
          ? story.url
          : `https://news.ycombinator.com/item?id=${story.id}`;
      const score = typeof story.score === "number" ? story.score : 0;

      return {
        externalId: String(story.id),
        canonicalUrl: normalizeUrl(url),
        title: String(story.title),
        author: typeof story.by === "string" ? story.by : null,
        publishedAt: typeof story.time === "number" ? new Date(story.time * 1000) : null,
        contentText: typeof story.text === "string" ? stripHtml(story.text) : `Hacker News score: ${score}`,
        summaryRaw: typeof story.text === "string" ? stripHtml(story.text) : `Hacker News score: ${score}`,
        metaJson: JSON.stringify({ score }),
      } satisfies FeedItem;
    });
}

async function fetchRedditSource(source: DailySourceRuntimeConfig) {
  const subreddit = typeof source.config.subreddit === "string" ? source.config.subreddit : "MachineLearning";
  const sort = typeof source.config.sort === "string" ? source.config.sort : "hot";
  const limit = typeof source.config.limit === "number" ? source.config.limit : 20;
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${encodeURIComponent(sort)}.json?limit=${limit}`;
  const payload = await fetchJson<{
    data?: {
      children?: Array<{
        data?: Record<string, unknown>;
      }>;
    };
  }>(url);
  const children = payload.data?.children ?? [];

  return children
    .map((child) => child.data ?? {})
    .filter((entry) => typeof entry.title === "string" && typeof entry.permalink === "string")
    .map((entry) => {
      const permalink = `https://www.reddit.com${String(entry.permalink)}`;
      const selftext = typeof entry.selftext === "string" ? entry.selftext : "";

      return {
        externalId: typeof entry.id === "string" ? entry.id : permalink,
        canonicalUrl: normalizeUrl(permalink),
        title: String(entry.title),
        author: typeof entry.author === "string" ? entry.author : null,
        publishedAt: typeof entry.created_utc === "number" ? new Date(Number(entry.created_utc) * 1000) : null,
        contentText: selftext.trim() || null,
        summaryRaw: selftext.trim() || null,
        metaJson: JSON.stringify({
          subreddit,
          score: typeof entry.score === "number" ? entry.score : null,
          comments: typeof entry.num_comments === "number" ? entry.num_comments : null,
        }),
      } satisfies FeedItem;
    });
}

function heuristicLanguage(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return /[\u4e00-\u9fff]/.test(value) ? "zh-CN" : "en";
}

function toSourceItemInput(source: DailySourceRuntimeConfig, item: FeedItem): UpsertDailySourceItemInput {
  const canonicalUrl = normalizeUrl(item.canonicalUrl);
  const contentText = item.contentText?.trim() || null;
  const title = item.title.trim();
  const fetchedAt = new Date();

  return {
    sourceId: source.id,
    sourceItemKey: buildSourceItemKey(source.id, item.externalId ?? null, canonicalUrl, title),
    externalId: item.externalId?.trim() || null,
    canonicalUrl,
    title,
    author: item.author?.trim() || null,
    publishedAt: item.publishedAt ?? null,
    fetchedAt,
    language: item.language ?? heuristicLanguage(`${title}\n${contentText ?? ""}`),
    contentText,
    contentHtml: item.contentHtml ?? null,
    summaryRaw: item.summaryRaw?.trim() || contentText,
    metaJson: item.metaJson ?? null,
    contentHash: toContentHash(title, contentText),
  };
}

export async function fetchDailySourceItems(source: DailySourceRuntimeConfig) {
  let items: FeedItem[];

  switch (source.kind) {
    case "AIHOT":
      items = await fetchAihotSource(source);
      break;
    case "RSS":
    case "WEB_FEED":
    case "GITHUB_RELEASES":
    case "GITHUB_REPO_EVENTS":
      items = await fetchFeedSource(source);
      break;
    case "HACKERNEWS":
      items = await fetchHackerNewsSource(source);
      break;
    case "REDDIT":
      items = await fetchRedditSource(source);
      break;
    default:
      throw new ApiError(400, `Unsupported daily source kind: ${source.kind}`);
  }

  return items.map((item) => toSourceItemInput(source, item));
}
