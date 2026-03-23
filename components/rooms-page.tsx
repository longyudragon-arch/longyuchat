"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  bootstrapLocalTestWorkspace,
  describeClientError,
  fetchJson,
  formatDate,
  getProviderBadgeClassName,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
  supportsLocalMockTools,
  toRoleLabel,
  toRoomLabel,
  type ClientErrorFeedback,
} from "@/lib/client/chat-lab-client";
import type { ProviderType, RoomType, RoomView } from "@/types/app";

type RoomFilterType = RoomType | "ALL";

function compactPreviewContent(content: string, maxLength = 120) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const toneClassName =
    feedback.tone === "warning"
      ? "border-amber-200/50 bg-amber-50/80 text-amber-900 shadow-amber-500/10"
      : "border-red-200/50 bg-red-50/80 text-red-900 shadow-red-500/10";

  return (
    <div className={`rounded-[2rem] border px-6 py-5 shadow-lg backdrop-blur-md ${toneClassName}`}>
      <p className="text-[15px] font-bold tracking-tight">{feedback.title}</p>
      <p className="mt-2 text-[14px] leading-relaxed opacity-90">{feedback.description}</p>
      <p className="mt-3 text-[13px] font-medium leading-relaxed opacity-80 border-t border-black/5 pt-3">建议：{feedback.suggestion}</p>
    </div>
  );
}

function SummaryCard({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <article className="ly-glass rounded-[2.5rem] px-6 py-6 shadow-xl shadow-black/5 transition-transform hover:-translate-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
        <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">{label}</p>
      </div>
      <p className="mt-4 text-4xl font-display font-bold text-[var(--foreground)]">{value}</p>
      <p className="mt-3 text-[13px] font-medium leading-relaxed text-[var(--muted)]">{description}</p>
    </article>
  );
}

