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

function compactPreviewContent(content: string, maxLength = 96) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const toneClassName =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`mt-4 rounded-[1.6rem] border px-4 py-4 ${toneClassName}`}>
      <p className="text-sm font-semibold">{feedback.title}</p>
      <p className="mt-2 text-sm leading-6">{feedback.description}</p>
      <p className="mt-2 text-sm leading-6 opacity-90">建议：{feedback.suggestion}</p>
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
    const groupRooms = rooms.filter((room) => room.type === "GROUP").length;
    const singleRooms = rooms.filter((room) => room.type === "SINGLE").length;

    return {
      totalRooms: rooms.length,
      groupRooms,
      singleRooms,
      totalMessages,
    };
  }, [rooms]);

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

    try {
      await loadRooms();
      setNotice("房间列表已经加载完成。");
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

    if (!nextTitle || nextTitle.trim() === room.title) {
      return;
    }

    setActiveAction("renaming-room");
    setFeedback(null);

    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${room.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: nextTitle.trim(),
        }),
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
    const shouldDelete = window.confirm(`确认删除房间「${room.title}」吗？聊天记录也会一起删除。`);

    if (!shouldDelete) {
      return;
    }

    setActiveAction("deleting-room");
    setFeedback(null);

    try {
      await fetchJson(`/api/rooms/${room.id}`, {
        method: "DELETE",
      });

      await loadRooms();
      setNotice(`已删除房间「${room.title}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="rounded-[2.4rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,247,238,0.96),rgba(255,255,255,0.90))] px-5 py-6 shadow-[0_30px_90px_rgba(17,17,17,0.09)] sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full border border-[rgba(191,95,54,0.14)] bg-[rgba(255,246,232,0.88)] px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">
              ROOM HUB
            </span>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">房间列表</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                这里是你所有聊天空间的总入口。你可以按关键词、房间类型和 Provider 快速筛选，再回到任意一个房间继续对话。
              </p>
            </div>
          </div>

          <div className="w-full rounded-3xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--muted)] lg:w-auto">
            {isBusy ? "正在处理..." : notice || "可以继续新建房间，或者回到已有会话。"}
          </div>
        </div>

        {feedback ? <FeedbackPanel feedback={feedback} /> : null}
      </section>

      <section className="grid gap-3 sm:flex sm:flex-wrap">
        <Link
          href="/rooms/new"
          className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] sm:w-auto"
        >
          去新建房间
        </Link>
        <Link
          href="/models"
          className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-3 text-center text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
        >
          先去配置模型
        </Link>
        {mockToolsEnabled ? (
          <button
            type="button"
            onClick={() => startTransition(() => void launchLocalWorkspace())}
            className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-3 text-center text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
          >
            一键创建本地测试房间
          </button>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.9rem] border border-[var(--border)] bg-[var(--card)] px-5 py-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)]">
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--muted)]">TOTAL ROOMS</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{roomSummary.totalRooms}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">当前数据库里的全部房间数。</p>
        </article>
        <article className="rounded-[1.9rem] border border-[var(--border)] bg-[var(--card)] px-5 py-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)]">
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--muted)]">GROUP CHATS</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{roomSummary.groupRooms}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">多模型按顺序发言的群聊房间。</p>
        </article>
        <article className="rounded-[1.9rem] border border-[var(--border)] bg-[var(--card)] px-5 py-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)]">
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--muted)]">SINGLE CHATS</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{roomSummary.singleRooms}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">只绑定一个模型的单聊房间。</p>
        </article>
        <article className="rounded-[1.9rem] border border-[var(--border)] bg-[var(--card)] px-5 py-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)]">
          <p className="text-xs font-medium tracking-[0.16em] text-[var(--muted)]">MESSAGES</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{roomSummary.totalMessages}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">当前所有房间累计保存的消息数。</p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_220px]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索房间名称、模型名称或模型 ID"
            className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as RoomFilterType)}
            className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
          >
            <option value="ALL">全部类型</option>
            <option value="GROUP">群聊</option>
            <option value="SINGLE">单聊</option>
          </select>
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")}
            className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
          >
            <option value="ALL">全部 Provider</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {getProviderOptionLabel(provider)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
          当前显示 {filteredRooms.length} / {rooms.length} 个房间。
        </div>
      </section>

      <section className="space-y-4">
        {rooms.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-8 text-sm text-[var(--muted)]">
            {mockToolsEnabled
              ? "还没有房间。你可以先去模型管理页配置模型，或者直接创建一个本地测试房间。"
              : "还没有房间。你可以先去模型管理页配置模型，再创建你的第一个正式房间。"}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-8 text-sm text-[var(--muted)]">
            没有符合当前筛选条件的房间，试试清空关键词或切换类型、Provider。
          </div>
        ) : (
          filteredRooms.map((room) => (
            <article
              key={room.id}
              className="rounded-[2.2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6"
            >
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold">{room.title}</h2>
                      <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                        {toRoomLabel(room.type)}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                        {room.roomModels.length} 个模型
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                        {room.messageCount} 条消息
                      </span>
                    </div>

                    <p className="text-sm text-[var(--muted)]">最近更新于 {formatDate(room.updatedAt)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                    >
                      进入聊天
                    </Link>
                    <Link
                      href={`/rooms/${room.id}/edit`}
                      className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      编辑房间
                    </Link>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void renameRoom(room))}
                      className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void deleteRoom(room))}
                      className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {room.roomModels.map((roomModel) => (
                    <div
                      key={roomModel.id}
                      className="flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-white px-3 py-2"
                    >
                      <span
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(
                          roomModel.model.provider,
                        )}`}
                      >
                        {getProviderShortName(roomModel.model.provider)}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--border)] bg-[rgb(246,244,238)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                            顺序 {roomModel.sortOrder}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(
                              roomModel.model.provider,
                            )}`}
                          >
                            {getProviderShortName(roomModel.model.provider)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{roomModel.model.name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {getProviderOptionLabel(roomModel.model.provider)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/70 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">最近一条消息</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {room.lastMessagePreview
                          ? `${toRoleLabel(room.lastMessagePreview.role)} · ${formatDate(room.lastMessagePreview.createdAt)}`
                          : "这个房间还没有聊天记录"}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                      {room.messageCount > 0 ? "可继续聊" : "等待第一条消息"}
                    </span>
                  </div>
                  {room.lastMessagePreview ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                      {compactPreviewContent(room.lastMessagePreview.content)}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
