import type {
  ProviderConnectionDiscoveryStrategy,
  ProviderConnectionTemplateView,
  ProviderType,
} from "@/types/app";

export const providerOptions = [
  "OPENAI_COMPATIBLE",
  "CLAUDE",
  "GEMINI",
  "GROK",
  "DOUBAO",
  "DEEPSEEK",
  "MODELSCOPE",
  "HUNYUAN",
  "QWEN",
] as const;

export interface ProviderPreset {
  label: string;
  labelZh: string;
  shortName: string;
  baseUrl: string;
  defaultModelName: string;
  defaultReplyLength: number;
  avatarColor: string;
  badgeClassName: string;
  iconClassName: string;
  softClassName: string;
}

interface ProviderTemplateVisualPreset {
  avatarLabel: string;
  avatarColor: string;
}

export const providerPresets: Record<ProviderType, ProviderPreset> = {
  OPENAI_COMPATIBLE: {
    label: "OpenAI Compatible",
    labelZh: "OpenAI 兼容",
    shortName: "OA",
    baseUrl: "https://api.openai.com/v1",
    defaultModelName: "gpt-4.1-mini",
    defaultReplyLength: 300,
    avatarColor: "#10b981",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "bg-emerald-500 text-white",
    softClassName: "bg-emerald-50/75",
  },
  CLAUDE: {
    label: "Claude",
    labelZh: "Claude",
    shortName: "CL",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModelName: "",
    defaultReplyLength: 300,
    avatarColor: "#f59e0b",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    iconClassName: "bg-amber-500 text-white",
    softClassName: "bg-amber-50/75",
  },
  GEMINI: {
    label: "Gemini",
    labelZh: "谷歌 Gemini",
    shortName: "GM",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModelName: "gemini-2.5-flash",
    defaultReplyLength: 300,
    avatarColor: "#0ea5e9",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    iconClassName: "bg-sky-500 text-white",
    softClassName: "bg-sky-50/75",
  },
  GROK: {
    label: "Grok",
    labelZh: "xAI Grok",
    shortName: "GK",
    baseUrl: "https://api.x.ai/v1",
    defaultModelName: "grok-3-mini",
    defaultReplyLength: 300,
    avatarColor: "#8b5cf6",
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    iconClassName: "bg-violet-500 text-white",
    softClassName: "bg-violet-50/75",
  },
  DOUBAO: {
    label: "Doubao",
    labelZh: "火山引擎 / 豆包",
    shortName: "DB",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModelName: "",
    defaultReplyLength: 300,
    avatarColor: "#f97316",
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    iconClassName: "bg-orange-500 text-white",
    softClassName: "bg-orange-50/75",
  },
  DEEPSEEK: {
    label: "DeepSeek",
    labelZh: "DeepSeek",
    shortName: "DS",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModelName: "deepseek-chat",
    defaultReplyLength: 300,
    avatarColor: "#06b6d4",
    badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-700",
    iconClassName: "bg-cyan-500 text-white",
    softClassName: "bg-cyan-50/75",
  },
  MODELSCOPE: {
    label: "ModelScope",
    labelZh: "魔搭社区 / ModelScope",
    shortName: "MS",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    defaultModelName: "",
    defaultReplyLength: 300,
    avatarColor: "#d946ef",
    badgeClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    iconClassName: "bg-fuchsia-500 text-white",
    softClassName: "bg-fuchsia-50/75",
  },
  HUNYUAN: {
    label: "Hunyuan",
    labelZh: "腾讯混元 / Hunyuan",
    shortName: "HY",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModelName: "hunyuan-turbo",
    defaultReplyLength: 300,
    avatarColor: "#f43f5e",
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    iconClassName: "bg-rose-500 text-white",
    softClassName: "bg-rose-50/75",
  },
  QWEN: {
    label: "Qwen",
    labelZh: "通义千问 / Qwen",
    shortName: "QW",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModelName: "qwen-plus",
    defaultReplyLength: 300,
    avatarColor: "#6366f1",
    badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    iconClassName: "bg-indigo-500 text-white",
    softClassName: "bg-indigo-50/75",
  },
};

