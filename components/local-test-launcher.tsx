"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { bootstrapLocalTestWorkspace, supportsLocalMockTools } from "@/lib/client/chat-lab-client";

export function LocalTestLauncher() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const mockToolsEnabled = supportsLocalMockTools();

  if (!mockToolsEnabled) {
    return null;
  }

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
    <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,244,232,0.92),rgba(255,255,255,0.92))] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">本地沙盒</p>
          <h2 className="mt-3 text-2xl font-semibold">一键生成本地演示环境</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            不需要真实 API Key。系统会自动创建 3 个本地 mock 模型和 1 个测试群聊房间，方便你快速验证顺序回复、消息保存和聊天页交互。
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <button
            type="button"
            onClick={() => startTransition(() => void handleLaunch())}
            className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300 lg:w-auto"
            disabled={busy}
          >
            {busy ? "正在准备..." : "创建本地测试环境"}
          </button>
          {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        </div>
      </div>
    </section>
  );
}
