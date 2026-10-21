export type DailySourceKind =
  | "RSS"
  | "AIHOT"
  | "GITHUB_RELEASES"
  | "GITHUB_REPO_EVENTS"
  | "HACKERNEWS"
  | "REDDIT"
  | "WEB_FEED";

export type DailyStoryClusterStatus = "PENDING" | "SELECTED" | "REJECTED";
export type DailyIssueStatus = "DRAFT" | "PUBLISHED" | "SKIPPED";
export type DailyIssueCategory =
  | "HEADLINES"
  | "MODEL_RELEASES"
  | "DEV_ECOSYSTEM"
  | "PRODUCT_UPDATES"
  | "TECH_INSIGHTS"
  | "RUMORS";
export type DailyIssueItemCertainty = "CONFIRMED" | "WATCHLIST" | "RUMOR";
export type DailyRunType = "SCAN" | "PUBLISH" | "BACKFILL" | "REPUBLISH" | "REBUILD_RSS";
export type DailyRunStatus = "RUNNING" | "SUCCESS" | "FAILED";
export type DailyRunStepStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export interface DailySourceView {
  id: string;
  name: string;
  kind: DailySourceKind;
  baseUrl: string | null;
  feedUrl: string | null;
  configJson: string | null;
  enabled: boolean;
  priority: number;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface DailySourceRuntimeConfig {
  id: string;
  name: string;
  kind: DailySourceKind;
  baseUrl: string | null;
  feedUrl: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  lastFetchedAt: Date | null;
}

export interface DailySourceItemView {
  id: string;
  sourceId: string;
  sourceItemKey: string;
  externalId: string | null;
  canonicalUrl: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  language: string | null;
  contentText: string | null;
  contentHtml: string | null;
  summaryRaw: string | null;
  metaJson: string | null;
  contentHash: string | null;
}

export interface DailyStoryClusterLinkView {
  id: string;
  clusterId: string;
  sourceItemId: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface DailyStoryClusterView {
  id: string;
  clusterKey: string;
  canonicalUrl: string;
  primarySourceItemId: string | null;
  title: string;
  publishedAt: string | null;
  score: number | null;
  status: DailyStoryClusterStatus;
  tagsJson: string | null;
  summaryDraft: string | null;
  editorialReason: string | null;
  createdAt: string;
  updatedAt: string;
  sourceItemCount: number;
  items?: DailyStoryClusterLinkView[];
}

export interface DailyIssueItemView {
  id: string;
  issueId: string;
  clusterId: string;
  category: DailyIssueCategory;
  certainty: DailyIssueItemCertainty;
  title: string;
  summary: string | null;
  content: string;
  sourceUrl: string;
  sourceName: string | null;
  tagsJson: string | null;
  sortOrder: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  sourceLinks: DailyIssueItemSourceLinkView[];
}

export interface DailyIssueItemSourceLinkView {
  id: string;
  issueItemId: string;
  url: string;
  label: string | null;
  sourceName: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface DailyIssueView {
  id: string;
  issueDate: string;
  slug: string;
  title: string;
  summary: string | null;
  coverImageUrl: string | null;
  status: DailyIssueStatus;
  publishedAt: string | null;
  sourceWindowStart: string | null;
  sourceWindowEnd: string | null;
  metaJson: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items?: DailyIssueItemView[];
}

export interface DailyIssueStatsView {
  publishedIssueCount: number;
  publishedItemCount: number;
  latestIssueDate: string | null;
}

export interface DailyInterestProfileView {
  id: string;
  name: string;
  includeKeywordsJson: string | null;
  excludeKeywordsJson: string | null;
  interestsText: string | null;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRunStepView {
  id: string;
  runId: string;
  stepName: string;
  status: DailyRunStepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
  payloadJson: string | null;
}

export interface DailyRunView {
  id: string;
  runType: DailyRunType;
  status: DailyRunStatus;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  errorMessage: string | null;
  statsJson: string | null;
  createdAt: string;
  stepCount: number;
  steps?: DailyRunStepView[];
}

export interface DailyMajorEventView {
  id: string;
  eventDate: string;
  title: string;
  summary: string;
  category: string;
  sourceUrl: string;
  sourceName: string | null;
  importanceScore: number;
  tagsJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDailySourceInput {
  name: string;
  kind: DailySourceKind;
  baseUrl?: string | null;
  feedUrl?: string | null;
  configJson?: string | null;
  enabled?: boolean;
  priority?: number;
}

export interface UpdateDailySourceInput {
  name?: string;
  kind?: DailySourceKind;
  baseUrl?: string | null;
  feedUrl?: string | null;
  configJson?: string | null;
  enabled?: boolean;
  priority?: number;
  lastFetchedAt?: Date | null;
}

export interface CreateDailyInterestProfileInput {
  name: string;
  includeKeywordsJson?: string | null;
  excludeKeywordsJson?: string | null;
  interestsText?: string | null;
  enabled?: boolean;
  priority?: number;
}

export interface UpdateDailyInterestProfileInput {
  name?: string;
  includeKeywordsJson?: string | null;
  excludeKeywordsJson?: string | null;
  interestsText?: string | null;
  enabled?: boolean;
  priority?: number;
}

export interface UpsertDailySourceItemInput {
  sourceId: string;
  sourceItemKey: string;
  externalId?: string | null;
  canonicalUrl: string;
  title: string;
  author?: string | null;
  publishedAt?: Date | null;
  fetchedAt?: Date;
  language?: string | null;
  contentText?: string | null;
  contentHtml?: string | null;
  summaryRaw?: string | null;
  metaJson?: string | null;
  contentHash?: string | null;
}

export interface UpsertDailyStoryClusterInput {
  clusterKey: string;
  canonicalUrl: string;
  primarySourceItemId?: string | null;
  title: string;
  publishedAt?: Date | null;
  score?: number | null;
  status?: DailyStoryClusterStatus;
  tagsJson?: string | null;
  summaryDraft?: string | null;
  editorialReason?: string | null;
}

export interface ReplaceDailyStoryClusterItemsInput {
  clusterId: string;
  items: Array<{
    sourceItemId: string;
    isPrimary?: boolean;
    sortOrder: number;
  }>;
}

export interface CreateDailyIssueDraftInput {
  issueDate: string;
  slug: string;
  title: string;
  summary?: string | null;
  coverImageUrl?: string | null;
  sourceWindowStart?: Date | null;
  sourceWindowEnd?: Date | null;
  metaJson?: string | null;
}

export interface ReplaceDailyIssueItemsInput {
  issueId: string;
  items: Array<{
    clusterId: string;
    category?: DailyIssueCategory;
    certainty?: DailyIssueItemCertainty;
    title: string;
    summary?: string | null;
    content: string;
    sourceUrl: string;
    sourceName?: string | null;
    tagsJson?: string | null;
    sortOrder: number;
    isFeatured?: boolean;
    sourceLinks?: Array<{
      url: string;
      label?: string | null;
      sourceName?: string | null;
      sortOrder: number;
    }>;
  }>;
}

export interface StartDailyRunInput {
  runType: DailyRunType;
  summary?: string | null;
  statsJson?: string | null;
}

export interface CreateDailyRunStepInput {
  runId: string;
  stepName: string;
  status?: DailyRunStepStatus;
  message?: string | null;
  payloadJson?: string | null;
}

export interface BuildDailyRssFeedOptions {
  baseUrl: string;
  siteTitle: string;
  siteDescription: string;
  language?: string;
  limit?: number;
}

export interface DailyScanResult {
  runId: string;
  outcome: "SUCCESS" | "PARTIAL";
  successfulSourceCount: number;
  failedSourceCount: number;
  fetchedSourceCount: number;
  fetchedItemCount: number;
  upsertedItemCount: number;
  affectedClusterCount: number;
}

export interface DailyPublishResult {
  runId: string;
  issueId: string | null;
  issueDate: string;
  status: DailyIssueStatus;
  selectedClusterCount: number;
  publishedItemCount: number;
  outcome?: "PUBLISHED" | "SKIPPED" | "PRESERVED";
}
