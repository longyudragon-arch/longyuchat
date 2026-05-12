import { prisma } from "@/lib/prisma";
import type { DailyMajorEventView } from "@/types/daily";

interface DailyMajorEventSeed {
  eventDate: string;
  title: string;
  summary: string;
  category: string;
  sourceUrl: string;
  sourceName?: string | null;
  importanceScore: number;
  tags?: string[];
}

interface AihotDailyItem {
  title: string;
  summary?: string | null;
  sourceUrl: string;
  sourceName?: string | null;
}

interface AihotDailyResponse {
  date: string;
  lead?: {
    title?: string | null;
    leadParagraph?: string | null;
  } | null;
  sections?: Array<{
    label: string;
    items: AihotDailyItem[];
  }>;
}

const defaultMajorEvents: DailyMajorEventSeed[] = [
  {
    eventDate: "2022-11-30",
    title: "ChatGPT 正式发布",
    summary: "OpenAI 发布 ChatGPT，把对话式大模型从研究演示推向大众产品，随后成为生成式 AI 应用爆发的起点。",
    category: "product",
    sourceUrl: "https://openai.com/index/chatgpt/",
    sourceName: "OpenAI",
    importanceScore: 100,
    tags: ["OpenAI", "ChatGPT"],
  },
  {
    eventDate: "2023-03-14",
    title: "GPT-4 发布",
    summary: "OpenAI 发布 GPT-4，显著提升复杂推理、代码和多模态理解能力，成为 2023 年大模型竞赛的关键节点。",
    category: "model",
    sourceUrl: "https://openai.com/index/gpt-4-research/",
    sourceName: "OpenAI",
    importanceScore: 98,
    tags: ["OpenAI", "GPT-4"],
  },
  {
    eventDate: "2023-07-18",
    title: "Meta 发布 Llama 2",
    summary: "Meta 发布 Llama 2 并开放商用许可，推动开源大模型生态进入更快迭代周期。",
    category: "model",
    sourceUrl: "https://ai.meta.com/blog/llama-2/",
    sourceName: "Meta AI",
    importanceScore: 94,
    tags: ["Meta", "Llama"],
  },
  {
    eventDate: "2023-11-06",
    title: "OpenAI DevDay 发布 GPT-4 Turbo 和 GPTs",
    summary: "OpenAI 在首届 DevDay 发布 GPT-4 Turbo、Assistants API 和 GPTs，标志着大模型平台化和 Agent 工作流进入主流开发者视野。",
    category: "developer",
    sourceUrl: "https://openai.com/index/new-models-and-developer-products-announced-at-devday/",
    sourceName: "OpenAI",
    importanceScore: 95,
    tags: ["OpenAI", "DevDay", "GPT-4 Turbo"],
  },
  {
    eventDate: "2024-02-15",
    title: "OpenAI 发布 Sora",
    summary: "OpenAI 发布文本生成视频模型 Sora，把视频生成的时长、一致性和物理感推到新的关注高度。",
    category: "model",
    sourceUrl: "https://openai.com/index/sora/",
    sourceName: "OpenAI",
    importanceScore: 96,
    tags: ["OpenAI", "Sora", "Video"],
  },
  {
    eventDate: "2024-03-04",
    title: "Anthropic 发布 Claude 3 系列",
    summary: "Anthropic 发布 Claude 3 Haiku、Sonnet 和 Opus，模型能力、速度和多模态体验全面升级。",
    category: "model",
    sourceUrl: "https://www.anthropic.com/news/claude-3-family",
    sourceName: "Anthropic",
    importanceScore: 92,
    tags: ["Anthropic", "Claude"],
  },
  {
    eventDate: "2024-05-13",
    title: "OpenAI 发布 GPT-4o",
    summary: "OpenAI 发布 GPT-4o，强调原生多模态、实时语音和更低延迟，推动 AI 助手从文本工具向实时交互入口演进。",
    category: "model",
    sourceUrl: "https://openai.com/index/hello-gpt-4o/",
    sourceName: "OpenAI",
    importanceScore: 95,
    tags: ["OpenAI", "GPT-4o"],
  },
  {
    eventDate: "2024-06-20",
    title: "Anthropic 发布 Claude 3.5 Sonnet",
    summary: "Anthropic 发布 Claude 3.5 Sonnet，在代码、视觉和长上下文工作流上形成强竞争力，成为 2024 年开发者常用模型之一。",
    category: "model",
    sourceUrl: "https://www.anthropic.com/news/claude-3-5-sonnet",
    sourceName: "Anthropic",
    importanceScore: 91,
    tags: ["Anthropic", "Claude 3.5 Sonnet"],
  },
  {
    eventDate: "2024-07-23",
    title: "Meta 发布 Llama 3.1",
    summary: "Meta 发布 Llama 3.1 系列，405B 模型把开源模型能力推到新的规模区间，进一步拉动本地和私有化部署生态。",
    category: "model",
    sourceUrl: "https://ai.meta.com/blog/meta-llama-3-1/",
    sourceName: "Meta AI",
    importanceScore: 91,
    tags: ["Meta", "Llama 3.1"],
  },
  {
    eventDate: "2024-09-12",
    title: "OpenAI 发布 o1 推理模型",
    summary: "OpenAI 发布 o1-preview 和 o1-mini，把显式推理能力推到前台，强化复杂数学、编程和科学问题求解。",
    category: "model",
    sourceUrl: "https://openai.com/index/introducing-openai-o1-preview/",
    sourceName: "OpenAI",
    importanceScore: 94,
    tags: ["OpenAI", "o1", "Reasoning"],
  },
  {
    eventDate: "2025-01-20",
    title: "DeepSeek-R1 发布",
    summary: "DeepSeek 发布 R1 推理模型，引发业界对开源推理模型、训练成本和模型效率的集中讨论。",
    category: "model",
    sourceUrl: "https://github.com/deepseek-ai/DeepSeek-R1",
    sourceName: "DeepSeek",
    importanceScore: 96,
    tags: ["DeepSeek", "R1", "Reasoning"],
  },
  {
    eventDate: "2025-02-27",
    title: "OpenAI 发布 GPT-4.5",
    summary: "OpenAI 发布 GPT-4.5，强化更自然的对话、知识和写作体验，成为 GPT-4 到下一代模型之间的重要升级。",
    category: "model",
    sourceUrl: "https://openai.com/index/introducing-gpt-4-5/",
    sourceName: "OpenAI",
    importanceScore: 90,
    tags: ["OpenAI", "GPT-4.5"],
  },
  {
    eventDate: "2026-04-24",
    title: "GPT-5.5 正式发布",
    summary: "OpenAI 发布 GPT-5.5，AI HOT 当日将其列为行业重点事件；这类模型代际更新应进入年度 AI 大事件时间线。",
    category: "model",
    sourceUrl: "https://openai.com/index/introducing-gpt-5-5",
    sourceName: "OpenAI",
    importanceScore: 97,
    tags: ["OpenAI", "GPT-5.5"],
  },
];

