import type { Prisma } from "@/generated/prisma/client";
import { DailyStoryClusterStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/http/api-error";
import type {
  DailyStoryClusterLinkView,
  DailyStoryClusterView,
  ReplaceDailyStoryClusterItemsInput,
  UpsertDailyStoryClusterInput,
} from "@/types/daily";

const dailyStoryClusterInclude = {
  items: {
    orderBy: {
      sortOrder: "asc" as const,
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
};

type DailyStoryClusterRecord = Prisma.DailyStoryClusterGetPayload<{
  include: typeof dailyStoryClusterInclude;
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

function assertClusterStatus(status: string) {
  if (!(status in DailyStoryClusterStatus)) {
    throw new ApiError(400, `Unsupported daily cluster status: ${status}`, {
      reasonCode: "invalid_request_payload",
      retryable: false,
      target: status,
    });
  }
}

function presentClusterLink(item: DailyStoryClusterRecord["items"][number]): DailyStoryClusterLinkView {
  return {
    id: item.id,
    clusterId: item.clusterId,
    sourceItemId: item.sourceItemId,
    isPrimary: item.isPrimary,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
  };
}

function presentDailyStoryCluster(cluster: DailyStoryClusterRecord): DailyStoryClusterView {
  return {
    id: cluster.id,
    clusterKey: cluster.clusterKey,
    canonicalUrl: cluster.canonicalUrl,
    primarySourceItemId: cluster.primarySourceItemId,
    title: cluster.title,
    publishedAt: toIsoString(cluster.publishedAt),
    score: cluster.score ?? null,
    status: cluster.status,
    tagsJson: cluster.tagsJson,
    summaryDraft: cluster.summaryDraft,
    editorialReason: cluster.editorialReason,
    createdAt: cluster.createdAt.toISOString(),
    updatedAt: cluster.updatedAt.toISOString(),
    sourceItemCount: cluster._count.items,
    items: cluster.items.map(presentClusterLink),
  };
}

export async function listDailyStoryClusters(input?: {
  status?: DailyStoryClusterStatus;
  limit?: number;
}) {
  const clusters = await prisma.dailyStoryCluster.findMany({
    where: input?.status
      ? {
          status: input.status,
        }
      : undefined,
    include: dailyStoryClusterInclude,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: input?.limit ?? 100,
  });

  return clusters.map(presentDailyStoryCluster);
}

export async function getDailyStoryClusterById(id: string) {
  const cluster = await prisma.dailyStoryCluster.findUnique({
    where: { id },
    include: dailyStoryClusterInclude,
  });

  return cluster ? presentDailyStoryCluster(cluster) : null;
}

export async function upsertDailyStoryCluster(input: UpsertDailyStoryClusterInput) {
  if (input.status) {
    assertClusterStatus(input.status);
  }

  const cluster = await prisma.dailyStoryCluster.upsert({
    where: {
      clusterKey: requireNonEmpty(input.clusterKey, "Cluster key"),
    },
    update: {
      canonicalUrl: requireNonEmpty(input.canonicalUrl, "Canonical URL"),
      primarySourceItemId: input.primarySourceItemId ?? null,
      title: requireNonEmpty(input.title, "Cluster title"),
      publishedAt: input.publishedAt ?? null,
      score: input.score ?? null,
      status: input.status ? DailyStoryClusterStatus[input.status] : undefined,
      tagsJson: input.tagsJson ?? null,
      summaryDraft: input.summaryDraft ?? null,
      editorialReason: input.editorialReason ?? null,
    },
    create: {
      clusterKey: requireNonEmpty(input.clusterKey, "Cluster key"),
      canonicalUrl: requireNonEmpty(input.canonicalUrl, "Canonical URL"),
      primarySourceItemId: input.primarySourceItemId ?? null,
      title: requireNonEmpty(input.title, "Cluster title"),
      publishedAt: input.publishedAt ?? null,
      score: input.score ?? null,
      status: input.status ? DailyStoryClusterStatus[input.status] : DailyStoryClusterStatus.PENDING,
      tagsJson: input.tagsJson ?? null,
      summaryDraft: input.summaryDraft ?? null,
      editorialReason: input.editorialReason ?? null,
    },
    include: dailyStoryClusterInclude,
  });

  return presentDailyStoryCluster(cluster);
}

export async function replaceDailyStoryClusterItems(input: ReplaceDailyStoryClusterItemsInput) {
  const cluster = await prisma.dailyStoryCluster.findUnique({
    where: { id: input.clusterId },
    select: { id: true },
  });

  if (!cluster) {
    throw new ApiError(404, `Daily story cluster ${input.clusterId} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  const uniqueSourceItemIds = new Set<string>();
  const sortOrders = new Set<number>();

  for (const item of input.items) {
    if (uniqueSourceItemIds.has(item.sourceItemId)) {
      throw new ApiError(400, "Each source item can only appear once in a cluster.", {
        reasonCode: "invalid_request_payload",
        retryable: false,
      });
    }

    if (sortOrders.has(item.sortOrder)) {
      throw new ApiError(400, "Cluster item sort order must be unique.", {
        reasonCode: "invalid_request_payload",
        retryable: false,
      });
    }

    uniqueSourceItemIds.add(item.sourceItemId);
    sortOrders.add(item.sortOrder);
  }

  const existingSourceItems = await prisma.dailySourceItem.findMany({
    where: {
      id: {
        in: Array.from(uniqueSourceItemIds),
      },
    },
    select: { id: true },
  });

  if (existingSourceItems.length !== uniqueSourceItemIds.size) {
    throw new ApiError(400, "All cluster source items must already exist.", {
      reasonCode: "invalid_request_payload",
      retryable: false,
    });
  }

  const nextCluster = await prisma.$transaction(async (transaction) => {
    await transaction.dailyStoryClusterItem.deleteMany({
      where: {
        clusterId: input.clusterId,
      },
    });

    if (input.items.length > 0) {
      await transaction.dailyStoryClusterItem.createMany({
        data: input.items.map((item) => ({
          clusterId: input.clusterId,
          sourceItemId: item.sourceItemId,
          isPrimary: item.isPrimary ?? false,
          sortOrder: item.sortOrder,
        })),
      });
    }

    return transaction.dailyStoryCluster.findUniqueOrThrow({
      where: { id: input.clusterId },
      include: dailyStoryClusterInclude,
    });
  });

  return presentDailyStoryCluster(nextCluster);
}