export function RoomsPage() {
  const router = useRouter();
  const mockToolsEnabled = supportsLocalMockTools();
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<RoomFilterType>("ALL");
  const [providerFilter, setProviderFilter] = useState<ProviderType | "ALL">("ALL");

  const isBusy = activeAction !== null;

  async function loadRooms() {
    const data = await fetchJson<{ rooms: RoomView[] }>("/api/rooms");
    setRooms(data.rooms);
  }

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const searchableText = [
        room.title,
        ...room.roomModels.map((roomModel) => roomModel.model.name),
        ...room.roomModels.map((roomModel) => roomModel.model.modelName),
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);
      const matchesType = typeFilter === "ALL" || room.type === typeFilter;
      const matchesProvider =
        providerFilter === "ALL" ||
        room.roomModels.some((roomModel) => roomModel.model.provider === providerFilter);

      return matchesQuery && matchesType && matchesProvider;
    });
  }, [providerFilter, rooms, searchQuery, typeFilter]);

  const roomSummary = useMemo(() => {
    const totalMessages = rooms.reduce((sum, room) => sum + room.messageCount, 0);
    return {
      totalRooms: rooms.length,
      groupRooms: rooms.filter((room) => room.type === "GROUP").length,
      singleRooms: rooms.filter((room) => room.type === "SINGLE").length,
      totalMessages,
    };
  }, [rooms]);

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

    try {
      await loadRooms();
      setNotice("房间列表已经同步完成。");
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

  async function launchLocalWorkspace() {
    setActiveAction("creating-local-room");
    setFeedback(null);

    try {
      const room = await bootstrapLocalTestWorkspace();
      router.push(`/rooms/${room.id}`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function renameRoom(room: RoomView) {
    const nextTitle = window.prompt("请输入新的房间名称：", room.title);
    if (!nextTitle || nextTitle.trim() === room.title) return;

    setActiveAction("renaming-room");
    setFeedback(null);

    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${room.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: nextTitle.trim() }),
      });
      await loadRooms();
      setNotice(`已将房间改名为「${data.room.title}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteRoom(room: RoomView) {
    if (!window.confirm(`确认删除房间「${room.title}」吗？聊天记录也会一起删除。`)) return;

    setActiveAction("deleting-room");
    setFeedback(null);

    try {
      await fetchJson(`/api/rooms/${room.id}`, { method: "DELETE" });
      await loadRooms();
      setNotice(`已删除房间「${room.title}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="ly-shell flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[3.5rem] px-8 py-10 sm:px-12 sm:py-14 shadow-2xl">
          <div className="relative z-10 animate-fade-in-up">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.24em] text-white/90 uppercase backdrop-blur-md shadow-inner">
              房间中心
            </span>
            <h1 className="mt-8 text-5xl font-display font-bold tracking-tight sm:text-6xl xl:text-[4.5rem] xl:leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60">
              协作房间 <br />
              <span className="text-white/40 font-light">统一入口</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[1.0625rem] font-medium leading-[1.8] text-white/70">
              从这里查看历史会话、最近一条消息、参与模型顺序与房间类型。你可以把它当成多模型工作台首页，快速回到任何一次对话现场。
            </p>

            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">筛选能力</p>
                <p className="mt-3 text-[14px] font-bold text-white/90 leading-relaxed">按房间、模型与 Provider 快速定位</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">上下文</p>
                <p className="mt-3 text-[14px] font-bold text-white/90 leading-relaxed">直接看到每个房间最近聊到了哪一步</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">控制操作</p>
                <p className="mt-3 text-[14px] font-bold text-white/90 leading-relaxed">新建、重命名、删除和继续聊都在这里完成</p>
              </div>
            </div>
          </div>
          {/* Decorative blur */}
          <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[linear-gradient(135deg,#c98af0,#f48498)] opacity-15 blur-[120px] animate-pulse-slow" />
        </div>

        <div className="ly-glass flex flex-col rounded-[3.5rem] p-8 sm:p-10 shadow-xl shadow-[var(--accent)]/5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
              <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">快捷操作</p>
            </div>
            <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">围绕房间继续推进工作</h2>
            <p className="mt-2 text-[14px] font-medium leading-relaxed text-[var(--muted)]">
              这里保留给高频动作。你可以立刻新建正式房间、先去配置模型，或者一键生成本地演示环境来验证顺序回复体验。
            </p>
          </div>

          <div className="mt-10 grid flex-1 gap-5">
            <Link
              href="/rooms/new"
              className="group relative flex items-center justify-between rounded-[2rem] bg-[linear-gradient(135deg,#993c50,#c7576f)] px-8 py-6 text-[16px] font-display font-bold text-white transition-all duration-500 hover:shadow-[0_24px_48px_rgba(153,60,80,0.3)] hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
            >
              <span className="relative z-10">创建新的聊天房间</span>
              <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-2">→</span>
            </Link>
            <Link
              href="/models"
              className="flex items-center justify-between rounded-[2rem] border border-white/40 bg-white/30 px-8 py-6 text-[15px] font-bold text-[var(--foreground)] transition-all duration-300 hover:bg-white/60 hover:border-white/80 active:scale-[0.98] backdrop-blur-md"
            >
              <span>先去管理模型配置</span>
            </Link>
            {mockToolsEnabled ? (
              <button
                type="button"
                onClick={() => startTransition(() => void launchLocalWorkspace())}
                className="flex items-center justify-between rounded-[2rem] border border-white/40 bg-white/30 px-8 py-6 text-left text-[15px] font-bold text-[var(--foreground)] transition-all duration-300 hover:bg-white/60 hover:border-white/80 active:scale-[0.98] backdrop-blur-md"
              >
                <span>一键生成本地测试房间</span>
              </button>
            ) : null}
          </div>

          <div className="mt-8 flex items-start gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white/40 px-6 py-5 text-[14px] text-[var(--muted)] backdrop-blur-sm transition-colors hover:bg-white/60">
            <span className="mt-0.5 inline-flex rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[12px] font-bold text-[var(--accent)]">提示</span>
            <p className="leading-relaxed font-medium">
              {isBusy ? "正在处理房间操作..." : notice || "当前可以继续创建新房间，或者回到已有聊天。"}
            </p>
          </div>
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="房间总数" value={roomSummary.totalRooms} description="当前数据库里的全部房间数。" />
        <SummaryCard label="群聊房间" value={roomSummary.groupRooms} description="多模型按顺序发言的群聊房间。" />
        <SummaryCard label="单聊房间" value={roomSummary.singleRooms} description="只绑定一个模型的单聊房间。" />
        <SummaryCard label="消息总量" value={roomSummary.totalMessages} description="所有房间累计保存的消息数。" />
      </section>

      <section className="ly-glass rounded-[3.5rem] p-8 sm:p-10 shadow-lg shadow-black/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
              <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">筛选面板</p>
            </div>
            <h2 className="mt-4 text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">筛选你现在想继续的房间</h2>
          </div>
          <div className="rounded-full border border-white/60 bg-white/50 px-5 py-2.5 text-[12px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm">
            当前显示 {filteredRooms.length} / {rooms.length} 个房间
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_200px_240px]">
          <div className="relative group">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--muted)]/50 group-focus-within:text-[var(--accent)] transition-all duration-300">搜索</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索房间名称、模型名称或模型 ID"
              className="w-full rounded-[1.75rem] border border-white/40 bg-white/50 pl-14 pr-6 py-5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 backdrop-blur-md shadow-inner"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as RoomFilterType)}
            className="w-full rounded-[1.75rem] border border-white/40 bg-white/50 px-6 py-5 text-[15px] font-bold text-[var(--foreground)] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md appearance-none shadow-sm cursor-pointer"
          >
            <option value="ALL">全部类型</option>
            <option value="GROUP">群聊</option>
            <option value="SINGLE">单聊</option>
          </select>
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")}
            className="w-full rounded-[1.75rem] border border-white/40 bg-white/50 px-6 py-5 text-[15px] font-bold text-[var(--foreground)] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md appearance-none shadow-sm cursor-pointer"
          >
            <option value="ALL">全部 Provider</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {getProviderOptionLabel(provider)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {rooms.length === 0 ? (
          <div className="ly-glass rounded-[3rem] px-8 py-12 text-[15px] font-medium leading-relaxed text-[var(--muted)] text-center shadow-sm xl:col-span-2">
            {mockToolsEnabled
              ? "还没有房间。你可以先去模型管理页配置模型，或者直接创建一个本地测试房间。"
              : "还没有房间。你可以先去模型管理页配置模型，再创建你的第一个正式房间。"}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="ly-glass rounded-[3rem] px-8 py-12 text-[15px] font-medium leading-relaxed text-[var(--muted)] text-center shadow-sm xl:col-span-2">
            没有符合当前筛选条件的房间，试试清空关键词或切换类型、Provider。
          </div>
        ) : (
          filteredRooms.map((room) => {
            const orderedModels = [...room.roomModels].sort((a, b) => a.sortOrder - b.sortOrder);

            return (
              <article
                key={room.id}
                className="ly-glass group overflow-hidden rounded-[3rem] p-6 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_32px_64px_rgba(47,46,51,0.08)] hover:border-white/80 sm:p-8"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-[linear-gradient(135deg,rgba(31,47,68,0.1),rgba(31,47,68,0.05))] border border-white/40 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-[var(--navy)] uppercase shadow-sm">
                          {toRoomLabel(room.type)}
                        </span>
                        <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm">
                          {room.roomModels.length} 个模型
                        </span>
                        <span className="rounded-full border border-white/60 bg-white/40 px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm">
                          {room.messageCount} 条消息
                        </span>
                      </div>
                      <h3 className="mt-5 text-3xl font-display font-bold tracking-tight text-[var(--foreground)] truncate">{room.title}</h3>
                      <p className="mt-2 text-[13px] font-medium text-[var(--muted)] opacity-80">更新于 {formatDate(room.updatedAt)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0 pt-2 lg:pt-0">
                      <Link
                        href={`/rooms/${room.id}`}
                        className="rounded-full bg-[linear-gradient(135deg,#993c50,#c7576f)] px-6 py-2.5 text-[13px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/30 hover:-translate-y-0.5 active:scale-95"
                      >
                        进入聊天
                      </Link>
                      <Link
                        href={`/rooms/${room.id}/edit`}
                        className="rounded-full border border-white/60 bg-white/40 px-5 py-2.5 text-[13px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-white hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void renameRoom(room))}
                        className="rounded-full border border-white/60 bg-white/40 px-5 py-2.5 text-[13px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-white hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95"
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void deleteRoom(room))}
                        className="rounded-full border border-red-200/50 bg-red-50/50 px-5 py-2.5 text-[13px] font-bold text-red-500 shadow-sm transition-all duration-300 hover:bg-red-500 hover:text-white hover:border-red-500 active:scale-95"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[2.2rem] border border-white/40 bg-[linear-gradient(135deg,rgba(255,255,255,0.4),rgba(255,255,255,0.1))] px-5 py-5 sm:px-6 sm:py-6 backdrop-blur-md shadow-inner">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                        <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">协作链路</p>
                      </div>
                      <span className="text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-widest">执行顺序</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {orderedModels.map((roomModel, index) => (
                        <div key={roomModel.id} className="flex items-center gap-3">
                          <div className="flex items-center gap-4 rounded-full border border-white/60 bg-white/60 px-3 py-2.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-white">
                            <span
                              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] text-[10px] font-bold tracking-[0.2em] shadow-sm ${getProviderIconClassName(
                                roomModel.model.provider,
                              )}`}
                            >
                              {getProviderShortName(roomModel.model.provider)}
                            </span>
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white shadow-sm">
                                  {roomModel.sortOrder}
                                </span>
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${getProviderBadgeClassName(
                                    roomModel.model.provider,
                                  )}`}
                                >
                                  {getProviderOptionLabel(roomModel.model.provider)}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[13px] font-bold leading-none text-[var(--foreground)] truncate max-w-[120px]">
                                {roomModel.model.name}
                              </p>
                            </div>
                          </div>
                          {index < orderedModels.length - 1 ? (
                            <svg className="w-5 h-5 text-[var(--accent)] opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2.2rem] border border-white/40 bg-white/30 px-5 py-5 sm:px-6 sm:py-6 backdrop-blur-md transition-colors hover:bg-white/40">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] opacity-60" />
                          <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--muted)] uppercase">最近动态</p>
                        </div>
                        <p className="mt-2 text-[12px] font-bold text-[var(--muted)] opacity-80">
                          {room.lastMessagePreview
                            ? `${toRoleLabel(room.lastMessagePreview.role)} · ${formatDate(room.lastMessagePreview.createdAt)}`
                            : "这个房间还没有聊天记录"}
                        </p>
                      </div>
                      <span className={`rounded-full border px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase shadow-sm ${room.messageCount > 0 ? "border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)]" : "border-black/10 bg-black/5 text-[var(--muted)]"}`}>
                        {room.messageCount > 0 ? "进行中" : "待开始"}
                      </span>
                    </div>

                    {room.lastMessagePreview ? (
                      <p className="mt-4 text-[14px] font-medium leading-[1.8] text-[var(--foreground)]">
                        &ldquo;{compactPreviewContent(room.lastMessagePreview.content)}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