/**
 * 支持通过 GET /models 自动发现模型列表的 provider。
 *
 * 判断依据：provider 在用 OPENAI_COMPATIBLE 模式时，其平台的 /models 端点
 * 返回符合 OpenAI 格式的响应（data[] 数组）。
 *
 * 注意：某些平台（如智谱 BigModel、OpenRouter）虽然在技术上可以返回模型列表，
 * 但实际行为可能受账号权限、套餐影响，因此在模板层面设置为
 * AUTO_FETCH_WITH_MANUAL_FALLBACK，以便失败时有 fallback。
 *
 * DOUBAO / HUNYUAN / QWEN 现按兼容接口做 best-effort 自动发现，
 * 实际结果仍可能受账号权限、平台网关和模型目录策略影响。
 * CLAUDE 使用 Anthropic 原生 API，不兼容此路径。
 */
const autoDiscoverableProviders = new Set<ProviderType>([
  "OPENAI_COMPATIBLE",
  "GEMINI",
  "GROK",
  "DOUBAO",
  "DEEPSEEK",
  "MODELSCOPE",
  "HUNYUAN",
  "QWEN",
]);

const providerTemplateVisualPresets: Record<string, ProviderTemplateVisualPreset> = {
  "zhipu-bigmodel": { avatarLabel: "ZP", avatarColor: "#2563eb" },
  moonshot: { avatarLabel: "KM", avatarColor: "#14b8a6" },
  minimax: { avatarLabel: "MM", avatarColor: "#f97316" },
  spark: { avatarLabel: "XF", avatarColor: "#ef4444" },
  hunyuan: { avatarLabel: "HY", avatarColor: "#f43f5e" },
  dashscope: { avatarLabel: "AL", avatarColor: "#6366f1" },
  siliconflow: { avatarLabel: "SF", avatarColor: "#0ea5e9" },
  scnet: { avatarLabel: "SC", avatarColor: "#64748b" },
  aiping: { avatarLabel: "AP", avatarColor: "#8b5cf6" },
  sophnet: { avatarLabel: "SN", avatarColor: "#a855f7" },
  openrouter: { avatarLabel: "OR", avatarColor: "#0f766e" },
  "github-models": { avatarLabel: "GH", avatarColor: "#111827" },
  cerebras: { avatarLabel: "CB", avatarColor: "#ea580c" },
  sambanova: { avatarLabel: "SV", avatarColor: "#dc2626" },
  zenmux: { avatarLabel: "ZM", avatarColor: "#7c3aed" },
};

function getTemplateVisualPreset(templateId: string, provider: ProviderType): ProviderTemplateVisualPreset {
  return (
    providerTemplateVisualPresets[templateId] ?? {
      avatarLabel: providerPresets[provider].shortName,
      avatarColor: providerPresets[provider].avatarColor,
    }
  );
}

