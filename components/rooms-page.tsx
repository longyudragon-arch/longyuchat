"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  bootstrapLocalTestWorkspace,
  describeClientError,
  fetchJson,
  formatDate,
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
    <div className={`rounded-xl border px-4 py-3 ${toneClassName}`}>
      <p className="text-[13px] font-bold">{feedback.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-90">{feedback.description}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-75">建议：{feedback.suggestion}</p>
    </div>
  );
}

function DeleteConfirmModal({ roomTitle, onConfirm, onCancel }: { roomTitle: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="animate-chat-in mx-4 w-full max-w-sm rounded-2xl bg-white/70 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl border border-white/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </span>
          <h3 className="text-[15px] font-bold tracking-tight">删除房间</h3>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">
          确定要删除房间「<span className="font-bold text-[var(--foreground)]">{roomTitle}</span>」吗？
        </p>
        <p className="mt-1 text-[12px] font-medium text-red-500">删除后不可恢复，房间内的所有聊天记录也会一起删除。</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-[13px] font-bold text-[var(--muted)] transition hover:bg-white active:scale-95">取消</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-red-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-600 active:scale-95">确认删除</button>
        </div>
      </div>
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<RoomView | null>(null);

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

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

    try {
      await loadRooms();
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
    if (!room) return;
    setRoomToDelete(null);
    setOpenMenuId(null);

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
    <main className="ly-shell flex flex-col gap-4 px-4 py-5 sm:gap-5 sm:px-6 sm:py-7">
      {/* ─ Header ─ */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-display font-bold tracking-tight sm:text-2xl">房间列表</h1>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--muted)] sm:text-[13px]">
            共 {rooms.length} 个房间 · {filteredRooms.length !== rooms.length ? `匹配 ${filteredRooms.length} 个` : "查看历史会话"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/rooms/new"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-[var(--accent)]/20 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
          >
            新建房间
          </Link>
          {mockToolsEnabled && (
            <button
              type="button"
              onClick={() => startTransition(() => void launchLocalWorkspace())}
              disabled={isBusy}
              className="rounded-xl border border-white/40 bg-white/30 px-4 py-2 text-[13px] font-bold text-[var(--muted)] backdrop-blur-sm transition-all hover:bg-white/60 active:scale-95 disabled:opacity-40"
            >
              本地测试
            </button>
          )}
        </div>
      </section>

      {/* ─ Filters ─ */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="搜索房间或模型..."
          className="flex-1 rounded-xl border border-white/30 bg-white/40 px-4 py-2.5 text-[13px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 backdrop-blur-sm"
        />
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as RoomFilterType)}
            className="rounded-xl border border-white/30 bg-white/40 px-3 py-2.5 text-[13px] font-bold outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-sm appearance-none cursor-pointer"
          >
            <option value="ALL">全部类型</option>
            <option value="GROUP">群聊</option>
            <option value="SINGLE">单聊</option>
          </select>
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")}
            className="rounded-xl border border-white/30 bg-white/40 px-3 py-2.5 text-[13px] font-bold outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-sm appearance-none cursor-pointer"
          >
            <option value="ALL">全部 Provider</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {getProviderOptionLabel(provider)}
              </option>
            ))}
          </select>
        </div>
        {notice && <span className="text-[12px] font-medium text-[var(--accent)]">{notice}</span>}
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      {/* ─ Delete confirmation modal ─ */}
      {roomToDelete && (
        <DeleteConfirmModal
          roomTitle={roomToDelete.title}
          onConfirm={() => startTransition(() => void deleteRoom(roomToDelete))}
          onCancel={() => setRoomToDelete(null)}
        />
      )}

      {/* ─ Room cards ─ */}
      <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        {rooms.length === 0 ? (
          <div className="ly-glass rounded-xl px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)] xl:col-span-2">
            {mockToolsEnabled
              ? "还没有房间。去模型管理配置模型，或直接创建本地测试房间。"
              : "还没有房间。先配置模型，再创建第一个聊天房间。"}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="ly-glass rounded-xl px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)] xl:col-span-2">
            没有符合条件的房间，试试调整筛选条件。
          </div>
        ) : (
          filteredRooms.map((room) => {
            const orderedModels = [...room.roomModels].sort((a, b) => a.sortOrder - b.sortOrder);

            return (
              <article
                key={room.id}
                className="ly-glass group overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 sm:rounded-2xl"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-[var(--navy)]/8 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--navy)] uppercase">
                        {toRoomLabel(room.type)}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--muted)]">
                        {room.roomModels.length} 模型 · {room.messageCount} 消息
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-[15px] font-display font-bold tracking-tight text-[var(--foreground)] truncate sm:text-[17px]">
                      {room.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">
                      更新于 {formatDate(room.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="shrink-0 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm shadow-[var(--accent)]/20 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                    >
                      进入
                    </Link>
                    <div className="relative">
                      <button
                        type="button"
                        title={`更多操作：${room.title}`}
                        aria-label={`更多操作：${room.title}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenMenuId(openMenuId === room.id ? null : room.id);
                        }}
                        className={`rounded-lg p-1.5 transition active:scale-95 ${openMenuId === room.id ? "bg-[var(--accent)] text-white" : "bg-black/5 text-[var(--muted)] hover:bg-black/10 text-[var(--foreground)]"}`}
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>
                      </button>
                      {openMenuId === room.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); setOpenMenuId(null); }} />
                          <div className="absolute right-0 top-full z-50 mt-1.5 w-36 animate-chat-in rounded-xl border border-white/40 bg-white/60 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
                            <button type="button" onClick={(e) => { e.preventDefault(); setOpenMenuId(null); startTransition(() => void renameRoom(room)); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-[var(--foreground)] transition hover:bg-black/5">
                              重命名
                            </button>
                            <Link href={`/rooms/${room.id}/edit`} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-[var(--foreground)] transition hover:bg-black/5">
                              编辑配置
                            </Link>
                            <div className="my-1 border-t border-black/5" />
                            <button type="button" onClick={(e) => { e.preventDefault(); setOpenMenuId(null); setRoomToDelete(room); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-red-500 transition hover:bg-red-50">
                              删除房间
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Model chain (simplified) */}
                <div className="mt-2.5 flex items-center px-4 sm:px-5">
                  {orderedModels.length > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/50 px-2.5 py-1.5 backdrop-blur-sm">
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[7px] font-bold tracking-wide ${getProviderIconClassName(orderedModels[0].model.provider)}`}>
                        {getProviderShortName(orderedModels[0].model.provider)}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--foreground)] max-w-[120px] truncate">
                        {orderedModels[0].model.name}
                      </span>
                      {orderedModels.length > 1 && (
                        <span className="ml-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-white/60 text-[var(--muted)]">
                          +{orderedModels.length - 1} 模型
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Last message preview */}
                <div className="mt-3 border-t border-white/15 px-4 py-3 sm:px-5">
                  {room.lastMessagePreview ? (
                    <p className="text-[12px] font-medium leading-relaxed text-[var(--foreground)]/80 line-clamp-2">
                       <span className="font-bold text-[var(--muted)]">{toRoleLabel(room.lastMessagePreview.role)}：</span>
                      {compactPreviewContent(room.lastMessagePreview.content)}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[var(--muted)]">暂无消息</p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
