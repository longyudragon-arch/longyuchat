"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { describeClientError, fetchJson, formatDate, type ClientErrorFeedback } from "@/lib/client/longyuchat-client";
import type {
  DailyInterestProfileView,
  DailyIssueView,
  DailyRunView,
  DailySourceKind,
  DailySourceView,
} from "@/types/daily";

const sourceKindOptions: DailySourceKind[] = [
  "RSS",
  "GITHUB_RELEASES",
  "GITHUB_REPO_EVENTS",
  "HACKERNEWS",
  "REDDIT",
  "WEB_FEED",
];

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const toneClassName =
    feedback.tone === "warning"
      ? "border-amber-200/50 bg-amber-50/80 text-amber-900"
      : "border-red-200/50 bg-red-50/80 text-red-900";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClassName}`}>
      <p className="text-[13px] font-bold">{feedback.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-90">{feedback.description}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-75">建议：{feedback.suggestion}</p>
    </div>
  );
}

export function DailyAdminPage() {
  const [sources, setSources] = useState<DailySourceView[]>([]);
  const [interestProfiles, setInterestProfiles] = useState<DailyInterestProfileView[]>([]);
  const [runs, setRuns] = useState<DailyRunView[]>([]);
  const [issues, setIssues] = useState<DailyIssueView[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    kind: "RSS" as DailySourceKind,
    baseUrl: "",
    feedUrl: "",
    configJson: "",
    priority: "100",
    enabled: true,
  });
  const [interestForm, setInterestForm] = useState({
    name: "默认兴趣配置",
    includeKeywordsJson: "[\"openai\",\"deepseek\",\"qwen\",\"agent\",\"codex\",\"cursor\"]",
    excludeKeywordsJson: "[\"广告\",\"营销\",\"震惊\"]",
    interestsText:
      "优先关注 AI 开发工具、大模型发布、AI coding、agent、推理效率优化、开源项目和中国 AI 公司动态。",
    priority: "10",
    enabled: true,
  });

  const isBusy = activeAction !== null;

  async function loadState() {
    const [sourcesData, profilesData, runsData, issuesData] = await Promise.all([
      fetchJson<{ sources: DailySourceView[] }>("/api/daily/admin/sources"),
      fetchJson<{ profiles: DailyInterestProfileView[] }>("/api/daily/admin/interests"),
      fetchJson<{ runs: DailyRunView[] }>("/api/daily/admin/runs"),
      fetchJson<{ issues: DailyIssueView[] }>("/api/daily/issues?limit=20"),
    ]);

    setSources(sourcesData.sources);
    setInterestProfiles(profilesData.profiles);
    setRuns(runsData.runs);
    setIssues(issuesData.issues);
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);
    try {
      await loadState();
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  });

  useEffect(() => {
    startTransition(() => {
      void handleInitialLoad();
    });
  }, []);

  const issueStats = useMemo(() => {
    const published = issues.filter((issue) => issue.status === "PUBLISHED").length;
    const draft = issues.filter((issue) => issue.status === "DRAFT").length;
    const skipped = issues.filter((issue) => issue.status === "SKIPPED").length;

    return { published, draft, skipped };
  }, [issues]);

  async function submitSource() {
    setActiveAction("saving-source");
    setFeedback(null);
    try {
      const priority = Number.parseInt(form.priority.trim(), 10);

      await fetchJson<{ source: DailySourceView }>("/api/daily/admin/sources", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          kind: form.kind,
          baseUrl: form.baseUrl.trim() || null,
          feedUrl: form.feedUrl.trim() || null,
          configJson: form.configJson.trim() || null,
          enabled: form.enabled,
          priority: Number.isFinite(priority) ? priority : 100,
        }),
      });

      setForm({
        name: "",
        kind: "RSS",
        baseUrl: "",
        feedUrl: "",
        configJson: "",
        priority: "100",
        enabled: true,
      });
      await loadState();
      setNotice("已新增日报来源。");
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteSource(source: DailySourceView) {
    if (!window.confirm(`确认删除来源「${source.name}」吗？`)) {
      return;
    }

    setActiveAction("deleting-source");
    setFeedback(null);
    try {
      await fetchJson(`/api/daily/admin/sources/${source.id}`, {
        method: "DELETE",
      });
      await loadState();
      setNotice(`已删除来源「${source.name}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleSource(source: DailySourceView) {
    setActiveAction("toggling-source");
    setFeedback(null);
    try {
      await fetchJson<{ source: DailySourceView }>(`/api/daily/admin/sources/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: !source.enabled,
        }),
      });
      await loadState();
      setNotice(`已${source.enabled ? "停用" : "启用"}来源「${source.name}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function editSource(source: DailySourceView) {
    const nextName = window.prompt("来源名称", source.name);
    if (!nextName?.trim()) {
      return;
    }

    const nextFeedUrl = window.prompt("Feed URL（可留空）", source.feedUrl ?? "");
    const nextBaseUrl = window.prompt("Base URL（可留空）", source.baseUrl ?? "");
    const nextConfigJson = window.prompt("Config JSON（可留空）", source.configJson ?? "");

    setActiveAction("editing-source");
    setFeedback(null);
    try {
      await fetchJson<{ source: DailySourceView }>(`/api/daily/admin/sources/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: nextName.trim(),
          feedUrl: nextFeedUrl?.trim() || null,
          baseUrl: nextBaseUrl?.trim() || null,
          configJson: nextConfigJson?.trim() || null,
        }),
      });
      await loadState();
      setNotice(`已更新来源「${nextName.trim()}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function runScan() {
    setActiveAction("running-scan");
    setFeedback(null);
    try {
      const data = await fetchJson("/api/daily/admin/runs/scan", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadState();
      setNotice("已执行日报扫描。");
      console.log(data);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function runPublish() {
    setActiveAction("running-publish");
    setFeedback(null);
    try {
      const data = await fetchJson("/api/daily/admin/runs/publish", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadState();
      setNotice("已执行日报发布。");
      console.log(data);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function seedDefaults() {
    setActiveAction("seeding-default-sources");
    setFeedback(null);
    try {
      const data = await fetchJson<{ created: DailySourceView[]; sources: DailySourceView[] }>(
        "/api/daily/admin/sources/seed",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setSources(data.sources);
      setNotice(
        data.created.length > 0
          ? `已导入 ${data.created.length} 个默认来源。`
          : "默认来源已存在，无需重复导入。",
      );
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function submitInterestProfile() {
    setActiveAction("saving-interest-profile");
    setFeedback(null);
    try {
      const priority = Number.parseInt(interestForm.priority.trim(), 10);
      await fetchJson<{ profile: DailyInterestProfileView }>("/api/daily/admin/interests", {
        method: "POST",
        body: JSON.stringify({
          name: interestForm.name.trim(),
          includeKeywordsJson: interestForm.includeKeywordsJson.trim() || null,
          excludeKeywordsJson: interestForm.excludeKeywordsJson.trim() || null,
          interestsText: interestForm.interestsText.trim() || null,
          enabled: interestForm.enabled,
          priority: Number.isFinite(priority) ? priority : 10,
        }),
      });
      await loadState();
      setNotice("已保存兴趣过滤配置。");
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleInterestProfile(profile: DailyInterestProfileView) {
    setActiveAction("toggling-interest-profile");
    setFeedback(null);
    try {
      await fetchJson<{ profile: DailyInterestProfileView }>(`/api/daily/admin/interests/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: !profile.enabled,
        }),
      });
      await loadState();
      setNotice(`已${profile.enabled ? "停用" : "启用"}兴趣配置「${profile.name}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function editInterestProfile(profile: DailyInterestProfileView) {
    const nextName = window.prompt("配置名称", profile.name);
    if (!nextName?.trim()) {
      return;
    }

    const nextInclude = window.prompt("优先关键词 JSON", profile.includeKeywordsJson ?? "");
    const nextExclude = window.prompt("排除关键词 JSON", profile.excludeKeywordsJson ?? "");
    const nextInterests = window.prompt("兴趣描述", profile.interestsText ?? "");

    setActiveAction("editing-interest-profile");
    setFeedback(null);
    try {
      await fetchJson<{ profile: DailyInterestProfileView }>(`/api/daily/admin/interests/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: nextName.trim(),
          includeKeywordsJson: nextInclude?.trim() || null,
          excludeKeywordsJson: nextExclude?.trim() || null,
          interestsText: nextInterests?.trim() || null,
        }),
      });
      await loadState();
      setNotice(`已更新兴趣配置「${nextName.trim()}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteInterestProfile(profile: DailyInterestProfileView) {
    if (!window.confirm(`确认删除兴趣配置「${profile.name}」吗？`)) {
      return;
    }

    setActiveAction("deleting-interest-profile");
    setFeedback(null);
    try {
      await fetchJson(`/api/daily/admin/interests/${profile.id}`, {
        method: "DELETE",
      });
      await loadState();
      setNotice(`已删除兴趣配置「${profile.name}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="ly-page-wrap">
      <div className="ly-shell flex flex-col gap-5">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-stretch">
          <div className="ly-glass rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
            <div className="ly-page-header">
              <div className="ly-page-heading">
                <h1 className="ly-page-title">AI 日报后台</h1>
                <p className="ly-page-subtitle">
                  管理来源、手动触发扫描/发布，并查看日报运行状态。
                </p>
              </div>
              <div className="ly-page-actions">
                <Link href="/daily" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                  查看日报
                </Link>
                <button
                  type="button"
                  onClick={() => startTransition(() => void seedDefaults())}
                  disabled={isBusy}
                  className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold"
                >
                  默认来源
                </button>
                <button
                  type="button"
                  onClick={() => startTransition(() => void runScan())}
                  disabled={isBusy}
                  className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold"
                >
                  运行扫描
                </button>
                <button
                  type="button"
                  onClick={() => startTransition(() => void runPublish())}
                  disabled={isBusy}
                  className="ly-page-action rounded-xl border border-transparent bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm shadow-[var(--accent)]/20"
                >
                  发布日报
                </button>
              </div>
            </div>
          </div>

          <div className="ly-surface-card grid gap-4 rounded-[1.75rem] p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-1">
            <div className="rounded-[1.4rem] bg-white/45 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">已发布</p>
              <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{issueStats.published}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">对外可见的日报期数。</p>
            </div>
            <div className="rounded-[1.4rem] bg-white/45 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">草稿</p>
              <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{issueStats.draft}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">已生成但尚未公开的日报。</p>
            </div>
            <div className="rounded-[1.4rem] bg-white/45 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">跳过</p>
              <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{issueStats.skipped}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">未达到自动发布阈值的日期。</p>
            </div>
          </div>
        </section>

        {notice ? (
          <div className="rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/10 px-4 py-2 text-[12px] font-medium text-[var(--accent)]">
            {notice}
          </div>
        ) : null}
        {feedback ? <FeedbackPanel feedback={feedback} /> : null}

        <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="ly-glass ly-panel-card space-y-4">
            <div>
              <h2 className="text-lg font-display font-bold tracking-tight">新增来源</h2>
              <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
                先接结构化来源，`configJson` 用于补充 limit / subreddit / storyList 等参数。
              </p>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">名称</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="ly-control"
                placeholder="例如：OpenAI Blog / Hacker News / r/MachineLearning"
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">类型</label>
              <select
                value={form.kind}
                onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as DailySourceKind }))}
                className="ly-control"
              >
                {sourceKindOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Base URL</label>
              <input
                value={form.baseUrl}
                onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
                className="ly-control"
                placeholder="例如：https://github.com/openai/openai"
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Feed URL</label>
              <input
                value={form.feedUrl}
                onChange={(event) => setForm((current) => ({ ...current, feedUrl: event.target.value }))}
                className="ly-control"
                placeholder="例如：https://openai.com/news/rss.xml"
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Config JSON</label>
              <textarea
                value={form.configJson}
                onChange={(event) => setForm((current) => ({ ...current, configJson: event.target.value }))}
                className="ly-control min-h-32 resize-y"
                placeholder='例如：{"limit": 20} 或 {"subreddit":"MachineLearning","sort":"hot","limit":10}'
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">优先级</label>
                <input
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  className="ly-control"
                  inputMode="numeric"
                />
              </div>
              <label className="flex items-center gap-2 pt-8 text-sm font-medium text-stone-600">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                启用
              </label>
            </div>

            <button
              type="button"
              onClick={() => startTransition(() => void submitSource())}
              disabled={isBusy || !form.name.trim()}
              className="ly-primary-action inline-flex px-6 py-3 font-bold disabled:opacity-50"
            >
              新增来源
            </button>
          </div>

          <div className="ly-glass ly-panel-card space-y-4">
            <div>
              <h2 className="text-lg font-display font-bold tracking-tight">兴趣过滤</h2>
              <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
                参考 TrendRadar 的做法，为日报配置优先关键词、排除关键词和自然语言兴趣描述。扫描会据此加权或排除，发布 prompt 也会参考这些偏好。
              </p>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">名称</label>
              <input
                value={interestForm.name}
                onChange={(event) => setInterestForm((current) => ({ ...current, name: event.target.value }))}
                className="ly-control"
                placeholder="例如：AI 开发者视角"
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">优先关键词 JSON</label>
              <textarea
                value={interestForm.includeKeywordsJson}
                onChange={(event) => setInterestForm((current) => ({ ...current, includeKeywordsJson: event.target.value }))}
                className="ly-control min-h-28 resize-y"
                placeholder='例如：["openai","deepseek","qwen","agent"]'
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">排除关键词 JSON</label>
              <textarea
                value={interestForm.excludeKeywordsJson}
                onChange={(event) => setInterestForm((current) => ({ ...current, excludeKeywordsJson: event.target.value }))}
                className="ly-control min-h-24 resize-y"
                placeholder='例如：["广告","营销","震惊"]'
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">兴趣描述</label>
              <textarea
                value={interestForm.interestsText}
                onChange={(event) => setInterestForm((current) => ({ ...current, interestsText: event.target.value }))}
                className="ly-control min-h-32 resize-y"
                placeholder="用自然语言描述你希望日报优先关注什么。"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">优先级</label>
                <input
                  value={interestForm.priority}
                  onChange={(event) => setInterestForm((current) => ({ ...current, priority: event.target.value }))}
                  className="ly-control"
                  inputMode="numeric"
                />
              </div>
              <label className="flex items-center gap-2 pt-8 text-sm font-medium text-stone-600">
                <input
                  type="checkbox"
                  checked={interestForm.enabled}
                  onChange={(event) => setInterestForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                启用
              </label>
            </div>

            <button
              type="button"
              onClick={() => startTransition(() => void submitInterestProfile())}
              disabled={isBusy || !interestForm.name.trim()}
              className="ly-primary-action inline-flex px-6 py-3 font-bold disabled:opacity-50"
            >
              保存兴趣配置
            </button>
          </div>

          <div className="space-y-5">
            <section className="ly-glass ly-panel-card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-display font-bold tracking-tight">来源列表</h2>
                <span className="text-[12px] font-medium text-[var(--muted)]">{sources.length} 个来源</span>
              </div>

              <div className="grid gap-4">
                {sources.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 bg-white/30 px-4 py-8 text-center text-sm text-stone-500">
                    还没有日报来源，请先新增至少一个来源。
                  </div>
                ) : (
                  sources.map((source) => (
                    <article key={source.id} className="rounded-[1.35rem] bg-white/40 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#2f2e33]">{source.name}</p>
                            <span className="rounded-md bg-[#DC75A5]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#DC75A5]">
                              {source.kind}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${source.enabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                              {source.enabled ? "启用" : "停用"}
                            </span>
                          </div>
                          {source.feedUrl ? (
                            <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">{source.feedUrl}</p>
                          ) : null}
                          {source.baseUrl ? (
                            <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">{source.baseUrl}</p>
                          ) : null}
                          <p className="mt-2 text-[11px] text-stone-500">
                            priority={source.priority} · 已抓取 {source.itemCount} 条 · 最近抓取 {source.lastFetchedAt ? formatDate(source.lastFetchedAt) : "暂无"}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => startTransition(() => void editSource(source))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold">
                            编辑
                          </button>
                          <button type="button" onClick={() => startTransition(() => void toggleSource(source))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold">
                            {source.enabled ? "停用" : "启用"}
                          </button>
                          <button type="button" onClick={() => startTransition(() => void deleteSource(source))} className="ly-mini-action border-red-200/50 bg-red-50/50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white">
                            删除
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="ly-glass ly-panel-card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-display font-bold tracking-tight">兴趣配置</h2>
                <span className="text-[12px] font-medium text-[var(--muted)]">{interestProfiles.length} 条</span>
              </div>
              <div className="grid gap-4">
                {interestProfiles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 bg-white/30 px-4 py-8 text-center text-sm text-stone-500">
                    还没有兴趣配置，保存一条后，日报扫描和发布会按你的偏好工作。
                  </div>
                ) : (
                  interestProfiles.map((profile) => (
                    <article key={profile.id} className="rounded-[1.35rem] bg-white/40 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#2f2e33]">{profile.name}</p>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${profile.enabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                              {profile.enabled ? "启用" : "停用"}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] text-stone-500">priority={profile.priority}</p>
                          {profile.interestsText ? (
                            <p className="mt-2 text-sm leading-6 text-stone-600">{profile.interestsText}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => startTransition(() => void editInterestProfile(profile))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold">
                            编辑
                          </button>
                          <button type="button" onClick={() => startTransition(() => void toggleInterestProfile(profile))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold">
                            {profile.enabled ? "停用" : "启用"}
                          </button>
                          <button type="button" onClick={() => startTransition(() => void deleteInterestProfile(profile))} className="ly-mini-action border-red-200/50 bg-red-50/50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white">
                            删除
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="ly-glass ly-panel-card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-display font-bold tracking-tight">最近运行</h2>
                <span className="text-[12px] font-medium text-[var(--muted)]">{runs.length} 条</span>
              </div>
              <div className="grid gap-4">
                {runs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 bg-white/30 px-4 py-8 text-center text-sm text-stone-500">
                    还没有运行记录。
                  </div>
                ) : (
                  runs.map((run) => (
                    <article key={run.id} className="rounded-[1.35rem] bg-white/40 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#2f2e33]">{run.runType}</p>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${run.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : run.status === "FAILED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                              {run.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-[var(--muted)]">{run.summary ?? "暂无摘要"}</p>
                          <p className="mt-1 text-[11px] text-stone-500">
                            开始于 {formatDate(run.startedAt)} · 步骤 {run.stepCount}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="ly-glass ly-panel-card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-display font-bold tracking-tight">最近日报</h2>
                <span className="text-[12px] font-medium text-[var(--muted)]">{issues.length} 期</span>
              </div>
              <div className="grid gap-4">
                {issues.map((issue) => (
                  <article key={issue.id} className="rounded-[1.35rem] bg-white/40 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link href={`/daily/${issue.slug}`} className="font-bold text-[#2f2e33] hover:text-[#DC75A5]">
                          {issue.title}
                        </Link>
                        <p className="mt-1 text-[12px] text-[var(--muted)]">{issue.summary ?? "暂无导语"}</p>
                        <p className="mt-1 text-[11px] text-stone-500">
                          {issue.issueDate} · {issue.status} · {issue.itemCount} 条
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
