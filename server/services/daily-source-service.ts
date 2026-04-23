import type { Prisma } from "@/generated/prisma/client";
import { DailySourceKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/http/api-error";
import type {
  CreateDailySourceInput,
  DailySourceRuntimeConfig,
  DailySourceItemView,
  DailySourceView,
  UpdateDailySourceInput,
  UpsertDailySourceItemInput,
} from "@/types/daily";

const dailySourceInclude = {
  _count: {
    select: {
      items: true,
    },
  },
};

type DailySourceRecord = Prisma.DailySourceGetPayload<{
  include: typeof dailySourceInclude;
}>;

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function requireNonEmpty(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new ApiError(400, `${label} is required.`, {
      reasonCode: "invalid_request_payload",
      retryable: false,
    });
  }

  return normalized;
}

function normalizePriority(value: number | undefined) {
  if (value === undefined) {
    return 100;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new ApiError(400, "Priority must be a non-negative integer.", {
      reasonCode: "invalid_request_payload",
      retryable: false,
    });
  }

  return value;
}

function assertDailySourceKind(kind: string) {
  if (!(kind in DailySourceKind)) {
    throw new ApiError(400, `Unsupported daily source kind: ${kind}`, {
      reasonCode: "invalid_request_payload",
      retryable: false,
      target: kind,
    });
  }
}

function presentDailySource(source: DailySourceRecord): DailySourceView {
  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    baseUrl: source.baseUrl,
    feedUrl: source.feedUrl,
    configJson: source.configJson,
    enabled: source.enabled,
    priority: source.priority,
    lastFetchedAt: toIsoString(source.lastFetchedAt),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    itemCount: source._count.items,
  };
}

function presentDailySourceRuntimeConfig(source: {
  id: string;
  name: string;
  kind: keyof typeof DailySourceKind;
  baseUrl: string | null;
  feedUrl: string | null;
  configJson: string | null;
  enabled: boolean;
  priority: number;
  lastFetchedAt: Date | null;
}): DailySourceRuntimeConfig {
  let config: Record<string, unknown> = {};

  if (source.configJson?.trim()) {
    try {
      const parsed = JSON.parse(source.configJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>;
      }
    } catch {
      config = {};
    }
  }

  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    baseUrl: source.baseUrl,
    feedUrl: source.feedUrl,
    config,
    enabled: source.enabled,
    priority: source.priority,
    lastFetchedAt: source.lastFetchedAt,
  };
}

function presentDailySourceItem(item: {
  id: string;
  sourceId: string;
  sourceItemKey: string;
  externalId: string | null;
  canonicalUrl: string;
  title: string;
  author: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  language: string | null;
  contentText: string | null;
  contentHtml: string | null;
  summaryRaw: string | null;
  metaJson: string | null;
  contentHash: string | null;
}): DailySourceItemView {
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceItemKey: item.sourceItemKey,
    externalId: item.externalId,
    canonicalUrl: item.canonicalUrl,
    title: item.title,
    author: item.author,
    publishedAt: toIsoString(item.publishedAt),
    fetchedAt: item.fetchedAt.toISOString(),
    language: item.language,
    contentText: item.contentText,
    contentHtml: item.contentHtml,
    summaryRaw: item.summaryRaw,
    metaJson: item.metaJson,
    contentHash: item.contentHash,
  };
}

export async function listDailySources() {
  const sources = await prisma.dailySource.findMany({
    include: dailySourceInclude,
    orderBy: [{ enabled: "desc" }, { priority: "asc" }, { updatedAt: "desc" }],
  });

  return sources.map(presentDailySource);
}

export async function listEnabledDailySourcesForWorker() {
  const sources = await prisma.dailySource.findMany({
    where: {
      enabled: true,
    },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      baseUrl: true,
      feedUrl: true,
      configJson: true,
      enabled: true,
      priority: true,
      lastFetchedAt: true,
    },
  });

  return sources.map(presentDailySourceRuntimeConfig);
}

export async function getDailySourceById(id: string) {
  const source = await prisma.dailySource.findUnique({
    where: { id },
    include: dailySourceInclude,
  });

  return source ? presentDailySource(source) : null;
}

