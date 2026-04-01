"use client";

import type { ClientErrorFeedback, ModelOperationalInsight } from "@/lib/client/chat-lab-client";
import type { ModelTestResultView } from "@/types/app";

export function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const tone =
    feedback.tone === "warning"
      ? "border-amber-200/50 bg-amber-50/80 text-amber-900"
      : "border-red-200/50 bg-red-50/80 text-red-900";

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-[13px] font-bold">{feedback.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-90">{feedback.description}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-75">建议：{feedback.suggestion}</p>
    </div>
  );
}

export function TestState({ state, running }: { state: ModelTestResultView | null; running: boolean }) {
  if (running) {
    return (
      <span className="rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-600 tracking-wide uppercase animate-pulse">
        测试中
      </span>
    );
  }

  if (!state) {
    return (
      <span className="rounded-md bg-black/5 border border-black/10 px-2 py-0.5 text-[10px] font-bold text-[var(--muted)] tracking-wide uppercase">
        未测试
      </span>
    );
  }

  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
        state.status === "success"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
          : "bg-red-500/10 border-red-500/20 text-red-600"
      }`}
    >
      {state.status === "success" ? "连接成功" : "连接失败"}
    </span>
  );
}

export function ModelInsightNotice({ insight }: { insight: ModelOperationalInsight }) {
  const toneClass =
    insight.tone === "warning"
      ? "border-amber-200/70 bg-amber-50/80 text-amber-900"
      : "border-red-200/70 bg-red-50/80 text-red-900";
  const badgeClass =
    insight.tone === "warning"
      ? "border-amber-300/70 bg-amber-100/70 text-amber-800"
      : "border-red-300/70 bg-red-100/80 text-red-700";

  return (
    <div className={`mt-3 ml-2 rounded-2xl border px-3.5 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${badgeClass}`}>
          {insight.shortLabel}
        </span>
        <p className="text-[12px] font-bold">{insight.title}</p>
      </div>
      <p className="mt-1 text-[12px] leading-6 opacity-90">{insight.description}</p>
      <p className="mt-1 text-[11px] leading-5 opacity-75">建议：{insight.suggestion}</p>
    </div>
  );
}

export function FieldErrorHint({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="ml-1 text-[11px] leading-5 text-red-600">{message}</p>;
}

export function getInputErrorClass(message?: string) {
  return message
    ? "border-red-300/70 bg-red-50/70 text-red-950 placeholder:text-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200/70"
    : "";
}

export function getGlassMenuOptionClassName(isActive: boolean) {
  return `group flex w-full items-start gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-all duration-200 ${
    isActive
      ? "border-[color:color-mix(in_srgb,var(--accent)_24%,white_76%)] bg-[color:color-mix(in_srgb,var(--accent)_12%,white_88%)] shadow-[0_12px_30px_rgba(220,117,165,0.12)]"
      : "border-transparent bg-white/35 hover:-translate-y-[1px] hover:border-white/70 hover:bg-white/78 hover:shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
  }`;
}

export function MenuCheck({ visible }: { visible: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
        visible
          ? "border-[var(--accent)]/30 bg-[var(--accent)]/14 text-[var(--accent)] opacity-100"
          : "border-transparent bg-transparent text-transparent opacity-0 group-hover:opacity-100"
      }`}
      aria-hidden="true"
    >
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
        <path
          d="M5 10.5L8.5 14L15 7.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