function presentDailyMajorEvent(event: {
  id: string;
  eventDate: string;
  title: string;
  summary: string;
  category: string;
  sourceUrl: string;
  sourceName: string | null;
  importanceScore: number;
  tagsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DailyMajorEventView {
  return {
    id: event.id,
    eventDate: event.eventDate,
    title: event.title,
    summary: event.summary,
    category: event.category,
    sourceUrl: event.sourceUrl,
    sourceName: event.sourceName,
    importanceScore: event.importanceScore,
    tagsJson: event.tagsJson,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function toFallbackView(event: DailyMajorEventSeed, index: number): DailyMajorEventView {
  const now = new Date(0).toISOString();

  return {
    id: `seed-${event.eventDate}-${index}`,
    eventDate: event.eventDate,
    title: event.title,
    summary: event.summary,
    category: event.category,
    sourceUrl: event.sourceUrl,
    sourceName: event.sourceName ?? null,
    importanceScore: event.importanceScore,
    tagsJson: event.tags ? JSON.stringify(event.tags) : null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getDefaultDailyMajorEventDefinitions() {
  return defaultMajorEvents;
}

export async function listDailyMajorEvents(input?: {
  year?: string | null;
  limit?: number;
  order?: "asc" | "desc";
  minimumImportanceScore?: number;
}) {
  const year = input?.year?.trim();
  const order = input?.order ?? "asc";
  const limit = input?.limit ?? 100;
  const minimumImportanceScore = input?.minimumImportanceScore;
  const where = {
    ...(year
      ? {
          eventDate: {
            gte: `${year}-01-01`,
            lte: `${year}-12-31`,
          },
        }
      : {}),
    ...(typeof minimumImportanceScore === "number"
      ? {
          importanceScore: {
            gte: minimumImportanceScore,
          },
        }
      : {}),
  };

  const events = await prisma.dailyMajorEvent.findMany({
    where,
    orderBy: [{ eventDate: order }, { importanceScore: "desc" }],
    take: limit,
  });

  if (events.length > 0) {
    return events.map(presentDailyMajorEvent);
  }

  return defaultMajorEvents
    .filter((event) => !year || event.eventDate.startsWith(`${year}-`))
    .filter((event) => typeof minimumImportanceScore !== "number" || event.importanceScore >= minimumImportanceScore)
    .sort((a, b) => order === "asc" ? a.eventDate.localeCompare(b.eventDate) : b.eventDate.localeCompare(a.eventDate))
    .slice(0, limit)
    .map(toFallbackView);
}

export async function seedDefaultDailyMajorEvents() {
  const created: DailyMajorEventView[] = [];

  for (const event of defaultMajorEvents) {
    const next = await prisma.dailyMajorEvent.upsert({
      where: {
        eventDate_title: {
          eventDate: event.eventDate,
          title: event.title,
        },
      },
      update: {
        summary: event.summary,
        category: event.category,
        sourceUrl: event.sourceUrl,
        sourceName: event.sourceName ?? null,
        importanceScore: event.importanceScore,
        tagsJson: event.tags ? JSON.stringify(event.tags) : null,
      },
      create: {
        eventDate: event.eventDate,
        title: event.title,
        summary: event.summary,
        category: event.category,
        sourceUrl: event.sourceUrl,
        sourceName: event.sourceName ?? null,
        importanceScore: event.importanceScore,
        tagsJson: event.tags ? JSON.stringify(event.tags) : null,
      },
    });

    created.push(presentDailyMajorEvent(next));
  }

  return created;
}

function looksLikeMajorEvent(title: string, summary?: string | null) {
  const haystack = `${title}\n${summary ?? ""}`.toLowerCase();
  return [
    "gpt-5",
    "gpt-4",
    "claude",
    "gemini",
    "deepseek-r",
    "deepseek-v",
    "qwen",
    "llama",
    "grok",
    "sora",
    "openai",
    "anthropic",
  ].some((keyword) => haystack.includes(keyword));
}

function inferAihotEventCategory(sectionLabel: string, title: string) {
  if (sectionLabel.includes("模型") || /gpt|claude|gemini|deepseek|qwen|llama|grok|sora/i.test(title)) {
    return "model";
  }

  if (sectionLabel.includes("产品")) return "product";
  if (sectionLabel.includes("论文")) return "research";
  if (sectionLabel.includes("技巧")) return "developer";
  return "industry";
}

function buildAihotEventSeed(date: string, sectionLabel: string, item: AihotDailyItem): DailyMajorEventSeed {
  const category = inferAihotEventCategory(sectionLabel, item.title);
  const officialSource = /openai|anthropic|google|deepseek|meta|xai|mistral|hugging face|microsoft/i.test(
    item.sourceName ?? "",
  );
  const flagshipTitle = /gpt-|claude|gemini|deepseek|qwen|llama|grok|sora/i.test(item.title);

  return {
    eventDate: date,
    title: item.title.trim(),
    summary: item.summary?.trim() || `${item.title.trim()}。详情请查看原始来源。`,
    category,
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName ?? "AI HOT",
    importanceScore: officialSource && flagshipTitle ? 92 : 84,
    tags: ["AI HOT", sectionLabel],
  };
}

async function fetchAihotDaily(date: string) {
  const response = await fetch(`https://aihot.virxact.com/api/public/daily/${date}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AI HOT daily ${date} fetch failed with ${response.status}`);
  }

  return (await response.json()) as AihotDailyResponse;
}

export async function backfillDailyMajorEventsFromAihot(input?: {
  take?: number;
  maxEventsPerDay?: number;
}) {
  const take = Math.min(60, Math.max(1, input?.take ?? 30));
  const maxEventsPerDay = Math.min(3, Math.max(1, input?.maxEventsPerDay ?? 1));
  const response = await fetch(`https://aihot.virxact.com/api/public/dailies?take=${take}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AI HOT dailies fetch failed with ${response.status}`);
  }

  const archive = (await response.json()) as {
    items?: Array<{
      date: string;
    }>;
  };
  const upserted: DailyMajorEventView[] = [];

  for (const archiveItem of archive.items ?? []) {
    const daily = await fetchAihotDaily(archiveItem.date);
    const seeds: DailyMajorEventSeed[] = [];

    for (const section of daily.sections ?? []) {
      for (const item of section.items ?? []) {
        if (!looksLikeMajorEvent(item.title, item.summary)) {
          continue;
        }

        seeds.push(buildAihotEventSeed(daily.date, section.label, item));
      }
    }

    for (const seed of seeds.slice(0, maxEventsPerDay)) {
      const next = await prisma.dailyMajorEvent.upsert({
        where: {
          eventDate_title: {
            eventDate: seed.eventDate,
            title: seed.title,
          },
        },
        update: {
          summary: seed.summary,
          category: seed.category,
          sourceUrl: seed.sourceUrl,
          sourceName: seed.sourceName ?? null,
          importanceScore: seed.importanceScore,
          tagsJson: seed.tags ? JSON.stringify(seed.tags) : null,
        },
        create: {
          eventDate: seed.eventDate,
          title: seed.title,
          summary: seed.summary,
          category: seed.category,
          sourceUrl: seed.sourceUrl,
          sourceName: seed.sourceName ?? null,
          importanceScore: seed.importanceScore,
          tagsJson: seed.tags ? JSON.stringify(seed.tags) : null,
        },
      });

      upserted.push(presentDailyMajorEvent(next));
    }
  }

  return upserted;
}
