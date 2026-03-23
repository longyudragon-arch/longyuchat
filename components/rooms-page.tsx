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

function compactPreviewContent(content: string, maxLength = 100) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const toneClassName =
    feedback.tone === "warning"
      ? "border-amber-200/50 bg-amber-50/80 text-amber-900"
      : "border-red-200/50 bg-red-50/80 text-red-900";

  return (
    <div className={`rounded-2xl border px-5 py-4 ${toneClassName}`}>
      <p className="text-[14px] font-bold">{feedback.title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed opacity-90">{feedback.description}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed opacity-75">建议：{feedback.suggestion}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="ly-glass flex items-center gap-3 rounded-2xl px-5 py-4 transition-transform hover:-translate-y-0.5">
      <p className="text-2xl font-display font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-[12px] font-bold text-[var(--muted)] tracking-wider uppercase">{label}</p>
    </div>
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
      setNotice("房间列表已同步。");
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
    <main className="ly-shell flex flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
      {/* ─ Header ─ */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight sm:text-3xl">房间列表</h1>
          <p className="mt-1 text-[13px] font-medium text-[var(--muted)] sm:text-[14px]">
            查看历史会话，快速回到对话现场。
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/rooms/new"
            className="rounded-full bg-[linear-gradient(135deg,#993c50,#c7576f)] px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 sm:px-6"
          >
            新建房间
          </Link>
          {mockToolsEnabled && (
            <button
              type="button"
              onClick={() => startTransition(() => void launchLocalWorkspace())}
              disabled={isBusy}
              className="rounded-full border border-white/40 bg-white/30 px-5 py-2.5 text-[13px] font-bold text-[var(--muted)] backdrop-blur-sm transition-all hover:bg-white/60 active:scale-95 disabled:opacity-40"
            >
              本地测试
            </button>
          )}
        </div>
      </section>

      {/* ─ Stats ─ */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatChip label="全部" value={roomSummary.totalRooms} />
        <StatChip label="群聊" value={roomSummary.groupRooms} />
        <StatChip label="单聊" value={roomSummary.singleRooms} />
        <StatChip label="消息" value={roomSummary.totalMessages} />
      </section>

      {/* ─ Filters ─ */}
      <section className="ly-glass rounded-2xl p-4 sm:rounded-[2rem] sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_200px]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索房间或模型名称..."
            className="w-full rounded-xl border border-white/30 bg-white/40 px-4 py-3 text-[14px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent)]/10 backdrop-blur-sm"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as RoomFilterType)}
            className="w-full rounded-xl border border-white/30 bg-white/40 px-4 py-3 text-[14px] font-bold outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-sm appearance-none cursor-pointer"
          >
            <option value="ALL">全部类型</option>
            <option value="GROUP">群聊</option>
            <option value="SINGLE">单聊</option>
          </select>
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")}
            className="w-full rounded-xl border border-white/30 bg-white/40 px-4 py-3 text-[14px] font-bold outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-sm appearance-none cursor-pointer"
          >
            <option value="ALL">全部 Provider</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {getProviderOptionLabel(provider)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px] font-medium text-[var(--muted)]">
          <span>显示 {filteredRooms.length} / {rooms.length} 个房间</span>
          {notice && <span className="text-[var(--accent)]">{notice}</span>}
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      {/* ─ Room cards ─ */}
      <section className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        {rooms.length === 0 ? (
          <div className="ly-glass rounded-2xl px-6 py-10 text-center text-[14px] font-medium text-[var(--muted)] xl:col-span-2">
            {mockToolsEnabled
              ? "还没有房间。去模型管理配置模型，或直接创建本地测试房间。"
              : "还没有房间。先配置模型，再创建第一个聊天房间。"}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="ly-glass rounded-2xl px-6 py-10 text-center text-[14px] font-medium text-[var(--muted)] xl:col-span-2">
            没有符合条件的房间，试试调整筛选条件。
          </div>
        ) : (
          filteredRooms.map((room) => {
            const orderedModels = [...room.roomModels].sort((a, b) => a.sortOrder - b.sortOrder);

            return (
              <article
                key={room.id}
                className="ly-glass group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 sm:rounded-[1.8rem]"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--navy)]/8 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--navy)] uppercase">
                        {toRoomLabel(room.type)}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--muted)]">
                        {room.roomModels.length} 模型 · {room.messageCount} 条消息
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-lg font-display font-bold tracking-tight text-[var(--foreground)] truncate sm:text-xl">
                      {room.title}
                    </h3>
                    <p className="mt-1 text-[12px] font-medium text-[var(--muted)]">
                      更新于 {formatDate(room.updatedAt)}
                    </p>
                  </div>
                  <Link
                    href={`/rooms/${room.id}`}
                    className="shrink-0 rounded-xl bg-[linear-gradient(135deg,#993c50,#c7576f)] px-4 py-2 text-[13px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                  >
                    进入
                  </Link>
                </div>

                {/* Model chain */}
                <div className="mt-4 flex items-center gap-2 overflow-x-auto px-5 scrollbar-none sm:px-6">
                  {orderedModels.map((roomModel, index) => (
                    <div key={roomModel.id} className="flex shrink-0 items-center gap-1.5">
                      <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/50 px-2.5 py-1.5 backdrop-blur-sm">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-bold tracking-wide ${getProviderIconClassName(roomModel.model.provider)}`}
                        >
                          {getProviderShortName(roomModel.model.provider)}
                        </span>
                        <span className="text-[12px] font-semibold text-[var(--foreground)] truncate max-w-[90px]">
                          {roomModel.model.name}
                        </span>
                      </div>
                      {index < orderedModels.length - 1 && (
                        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>

                {/* Last message preview + actions */}
                <div className="mt-4 border-t border-white/15 px-5 py-3.5 sm:px-6 sm:py-4">
                  {room.lastMessagePreview ? (
                    <p className="text-[13px] font-medium leading-relaxed text-[var(--foreground)]/80 line-clamp-2">
                      <span className="font-bold text-[var(--muted)]">{toRoleLabel(room.lastMessagePreview.role)}：</span>
                      {compactPreviewContent(room.lastMessagePreview.content)}
                    </p>
                  ) : (
                    <p className="text-[13px] text-[var(--muted)]">暂无消息</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`/rooms/${room.id}/edit`}
                      className="rounded-lg border border-white/40 bg-white/30 px-3 py-1.5 text-[12px] font-bold text-[var(--muted)] transition hover:bg-white/60 hover:text-[var(--accent)] active:scale-95"
                    >
                      编辑
                    </Link>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void renameRoom(room))}
                      className="rounded-lg border border-white/40 bg-white/30 px-3 py-1.5 text-[12px] font-bold text-[var(--muted)] transition hover:bg-white/60 hover:text-[var(--accent)] active:scale-95"
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void deleteRoom(room))}
                      className="rounded-lg border border-red-200/30 bg-red-50/30 px-3 py-1.5 text-[12px] font-bold text-red-400 transition hover:bg-red-500 hover:text-white active:scale-95"
                    >
                      删除
                    </button>
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
