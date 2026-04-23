import type { Prisma } from "@/generated/prisma/client";
import { DailyIssueStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/http/api-error";
import type {
  CreateDailyIssueDraftInput,
  DailyIssueItemView,
  DailyIssueItemSourceLinkView,
  DailyIssueStatsView,
  DailyIssueView,
  ReplaceDailyIssueItemsInput,
} from "@/types/daily";

const dailyIssueInclude = {
  items: {
    orderBy: {
      sortOrder: "asc" as const,
    },
    include: {
      sources: {
        orderBy: {
          sortOrder: "asc" as const,
        },
      },
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
};

type DailyIssueRecord = Prisma.DailyIssueGetPayload<{
  include: typeof dailyIssueInclude;
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

function assertDailyIssueStatus(status: string) {
  if (!(status in DailyIssueStatus)) {
    throw new ApiError(400, `Unsupported daily issue status: ${status}`, {
      reasonCode: "invalid_request_payload",
      retryable: false,
      target: status,
    });
  }
}

function presentDailyIssueItemSource(
  source: DailyIssueRecord["items"][number]["sources"][number],
): DailyIssueItemSourceLinkView {
  return {
    id: source.id,
    issueItemId: source.issueItemId,
    url: source.url,
    label: source.label,
    sourceName: source.sourceName,
    sortOrder: source.sortOrder,
    createdAt: source.createdAt.toISOString(),
  };
}

function presentDailyIssueItem(item: DailyIssueRecord["items"][number]): DailyIssueItemView {
  return {
    id: item.id,
    issueId: item.issueId,
    clusterId: item.clusterId,
    category: item.category,
    certainty: item.certainty,
    title: item.title,
    summary: item.summary,
    content: item.content,
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
    tagsJson: item.tagsJson,
    sortOrder: item.sortOrder,
    isFeatured: item.isFeatured,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    sourceLinks: item.sources.map(presentDailyIssueItemSource),
  };
}

function presentDailyIssue(issue: DailyIssueRecord): DailyIssueView {
  return {
    id: issue.id,
    issueDate: issue.issueDate,
    slug: issue.slug,
    title: issue.title,
    summary: issue.summary,
    coverImageUrl: issue.coverImageUrl,
    status: issue.status,
    publishedAt: toIsoString(issue.publishedAt),
    sourceWindowStart: toIsoString(issue.sourceWindowStart),
    sourceWindowEnd: toIsoString(issue.sourceWindowEnd),
    metaJson: issue.metaJson,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    itemCount: issue._count.items,
    items: issue.items.map(presentDailyIssueItem),
  };
}

export async function listDailyIssues(input?: {
  status?: DailyIssueStatus;
  limit?: number;
}) {
  if (input?.status) {
    assertDailyIssueStatus(input.status);
  }

  const issues = await prisma.dailyIssue.findMany({
    where: input?.status
      ? {
          status: input.status,
        }
      : undefined,
    include: dailyIssueInclude,
    orderBy: [{ issueDate: "desc" }, { updatedAt: "desc" }],
    take: input?.limit ?? 30,
  });

  return issues.map(presentDailyIssue);
}

export async function listPublishedDailyIssues(limit = 30) {
  return listDailyIssues({
    status: "PUBLISHED",
    limit,
  });
}

export async function getDailyIssueStats(): Promise<DailyIssueStatsView> {
  const [publishedIssueCount, publishedItemCount, latestIssue] = await Promise.all([
    prisma.dailyIssue.count({
      where: {
        status: DailyIssueStatus.PUBLISHED,
      },
    }),
    prisma.dailyIssueItem.count({
      where: {
        issue: {
          status: DailyIssueStatus.PUBLISHED,
        },
      },
    }),
    prisma.dailyIssue.findFirst({
      where: {
        status: DailyIssueStatus.PUBLISHED,
      },
      orderBy: {
        issueDate: "desc",
      },
      select: {
        issueDate: true,
      },
    }),
  ]);

  return {
    publishedIssueCount,
    publishedItemCount,
    latestIssueDate: latestIssue?.issueDate ?? null,
  };
}

export async function getDailyIssueById(id: string) {
  const issue = await prisma.dailyIssue.findUnique({
    where: { id },
    include: dailyIssueInclude,
  });

  return issue ? presentDailyIssue(issue) : null;
}

export async function getDailyIssueBySlug(slug: string) {
  const issue = await prisma.dailyIssue.findUnique({
    where: { slug },
    include: dailyIssueInclude,
  });

  return issue ? presentDailyIssue(issue) : null;
}

export async function getDailyIssueByDate(issueDate: string) {
  const issue = await prisma.dailyIssue.findUnique({
    where: { issueDate },
    include: dailyIssueInclude,
  });

  return issue ? presentDailyIssue(issue) : null;
}

export async function createDailyIssueDraft(input: CreateDailyIssueDraftInput) {
  const issue = await prisma.dailyIssue.create({
    data: {
      issueDate: requireNonEmpty(input.issueDate, "Issue date"),
      slug: requireNonEmpty(input.slug, "Daily issue slug"),
      title: requireNonEmpty(input.title, "Daily issue title"),
      summary: input.summary ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      status: DailyIssueStatus.DRAFT,
      sourceWindowStart: input.sourceWindowStart ?? null,
      sourceWindowEnd: input.sourceWindowEnd ?? null,
      metaJson: input.metaJson ?? null,
    },
    include: dailyIssueInclude,
  });

  return presentDailyIssue(issue);
}

export async function updateDailyIssueDraft(
  id: string,
  input: {
    title?: string;
    summary?: string | null;
    coverImageUrl?: string | null;
    sourceWindowStart?: Date | null;
    sourceWindowEnd?: Date | null;
    metaJson?: string | null;
  },
) {
  const issue = await prisma.dailyIssue.update({
    where: { id },
    data: {
      title: input.title !== undefined ? requireNonEmpty(input.title, "Daily issue title") : undefined,
      summary: input.summary !== undefined ? input.summary : undefined,
      coverImageUrl: input.coverImageUrl !== undefined ? input.coverImageUrl : undefined,
      sourceWindowStart: input.sourceWindowStart !== undefined ? input.sourceWindowStart : undefined,
      sourceWindowEnd: input.sourceWindowEnd !== undefined ? input.sourceWindowEnd : undefined,
      metaJson: input.metaJson !== undefined ? input.metaJson : undefined,
    },
    include: dailyIssueInclude,
  });

  return presentDailyIssue(issue);
}

export async function publishDailyIssue(id: string, publishedAt = new Date()) {
  const existing = await prisma.dailyIssue.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, `Daily issue ${id} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  const issue = await prisma.dailyIssue.update({
    where: { id },
    data: {
      status: DailyIssueStatus.PUBLISHED,
      publishedAt,
    },
    include: dailyIssueInclude,
  });

  return presentDailyIssue(issue);
}

export async function setDailyIssueStatus(id: string, status: DailyIssueStatus) {
  assertDailyIssueStatus(status);

  const issue = await prisma.dailyIssue.update({
    where: { id },
    data: {
      status: DailyIssueStatus[status],
      ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
    },
    include: dailyIssueInclude,
  });

  return presentDailyIssue(issue);
}

export async function replaceDailyIssueItems(input: ReplaceDailyIssueItemsInput) {
  const issue = await prisma.dailyIssue.findUnique({
    where: { id: input.issueId },
    select: { id: true },
  });

  if (!issue) {
    throw new ApiError(404, `Daily issue ${input.issueId} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  const uniqueClusterIds = new Set<string>();
  const sortOrders = new Set<number>();

  for (const item of input.items) {
    if (uniqueClusterIds.has(item.clusterId)) {
      throw new ApiError(400, "Each story cluster can only appear once in a daily issue.", {
        reasonCode: "invalid_request_payload",
        retryable: false,
      });
    }

    if (sortOrders.has(item.sortOrder)) {
      throw new ApiError(400, "Daily issue item sort order must be unique.", {
        reasonCode: "invalid_request_payload",
        retryable: false,
      });
    }

    uniqueClusterIds.add(item.clusterId);
    sortOrders.add(item.sortOrder);
  }

  const existingClusters = await prisma.dailyStoryCluster.findMany({
    where: {
      id: {
        in: Array.from(uniqueClusterIds),
      },
    },
    select: { id: true },
  });

  if (existingClusters.length !== uniqueClusterIds.size) {
    throw new ApiError(400, "All daily issue clusters must already exist.", {
      reasonCode: "invalid_request_payload",
      retryable: false,
    });
  }

  const nextIssue = await prisma.$transaction(async (transaction) => {
    await transaction.dailyIssueItemSource.deleteMany({
      where: {
        issueItem: {
          issueId: input.issueId,
        },
      },
    });

    await transaction.dailyIssueItem.deleteMany({
      where: {
        issueId: input.issueId,
      },
    });

    if (input.items.length > 0) {
      const createdIssueItems = await Promise.all(
        input.items.map((item) =>
          transaction.dailyIssueItem.create({
            data: {
              issueId: input.issueId,
              clusterId: item.clusterId,
              category: item.category ?? "TECH_INSIGHTS",
              certainty: item.certainty ?? "CONFIRMED",
              title: requireNonEmpty(item.title, "Daily issue item title"),
              summary: item.summary ?? null,
              content: requireNonEmpty(item.content, "Daily issue item content"),
              sourceUrl: requireNonEmpty(item.sourceUrl, "Daily issue item source URL"),
              sourceName: item.sourceName ?? null,
              tagsJson: item.tagsJson ?? null,
              sortOrder: item.sortOrder,
              isFeatured: item.isFeatured ?? false,
            },
            select: {
              id: true,
            },
          }),
        ),
      );

      const sourceRows = input.items.flatMap((item, index) => {
        const createdItem = createdIssueItems[index];
        const normalizedSourceLinks = item.sourceLinks && item.sourceLinks.length > 0
          ? item.sourceLinks
          : [
              {
                url: item.sourceUrl,
                label: item.sourceName ?? "来源 1",
                sourceName: item.sourceName ?? null,
                sortOrder: 1,
              },
            ];

        return normalizedSourceLinks.map((sourceLink) => ({
          issueItemId: createdItem.id,
          url: requireNonEmpty(sourceLink.url, "Daily issue item source link URL"),
          label: sourceLink.label?.trim() || null,
          sourceName: sourceLink.sourceName?.trim() || null,
          sortOrder: sourceLink.sortOrder,
        }));
      });

      if (sourceRows.length > 0) {
        await transaction.dailyIssueItemSource.createMany({
          data: sourceRows,
        });
      }
    }

    return transaction.dailyIssue.findUniqueOrThrow({
      where: { id: input.issueId },
      include: dailyIssueInclude,
    });
  });

  return presentDailyIssue(nextIssue);
}

export async function updateDailyIssueItemText(
  id: string,
  input: {
    title?: string;
    summary?: string | null;
    content?: string;
  },
) {
  const item = await prisma.dailyIssueItem.update({
    where: { id },
    data: {
      title: input.title !== undefined ? requireNonEmpty(input.title, "Daily issue item title") : undefined,
      summary: input.summary !== undefined ? input.summary : undefined,
      content: input.content !== undefined ? requireNonEmpty(input.content, "Daily issue item content") : undefined,
    },
    include: {
      sources: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  return {
    id: item.id,
    issueId: item.issueId,
    clusterId: item.clusterId,
    category: item.category,
    certainty: item.certainty,
    title: item.title,
    summary: item.summary,
    content: item.content,
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
    tagsJson: item.tagsJson,
    sortOrder: item.sortOrder,
    isFeatured: item.isFeatured,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    sourceLinks: item.sources.map(presentDailyIssueItemSource),
  } satisfies DailyIssueItemView;
}
