import { prisma } from "@/lib/prisma";
import { createDailySource, listDailySources } from "@/server/services/daily-source-service";
import type { CreateDailySourceInput, DailySourceView } from "@/types/daily";

const defaultDailySources: CreateDailySourceInput[] = [
  {
    name: "OpenAI News",
    kind: "RSS",
    baseUrl: "https://openai.com/news",
    feedUrl: "https://openai.com/news/rss.xml",
    configJson: JSON.stringify({ limit: 20 }),
    priority: 10,
    enabled: true,
  },
  {
    name: "Hugging Face Blog",
    kind: "RSS",
    baseUrl: "https://huggingface.co/blog",
    feedUrl: "https://huggingface.co/blog/feed.xml",
    configJson: JSON.stringify({ limit: 20 }),
    priority: 12,
    enabled: true,
  },
  {
    name: "Google AI Blog",
    kind: "RSS",
    baseUrl: "https://blog.google/technology/ai",
    feedUrl: "https://blog.google/technology/ai/rss/",
    configJson: JSON.stringify({ limit: 20 }),
    priority: 14,
    enabled: true,
  },
  {
    name: "Hacker News Top Stories",
    kind: "HACKERNEWS",
    configJson: JSON.stringify({ storyList: "topstories", limit: 20, minScore: 40 }),
    priority: 20,
    enabled: true,
  },
  {
    name: "Reddit /r/MachineLearning",
    kind: "RSS",
    baseUrl: "https://www.reddit.com/r/MachineLearning",
    feedUrl: "https://www.reddit.com/r/MachineLearning/.rss",
    configJson: JSON.stringify({ limit: 15 }),
    priority: 24,
    enabled: true,
  },
  {
    name: "Reddit /r/LocalLLaMA",
    kind: "RSS",
    baseUrl: "https://www.reddit.com/r/LocalLLaMA",
    feedUrl: "https://www.reddit.com/r/LocalLLaMA/.rss",
    configJson: JSON.stringify({ limit: 15 }),
    priority: 26,
    enabled: true,
  },
  {
    name: "GitHub Releases / huggingface/transformers",
    kind: "GITHUB_RELEASES",
    baseUrl: "https://github.com/huggingface/transformers",
    configJson: JSON.stringify({ limit: 10 }),
    priority: 30,
    enabled: true,
  },
  {
    name: "GitHub Releases / vercel/ai",
    kind: "GITHUB_RELEASES",
    baseUrl: "https://github.com/vercel/ai",
    configJson: JSON.stringify({ limit: 10 }),
    priority: 32,
    enabled: true,
  },
];

export function getDefaultDailySourceDefinitions() {
  return defaultDailySources;
}

export async function seedDefaultDailySources() {
  const existingSources = await prisma.dailySource.findMany({
    select: {
      name: true,
    },
  });
  const existingNames = new Set(existingSources.map((source) => source.name));
  const created: DailySourceView[] = [];

  for (const source of defaultDailySources) {
    if (existingNames.has(source.name)) {
      continue;
    }

    const createdSource = await createDailySource(source);
    created.push(createdSource);
  }

  const sources = await listDailySources();

  return {
    created,
    sources,
  };
}
