"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { bootstrapLocalTestWorkspace } from "@/lib/client/chat-lab-client";

export function LocalTestLauncher() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLaunch() {
    setBusy(true);
    setErrorMessage("");

    try {
      const room = await bootstrapLocalTestWorkspace();
      router.push(`/rooms/${room.id}`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "创建本地测试环境失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-[var(--border)] bg-[rgba(191,95,54,0.08)] p-6">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">Quick Test</p>
      <h2 className="mt-3 text-2xl font-semibold">一键生成本地演示环境</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
        不需要真实 API Key。按钮会自动创建 3 个本地模拟模型和 1 个群聊房间，然后直接跳到聊天页，方便你测试顺序回复和历史保存。
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => startTransition(() => void handleLaunch())}
          className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={busy}
        >
          {busy ? "正在准备..." : "创建本地测试环境"}
        </button>
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
      </div>
    </div>
  );
}