const providerConnectionTemplateDefinitions: Omit<ProviderConnectionTemplateView, "avatarLabel" | "avatarColor">[] = [
  // ── 国内平台 ────────────────────────────────────────────────────────────
  {
    id: "zhipu-bigmodel",
    category: "DOMESTIC",
    name: "智谱 AI / BigModel",
    subtitle: "GLM 系列，兼容 OpenAI 接口；/models 端点实际可用性因账号和版本而异",
    provider: "OPENAI_COMPATIBLE",
    suggestedBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    // 已知常用模型：glm-4-flash（免费）、glm-4、glm-4-plus、glm-4-air、glm-4-long
    defaultModelName: "glm-4-flash",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://www.bigmodel.cn",
    apiKeyUrl: "https://www.bigmodel.cn/usercenter/apikeys",
    docsUrl: "https://bigmodel.cn/dev/api",
    modelsUrl: "https://bigmodel.cn/dev/howuse/model",
    note: "优先点「获取列表」；若平台未返回模型列表，请手动填写模型 ID（如 glm-4-flash）。",
  },
  {
    id: "moonshot",
    category: "DOMESTIC",
    name: "Moonshot AI / Kimi",
    subtitle: "月之暗面，兼容 OpenAI 接口；支持 /models 端点列出可用模型",
    provider: "OPENAI_COMPATIBLE",
    suggestedBaseUrl: "https://api.moonshot.cn/v1",
    // 已知常用模型：moonshot-v1-8k、moonshot-v1-32k、moonshot-v1-128k
    defaultModelName: "moonshot-v1-8k",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://platform.moonshot.cn",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    docsUrl: "https://platform.moonshot.cn/docs",
    modelsUrl: "https://platform.moonshot.cn/docs/api/chat",
    note: "支持 /models 自动获取；若获取失败，请手动填写模型 ID（如 moonshot-v1-8k）。",
  },
  {
    id: "minimax",
    category: "DOMESTIC",
    name: "MiniMax",
    subtitle: "稀宇科技，兼容 OpenAI 接口（ChatCompletion Pro 端点）",
    provider: "OPENAI_COMPATIBLE",
    // MiniMax 的 OpenAI 兼容端点（ChatCompletion Pro）
    suggestedBaseUrl: "https://api.minimax.chat/v1",
    // 已知常用模型：MiniMax-Text-01、abab6.5s-chat
    defaultModelName: "MiniMax-Text-01",
    preferredDiscoveryStrategy: "MANUAL_ONLY",
    officialUrl: "https://platform.minimaxi.com",
    apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    docsUrl: "https://platform.minimaxi.com/document/guides/chat-model/pro/api",
    modelsUrl: "https://platform.minimaxi.com/document/models",
    note: "MiniMax 的 /models 端点不对外开放；请手动填写模型 ID（如 MiniMax-Text-01 或 abab6.5s-chat）。",
  },
  {
    id: "spark",
    category: "DOMESTIC",
    name: "讯飞星火 / Spark",
    subtitle: "科大讯飞，提供 OpenAI 兼容接口",
    provider: "OPENAI_COMPATIBLE",
    // 讯飞星火的 OpenAI 兼容端点
    suggestedBaseUrl: "https://spark-api-open.xf-yun.com/v1",
    // 已知常用模型：lite（Spark Lite）、generalv3.5（Spark Max）、4.0Ultra
    defaultModelName: "lite",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://www.xfyun.cn/doc/spark/Web.html",
    apiKeyUrl: "https://console.xfyun.cn/services/bm35",
    docsUrl: "https://www.xfyun.cn/doc/spark/HTTP.html",
    modelsUrl: "https://www.xfyun.cn/doc/spark/HTTP.html#%E6%8E%A5%E5%8F%A3%E8%AF%B4%E6%98%8E",
    note: "已内置星火兼容端点；输入 API Key 后可先尝试自动获取模型列表。若平台未返回列表，再手动填写模型 ID（如 lite、generalv3.5、4.0Ultra）。API Key 在控制台的「HTTP 调用」处获取。",
  },
  {
    id: "hunyuan",
    category: "DOMESTIC",
    name: "腾讯混元 / Hunyuan",
    subtitle: "腾讯云混元大模型，提供 OpenAI 兼容接口",
    provider: "HUNYUAN",
    suggestedBaseUrl: providerPresets.HUNYUAN.baseUrl,
    defaultModelName: providerPresets.HUNYUAN.defaultModelName,
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://cloud.tencent.com/product/hunyuan",
    apiKeyUrl: "https://console.cloud.tencent.com/hunyuan/api-key",
    docsUrl: "https://cloud.tencent.com/document/product/1729/111008",
    modelsUrl: "https://cloud.tencent.com/document/product/1729/97731",
    note: "已内置混元兼容端点；输入 API Key 后可先尝试自动获取模型列表。若平台未返回列表，再手动填写模型 ID（如 hunyuan-turbo、hunyuan-lite）。",
  },
  {
    id: "dashscope",
    category: "DOMESTIC",
    name: "阿里云百炼 / DashScope",
    subtitle: "通义千问系列，通过 DashScope 兼容 OpenAI 接口接入",
    provider: "QWEN",
    suggestedBaseUrl: providerPresets.QWEN.baseUrl,
    defaultModelName: providerPresets.QWEN.defaultModelName,
    // DashScope 的 /models 端点仍可能受权限或网关策略影响，统一走自动获取 + 手动兜底
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://bailian.console.aliyun.com",
    apiKeyUrl: "https://bailian.console.aliyun.com/?apiKey=1",
    docsUrl: "https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope",
    modelsUrl: "https://help.aliyun.com/zh/model-studio/getting-started/models",
    note: "已内置百炼兼容端点；输入 API Key 后可先尝试自动获取模型列表。若平台未返回列表，再手动填写模型 ID（如 qwen-plus、qwen-turbo、qwen-max）。",
  },
  {
    id: "siliconflow",
    category: "DOMESTIC",
    name: "硅基流动 / SiliconFlow",
    subtitle: "聚合推理平台，完整兼容 OpenAI 接口，支持 /models 自动获取",
    provider: "OPENAI_COMPATIBLE",
    suggestedBaseUrl: "https://api.siliconflow.cn/v1",
    // 知名免费模型，可按实际需求替换
    defaultModelName: "Qwen/Qwen2.5-7B-Instruct",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://cloud.siliconflow.cn",
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    docsUrl: "https://docs.siliconflow.cn",
    modelsUrl: "https://cloud.siliconflow.cn/models",
    note: "支持 /models 自动获取；返回模型较多，建议选用后保存为独立模型条目。",
  },
  {
    id: "scnet",
    category: "DOMESTIC",
    name: "超算互联网",
    subtitle: "建议按自定义 OpenAI 兼容平台接入",
    provider: "OPENAI_COMPATIBLE",
    preferredDiscoveryStrategy: "MANUAL_ONLY",
    officialUrl: "https://www.scnet.cn",
    apiKeyUrl: "https://www.scnet.cn",
    docsUrl: "https://www.scnet.cn",
    note: "优先查看官方控制台是否提供兼容接口地址和模型目录，再手动填写模型 ID。",
  },
  {
    id: "aiping",
    category: "DOMESTIC",
    name: "AI Ping",
    subtitle: "聚合平台，建议先走手动模型录入",
    provider: "OPENAI_COMPATIBLE",
    preferredDiscoveryStrategy: "MANUAL_ONLY",
    officialUrl: "https://aiping.cn",
    apiKeyUrl: "https://aiping.cn",
    docsUrl: "https://aiping.cn",
    note: "请查阅平台控制台获取 Base URL 和模型 ID。",
  },
  {
    id: "sophnet",
    category: "DOMESTIC",
    name: "Sophnet",
    subtitle: "平台型接入，优先参考官方控制台说明",
    provider: "OPENAI_COMPATIBLE",
    preferredDiscoveryStrategy: "MANUAL_ONLY",
    officialUrl: "https://www.sophnet.com",
    apiKeyUrl: "https://www.sophnet.com",
    docsUrl: "https://www.sophnet.com",
    note: "先验证 Key 和 Base URL，再手动填写模型 ID。",
  },

  // ── 海外平台 ────────────────────────────────────────────────────────────
  {
    id: "openrouter",
    category: "GLOBAL",
    name: "OpenRouter",
    subtitle: "全球聚合平台，支持 /models 自动获取，返回上百个模型",
    provider: "OPENAI_COMPATIBLE",
    suggestedBaseUrl: "https://openrouter.ai/api/v1",
    // 免费模型示例；实际可获取后从列表选择
    defaultModelName: "meta-llama/llama-4-scout:free",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://openrouter.ai",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
    docsUrl: "https://openrouter.ai/docs",
    modelsUrl: "https://openrouter.ai/models",
    note: "支持 /models 自动获取；模型很多，建议拉取后从列表选择目标模型。免费额度模型 ID 后缀为 :free。",
  },
  {
    id: "github-models",
    category: "GLOBAL",
    name: "GitHub Models",
    subtitle: "GitHub 官方推理平台，使用 GitHub Personal Access Token",
    provider: "OPENAI_COMPATIBLE",
    suggestedBaseUrl: "https://models.inference.ai.azure.com",
    // 常见模型，需在 GitHub Marketplace 页面确认可用性
    defaultModelName: "gpt-4o-mini",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://github.com/marketplace/models",
    apiKeyUrl: "https://github.com/settings/tokens",
    docsUrl: "https://docs.github.com/en/github-models",
    modelsUrl: "https://github.com/marketplace/models",
    note: "已内置 GitHub Models 推理端点；输入 GitHub PAT 后可先尝试自动获取模型列表。若平台未返回列表，再手动填写模型 ID（如 gpt-4o-mini、Llama-3.3-70B-Instruct）。",
  },
  {
    id: "cerebras",
    category: "GLOBAL",
    name: "Cerebras",
    subtitle: "高速推理平台，完整兼容 OpenAI 接口",
    provider: "OPENAI_COMPATIBLE",
    suggestedBaseUrl: "https://api.cerebras.ai/v1",
    // 常见可用模型
    defaultModelName: "llama-3.3-70b",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://cloud.cerebras.ai",
    apiKeyUrl: "https://cloud.cerebras.ai/platform",
    docsUrl: "https://inference-docs.cerebras.ai",
    modelsUrl: "https://inference-docs.cerebras.ai/supported-models",
    note: "速度极快；支持 /models 获取；如遇 429 请检查日额度限制。",
  },
  {
    id: "sambanova",
    category: "GLOBAL",
    name: "SambaNova",
    subtitle: "聚合推理平台，兼容 OpenAI 接口",
    provider: "OPENAI_COMPATIBLE",
    suggestedBaseUrl: "https://api.sambanova.ai/v1",
    defaultModelName: "Meta-Llama-3.3-70B-Instruct",
    preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    officialUrl: "https://cloud.sambanova.ai",
    apiKeyUrl: "https://cloud.sambanova.ai/apis",
    docsUrl: "https://docs.sambanova.ai",
    modelsUrl: "https://docs.sambanova.ai/cloud/docs/get-started/supported-models",
    note: "支持 /models 自动获取；建议先测试连通性，再选择目标模型。",
  },
  {
    id: "zenmux",
    category: "GLOBAL",
    name: "ZenMux",
    subtitle: "企业级聚合平台，适合统一接入主流模型",
    provider: "OPENAI_COMPATIBLE",
    preferredDiscoveryStrategy: "MANUAL_ONLY",
    officialUrl: "https://zenmux.ai",
    apiKeyUrl: "https://zenmux.ai",
    docsUrl: "https://zenmux.ai",
    note: "适合统一管理多个上游模型；请查阅平台文档获取 Base URL 和模型 ID。",
  },
];

