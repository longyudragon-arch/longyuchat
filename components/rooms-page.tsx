"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { ChatSectionNav } from "@/components/chat-section-nav";
import {
  bootstrapLocalTestWorkspace,
  describeClientError,
  fetchJson,
  formatDate,
  getProviderOptionLabel,
  providerOptions,
  supportsLocalMockTools,
  toRoleLabel,
  toRoomLabel,
  type ClientErrorFeedback,
} from "@/lib/client/longyuchat-client";
import { getModelAvatarPalette, resolveModelAvatar } from "@/lib/model-avatar";
import type { ProviderType, RoomType, RoomView } from "@/types/app";

type RoomFilterType = RoomType | "ALL";

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

  const roomStats = useMemo(() => {
    const groupCount = rooms.filter((room) => room.type === "GROUP").length;
    const singleCount = rooms.filter((room) => room.type === "SINGLE").length;
    const participantCount = rooms.reduce((sum, room) => sum + room.roomModels.length, 0);

    return {
      groupCount,
      singleCount,
      participantCount,
    };
  }, [rooms]);

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
    <main className="ly-page-wrap ly-page-chat">
      <div className="ly-shell page-rise flex flex-col gap-5">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-stretch">
        <div className="ly-glass flex h-full rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
          {/* ─ Header & Search ─ */}
          <header className="ly-chat-domain-header w-full">
            <div className="ly-chat-domain-top">
              <div className="ly-page-heading">
                <h1 className="ly-page-title">AI 聊天室</h1>
                <p className="ly-page-subtitle">
                  共 {rooms.length} 个房间
                </p>
              </div>
              <ChatSectionNav />
            </div>
            <div className="ly-chat-domain-tools">
              <div className="relative w-full sm:w-80">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索房间或模型..."
                  className="ly-page-control w-full bg-white border border-stone-200 focus:border-[#2563EB] focus:ring focus:ring-[#60A5FA]/20 pl-12 pr-4 py-3 text-sm font-medium outline-none transition-all shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                />
              </div>
              {mockToolsEnabled && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => void launchLocalWorkspace())}
                    disabled={isBusy}
                    className="ly-page-action ly-page-control ly-secondary-action w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 active:scale-95 outline-none"
                  >
                    本地测试
                  </button>
              )}
            </div>
          </header>
        </div>

        <div className="ly-surface-card grid h-full gap-4 rounded-[1.75rem] p-5 sm:grid-cols-3 sm:p-6">
          <div className="flex min-h-full flex-col justify-center rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">群聊房间</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#0F1A2B]">{roomStats.groupCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">多个模型依次协作回复的房间数量。</p>
          </div>
          <div className="flex min-h-full flex-col justify-center rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">单聊房间</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#0F1A2B]">{roomStats.singleCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">适合做单模型测试与快速追问的会话。</p>
          </div>
          <div className="flex min-h-full flex-col justify-center rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">协作节点</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#0F1A2B]">{roomStats.participantCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">当前所有房间中已编入协作链的模型总数。</p>
          </div>
        </div>
      </div>

      <div className="ly-glass rounded-[1.75rem] px-5 py-6 sm:rounded-[2rem] sm:px-7 sm:py-7">

        {/* ─ Filters ─ */}
        <section className="flex flex-wrap items-center gap-3 mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-stone-400 mr-2">筛选</span>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as RoomFilterType)}
              className="ly-pill-filter appearance-none pr-10 outline-none cursor-pointer border-none focus:ring-2 focus:ring-[#60A5FA]/40"
            >
              <option value="ALL">全部类型</option>
              <option value="GROUP">群聊 (GROUP)</option>
              <option value="SINGLE">单聊 (SINGLE)</option>
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className="relative">
            <select
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")}
              className="ly-pill-filter appearance-none pr-10 outline-none cursor-pointer border-none focus:ring-2 focus:ring-[#60A5FA]/40"
            >
              <option value="ALL">全部厂商</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {getProviderOptionLabel(provider)}
                </option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
          {notice && <span className="ml-auto text-[12px] font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">{notice}</span>}
        </section>

        {feedback ? <div className="mb-6"><FeedbackPanel feedback={feedback} /></div> : null}

        {/* ─ Delete confirmation modal ─ */}
        {roomToDelete && (
          <DeleteConfirmModal
            roomTitle={roomToDelete.title}
            onConfirm={() => startTransition(() => void deleteRoom(roomToDelete))}
            onCancel={() => setRoomToDelete(null)}
          />
        )}

        {/* ─ Room Cards ─ */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.length === 0 ? (
            <div className="ly-empty-card md:col-span-2 lg:col-span-3 mt-4 grid gap-6 p-8 text-left lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] lg:p-10">
              <div className="space-y-4">
                <div className="ly-surface-card flex h-16 w-16 items-center justify-center rounded-2xl">
                  <svg className="w-8 h-8 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </div>
                <h2 className="text-3xl font-display font-bold tracking-tight text-[#2563EB]">准备开启新对话？</h2>
                <p className="max-w-2xl text-[15px] leading-7 text-[#475569]">
                  {mockToolsEnabled
                    ? "当前还没有房间。你可以先去模型管理配置真实模型，或者直接生成本地测试工作区，先体验多模型顺序协作。"
                    : "当前还没有房间。建议先配置模型，再创建第一个单聊或群聊房间。"}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/rooms/new" className="ly-primary-action inline-flex px-6 py-3 font-bold">
                    现在创建房间
                  </Link>
                  <Link href="/models" className="ly-secondary-action inline-flex px-6 py-3 font-bold text-[#0F1A2B]">
                    先去配置模型
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  "先准备 1 到 3 个模型，确认 API Key 和模型 ID 都可用。",
                  "进入新建房间，选择模型并排好顺序。",
                  "发送一条消息，观察模型依次接力回复。",
                ].map((item, index) => (
                  <div key={item} className="rounded-[1.35rem] bg-white/45 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">步骤 {index + 1}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="ly-surface-card md:col-span-2 lg:col-span-3 mt-8 p-12 text-center">
              <p className="text-[#475569] text-sm font-medium">没有符合条件的房间，试试调整筛选条件。</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const orderedModels = [...room.roomModels].sort((a, b) => a.sortOrder - b.sortOrder);

              return (
                <article
                  key={room.id}
                  className="group relative ly-surface-card ly-surface-card-hover overflow-hidden p-6"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#60A5FA]/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-wrap items-center gap-1.5 z-10">
                       <span className={`px-2.5 py-1 ${room.type === 'GROUP' ? 'bg-[#60A5FA]/20 text-[#2563EB]' : 'bg-[#2563EB]/20 text-[#2563EB]'} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
                          {toRoomLabel(room.type)}
                       </span>
                    </div>
                    <div className="relative z-10">
                       <button
                         type="button"
                         title={`更多操作：${room.title}`}
                         onClick={(e) => {
                           e.preventDefault();
                           setOpenMenuId(openMenuId === room.id ? null : room.id);
                         }}
                         className={`ly-icon-button rounded-lg ${openMenuId === room.id ? "bg-stone-100 text-[#0F1A2B]" : "text-stone-400 hover:bg-stone-50 hover:text-[#0F1A2B]"}`}
                       >
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>
                       </button>
                       {openMenuId === room.id && (
                         <>
                           <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); setOpenMenuId(null); }} />
                           <div className="ly-menu-panel absolute right-0 top-full z-50 mt-2 w-36 animate-chat-in py-2">
                             <button type="button" onClick={(e) => { e.preventDefault(); setOpenMenuId(null); startTransition(() => void renameRoom(room)); }} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-bold text-[#0F1A2B] transition hover:bg-stone-50">
                               重命名
                             </button>
                             <Link href={`/rooms/${room.id}/edit`} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-bold text-[#0F1A2B] transition hover:bg-stone-50">
                               编辑配置
                             </Link>
                             <div className="my-1 border-t border-stone-100" />
                             <button type="button" onClick={(e) => { e.preventDefault(); setOpenMenuId(null); setRoomToDelete(room); }} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-bold text-red-500 transition hover:bg-red-50">
                               删除房间
                             </button>
                           </div>
                         </>
                       )}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-[#2563EB] mb-2 truncate z-10 relative">
                    {room.title}
                  </h3>
                  
                  {/* Model preview dots */}
                  <div className="flex items-center gap-2 mb-6 z-10 relative">
                     <div className="flex -space-x-2">
                     {orderedModels.slice(0, 3).map((rm) => {
                              const avatar = resolveModelAvatar(
                                rm.model.provider,
                                rm.model.baseUrl,
                                rm.model.avatarLabel,
                                rm.model.avatarColor,
                              );
                              const avatarPalette = getModelAvatarPalette(rm.model.provider, avatar.avatarColor);

                        return (
                          <div
                            key={rm.id}
                            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold"
                            style={{
                              backgroundColor: avatarPalette.baseColor,
                              color: avatarPalette.textColor,
                              boxShadow: `0 8px 18px ${avatarPalette.shadowColor}`,
                            }}
                          >
                                {avatar.avatarLabel}
                          </div>
                        );
                     })}
                     {orderedModels.length > 3 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-500">
                           +{orderedModels.length - 3}
                        </div>
                     )}
                     </div>
                     <span className="text-[10px] font-semibold text-stone-400">
                        {orderedModels.length} 个组合模型
                     </span>
                  </div>

                  {/* Message Preview */}
                  <div className="ly-soft-card relative mb-6 h-20 overflow-hidden p-4">
                     <p className="text-[10px] font-extrabold text-stone-400 uppercase tracking-tighter mb-1.5">最新消息预览</p>
                     {room.lastMessagePreview ? (
                        <p className="text-xs text-stone-600 font-medium leading-relaxed truncate block">
                           <span className="font-bold text-stone-500">{toRoleLabel(room.lastMessagePreview.role)}: </span>
                           {room.lastMessagePreview.content}
                        </p>
                     ) : (
                        <p className="text-xs text-stone-400 italic font-medium">当前房间暂无历史消息</p>
                     )}
                     {/* Gradient mask at the bottom for long texts */}
                     <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[rgba(249,245,252,0.8)] to-transparent"></div>
                  </div>

                  <div className="flex items-center justify-between pt-5 border-t border-stone-100 z-10 relative">
                    <div className="flex items-center gap-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                       <span className="flex items-center gap-1.5">
                          更新: {formatDate(room.updatedAt)}
                       </span>
                    </div>
                    <Link
                      href={`/rooms/${room.id}`}
                      className="ly-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white/40 text-stone-400 shadow-sm group-hover:bg-gradient-to-br group-hover:from-[#2563EB] group-hover:to-[#60A5FA] group-hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
      </div>
    </main>
  );
}