export async function createDailySource(input: CreateDailySourceInput) {
  assertDailySourceKind(input.kind);

  const source = await prisma.dailySource.create({
    data: {
      name: requireNonEmpty(input.name, "Daily source name"),
      kind: DailySourceKind[input.kind],
      baseUrl: input.baseUrl?.trim() || null,
      feedUrl: input.feedUrl?.trim() || null,
      configJson: input.configJson?.trim() || null,
      enabled: input.enabled ?? true,
      priority: normalizePriority(input.priority),
    },
    include: dailySourceInclude,
  });

  return presentDailySource(source);
}

export async function updateDailySource(id: string, input: UpdateDailySourceInput) {
  if (input.kind) {
    assertDailySourceKind(input.kind);
  }

  const existing = await prisma.dailySource.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, `Daily source ${id} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  const source = await prisma.dailySource.update({
    where: { id },
    data: {
      name: input.name !== undefined ? requireNonEmpty(input.name, "Daily source name") : undefined,
      kind: input.kind ? DailySourceKind[input.kind] : undefined,
      baseUrl: input.baseUrl !== undefined ? input.baseUrl?.trim() || null : undefined,
      feedUrl: input.feedUrl !== undefined ? input.feedUrl?.trim() || null : undefined,
      configJson: input.configJson !== undefined ? input.configJson?.trim() || null : undefined,
      enabled: input.enabled,
      priority: input.priority !== undefined ? normalizePriority(input.priority) : undefined,
      lastFetchedAt: input.lastFetchedAt !== undefined ? input.lastFetchedAt : undefined,
    },
    include: dailySourceInclude,
  });

  return presentDailySource(source);
}

export async function deleteDailySource(id: string) {
  const existing = await prisma.dailySource.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!existing) {
    throw new ApiError(404, `Daily source ${id} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  await prisma.dailySource.delete({
    where: { id },
  });

  return existing;
}

export async function listDailySourceItems(input?: {
  sourceId?: string;
  limit?: number;
}) {
  const items = await prisma.dailySourceItem.findMany({
    where: input?.sourceId
      ? {
          sourceId: input.sourceId,
        }
      : undefined,
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take: input?.limit ?? 100,
  });

  return items.map(presentDailySourceItem);
}

export async function upsertDailySourceItem(input: UpsertDailySourceItemInput) {
  const source = await prisma.dailySource.findUnique({
    where: { id: input.sourceId },
    select: { id: true },
  });

  if (!source) {
    throw new ApiError(404, `Daily source ${input.sourceId} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  const item = await prisma.dailySourceItem.upsert({
    where: {
      sourceItemKey: requireNonEmpty(input.sourceItemKey, "Source item key"),
    },
    update: {
      externalId: input.externalId?.trim() || null,
      canonicalUrl: requireNonEmpty(input.canonicalUrl, "Canonical URL"),
      title: requireNonEmpty(input.title, "Source item title"),
      author: input.author?.trim() || null,
      publishedAt: input.publishedAt ?? null,
      fetchedAt: input.fetchedAt ?? new Date(),
      language: input.language?.trim() || null,
      contentText: input.contentText ?? null,
      contentHtml: input.contentHtml ?? null,
      summaryRaw: input.summaryRaw ?? null,
      metaJson: input.metaJson ?? null,
      contentHash: input.contentHash?.trim() || null,
    },
    create: {
      sourceId: input.sourceId,
      sourceItemKey: requireNonEmpty(input.sourceItemKey, "Source item key"),
      externalId: input.externalId?.trim() || null,
      canonicalUrl: requireNonEmpty(input.canonicalUrl, "Canonical URL"),
      title: requireNonEmpty(input.title, "Source item title"),
      author: input.author?.trim() || null,
      publishedAt: input.publishedAt ?? null,
      fetchedAt: input.fetchedAt ?? new Date(),
      language: input.language?.trim() || null,
      contentText: input.contentText ?? null,
      contentHtml: input.contentHtml ?? null,
      summaryRaw: input.summaryRaw ?? null,
      metaJson: input.metaJson ?? null,
      contentHash: input.contentHash?.trim() || null,
    },
  });

  await prisma.dailySource.update({
    where: { id: input.sourceId },
    data: {
      lastFetchedAt: input.fetchedAt ?? new Date(),
    },
  });

  return presentDailySourceItem(item);
}