export const providerConnectionTemplates: ProviderConnectionTemplateView[] = providerConnectionTemplateDefinitions.map(
  (template) => ({
    ...template,
    ...getTemplateVisualPreset(template.id, template.provider),
  }),
);

export function getProviderPreset(provider: ProviderType) {
  return providerPresets[provider];
}

export function supportsAutomaticModelDiscovery(provider: ProviderType) {
  return autoDiscoverableProviders.has(provider);
}

export function getDefaultDiscoveryStrategy(provider: ProviderType): ProviderConnectionDiscoveryStrategy {
  return supportsAutomaticModelDiscovery(provider) ? "AUTO_FETCH_WITH_MANUAL_FALLBACK" : "MANUAL_ONLY";
}

export function getProviderTemplateById(templateId: string) {
  return providerConnectionTemplates.find((template) => template.id === templateId) ?? null;
}

function normalizeUrlForMatch(value: string) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function findMatchingProviderTemplate(provider: ProviderType, baseUrl: string) {
  const normalizedBaseUrl = normalizeUrlForMatch(baseUrl);

  return (
    providerConnectionTemplates.find((template) => {
      if (template.provider !== provider) {
        return false;
      }

      if (!template.suggestedBaseUrl) {
        return false;
      }

      return normalizeUrlForMatch(template.suggestedBaseUrl) === normalizedBaseUrl;
    }) ?? null
  );
}
