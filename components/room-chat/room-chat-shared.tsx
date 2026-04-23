import type { ClientErrorFeedback } from "@/lib/client/longyuchat-client";

export function FeedbackPanel({ feedback, onDismiss }: { feedback: ClientErrorFeedback | null; onDismiss: () => void }) {
  if (!feedback) return null;

  const toneClass =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50/90 text-amber-900"
      : "border-red-200 bg-red-50/90 text-red-900";

  return (
    <div
      data-testid="room-feedback-panel"
      data-feedback-tone={feedback.tone}
      className={`ly-surface-card animate-chat-in mx-auto max-w-3xl px-4 py-2.5 ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{feedback.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed opacity-90">{feedback.description}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed opacity-75">建议：{feedback.suggestion}</p>
        </div>
        <button type="button" onClick={onDismiss} className="shrink-0 rounded-md p-1 text-current opacity-50 transition hover:opacity-100">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

export function RoomModelAlert({
  modelName,
  shortLabel,
  title,
  description,
  suggestion,
  tone,
}: {
  modelName: string;
  shortLabel: string;
  title: string;
  description: string;
  suggestion: string;
  tone: "warning" | "error";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200/70 bg-amber-50/85 text-amber-900"
      : "border-red-200/70 bg-red-50/85 text-red-900";
  const badgeClass =
    tone === "warning"
      ? "border-amber-300/70 bg-amber-100/80 text-amber-800"
      : "border-red-300/70 bg-red-100/80 text-red-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${badgeClass}`}>{shortLabel}</span>
        <p className="text-[12px] font-bold">{modelName}：{title}</p>
      </div>
      <p className="mt-1 text-[12px] leading-6 opacity-90">{description}</p>
      <p className="mt-1 text-[11px] leading-5 opacity-75">建议：{suggestion}</p>
    </div>
  );
}

export function DeleteConfirmModal({ roomTitle, onConfirm, onCancel }: { roomTitle: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="ly-surface-card animate-chat-in mx-4 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
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
