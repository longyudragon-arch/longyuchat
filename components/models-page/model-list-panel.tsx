"use client";

import type { ReactNode } from "react";

import {
  formatDate,
  formatModelTestMessage,
  formatReplyLength,
  getModelOperationalInsight,
  getProviderBadgeClassName,
  getProviderChineseLabel,
  getProviderOptionLabel,
} from "@/lib/client/chat-lab-client";
import { resolveModelAvatar } from "@/lib/model-avatar";
import { getAvatarPreviewStyle } from "@/components/models-page/model-builder";
import { ModelInsightNotice, TestState } from "@/components/models-page/shared-ui";
import type { ModelView, ProviderType } from "@/types/app";

interface ModelListPanelProps {
  models: ModelView[];
  filteredModels: ModelView[];
  searchQuery: string;
  providerFilter: ProviderType | "ALL";
  providerOptions: ProviderType[];
  runningTestModelId: string | null;
  mockToolsEnabled: boolean;
  onSearchQueryChange: (value: string) => void;
  onProviderFilterChange: (value: ProviderType | "ALL") => void;
  onFillLocalMockPreset: () => void;
  onCreateLocalMocks: () => void;
  onEditModel: (model: ModelView) => void;
  onTestModel: (model: ModelView) => void;
  onToggleModel: (model: ModelView) => void;
  onRemoveModel: (model: ModelView) => void;
}

function renderEmptySteps(items: string[]) {
  return items.map((item, index) => (
    <div key={item} className="rounded-[1.35rem] bg-white/45 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">
        步骤 {index + 1}
      </p>
      <p className="mt-1 text-sm leading-6 text-stone-600">{item}</p>
    </div>
  ));
}

function getCardTone(model: ModelView) {
  const testStatus = model.lastConnectionTest?.status;
  const isSuccess = testStatus === "success";
  const isFailed = testStatus === "error";
  const isUntested = !model.lastConnectionTest;

  let cardClass = "ly-panel-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ";
  let stripeClass = "";
  let dotClass = "";

  if (!model.enabled) {
    cardClass +=
      "border border-dashed border-stone-300/80 bg-stone-100/60 opacity-60 grayscale hover:opacity-100 hover:grayscale-0";
    stripeClass = "bg-stone-400";
    dotClass = "bg-stone-400";
  } else if (isFailed) {
    cardClass += "ly-glass border-red-300 bg-red-50/30";
    stripeClass = "bg-red-500";
    dotClass = "bg-red-500 animate-pulse";
  } else if (isUntested) {
    cardClass += "ly-glass";
    stripeClass = "bg-amber-400";
    dotClass = "bg-amber-400";
  } else if (isSuccess) {
    cardClass += "ly-glass border-emerald-300/50";
    stripeClass = "bg-emerald-500";
    dotClass = "bg-emerald-500";
  } else {
    cardClass += "ly-glass";
    stripeClass = "bg-stone-300";
    dotClass = "bg-stone-400";
  }

  return { cardClass, stripeClass, dotClass };
}

function renderModelCardActions(
  model: ModelView,
  runningTestModelId: string | null,
  handlers: {
    onEditModel: (model: ModelView) => void;
    onTestModel: (model: ModelView) => void;
    onToggleModel: (model: ModelView) => void;
    onRemoveModel: (model: ModelView) => void;
  },
) {
  const actions: ReactNode[] = [
    <button
      key="edit"
      type="button"
      onClick={() => handlers.onEditModel(model)}
      className="ly-mini-action px-3 py-1.5 text-[11px] font-bold hover:text-[var(--accent)] active:scale-95"
    >
      编辑
    </button>,
    <button
      key="test"
      type="button"
      onClick={() => handlers.onTestModel(model)}
      className="ly-mini-action px-3 py-1.5 text-[11px] font-bold hover:text-sky-600 active:scale-95"
    >
      {runningTestModelId === model.id ? "测试中" : "测试"}
    </button>,
    <button
      key="toggle"
      type="button"
      onClick={() => handlers.onToggleModel(model)}
      className="ly-mini-action px-3 py-1.5 text-[11px] font-bold hover:text-[var(--accent)] active:scale-95"
    >
      {model.enabled ? "停用" : "启用"}
    </button>,
    <button
      key="remove"
      type="button"
      onClick={() => handlers.onRemoveModel(model)}
      className="ly-mini-action border-red-200/50 bg-red-50/50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white active:scale-95"
    >
      删除
    </button>,
  ];

  return actions;
}

export function ModelListPanel({
  models,
  filteredModels,
  searchQuery,
  providerFilter,
  providerOptions,
  runningTestModelId,
  mockToolsEnabled,
  onSearchQueryChange,
  onProviderFilterChange,
  onFillLocalMockPreset,
  onCreateLocalMocks,
  onEditModel,
  onTestModel,
  onToggleModel,
  onRemoveModel,
}: ModelListPanelProps) {
  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="搜索模型名称、ID 或接入地址..."
          className="flex-1 rounded-xl border border-white/40 bg-white/20 px-4 py-2.5 text-[13px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 backdrop-blur-lg"
        />
        <select
          value={providerFilter}
          onChange={(e) => onProviderFilterChange(e.target.value as ProviderType | "ALL")}
          className="ly-glass-select rounded-xl border border-white/40 bg-white/20 px-3 py-2.5 text-[13px] font-bold outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-lg appearance-none"
        >
          <option value="ALL">全部提供商</option>
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>
              {getProviderOptionLabel(provider)}
            </option>
          ))}
        </select>
        {filteredModels.length !== models.length && (
          <span className="text-[12px] font-medium text-[var(--accent)]">
            匹配 {filteredModels.length} 个
          </span>
        )}
      </div>

      {models.length === 0 ? (
        <div className="ly-empty-card grid gap-5 px-6 py-8 text-left lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">
              Model Hub
            </p>
            <h3 className="text-2xl font-display font-bold tracking-tight text-[#2f2e33]">
              先把模型入口准备好，再开始搭建协作房间
            </h3>
            <p className="max-w-2xl text-[14px] leading-7 text-[var(--muted)]">
              从左侧选择提供商或平台模板，填入 Base URL 和 API Key，再补上模型 ID，就能创建一个模型接入。
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onFillLocalMockPreset}
                className="ly-secondary-action rounded-xl px-4 py-2.5 text-[13px] font-bold"
              >
                载入测试预设
              </button>
              {mockToolsEnabled && (
                <button
                  type="button"
                  onClick={onCreateLocalMocks}
                  className="ly-primary-action rounded-xl px-4 py-2.5 text-[13px] font-bold"
                >
                  生成本地 Mock 模型
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {renderEmptySteps([
              "选择提供商或平台模板，Base URL 自动带出。",
              "填入 API Key，点击「获取列表」或手动填写模型 ID。",
              "点击「创建模型」，然后去新建房间开聊。",
            ])}
          </div>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="ly-empty-card px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)]">
          没有匹配模型，试试清空关键词或切换 Provider。
        </div>
      ) : (
        filteredModels.map((model) => {
          const { cardClass, stripeClass, dotClass } = getCardTone(model);
          const modelInsight = getModelOperationalInsight(model);
          const resolvedAvatar = resolveModelAvatar(
            model.provider,
            model.baseUrl,
            model.avatarLabel,
            model.avatarColor,
          );

          return (
            <article key={model.id} className={`${cardClass} min-w-0`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-[inherit] ${stripeClass}`} />

              <div className="flex items-start gap-4 pl-2">
                <div className="relative shrink-0">
                  <span
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide shadow-md transition-transform duration-300 group-hover:scale-105"
                    style={getAvatarPreviewStyle(model.provider, resolvedAvatar.avatarColor)}
                  >
                    {resolvedAvatar.avatarLabel}
                  </span>
                  <span
                    className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white ${dotClass}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-display font-bold tracking-tight">{model.name}</h3>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                        model.enabled
                          ? "border-emerald-200/50 bg-emerald-50/80 text-emerald-700"
                          : "border-stone-300 bg-stone-100 text-stone-500"
                      }`}
                    >
                      {model.enabled ? "已启用" : "已停用"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${getProviderBadgeClassName(model.provider)}`}
                    >
                      {getProviderChineseLabel(model.provider)}
                    </span>
                    <span className="rounded-md border border-white/60 bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">
                      {formatReplyLength(model.defaultReplyLength)} 上限
                    </span>
                    <TestState state={model.lastConnectionTest} running={runningTestModelId === model.id} />
                    {modelInsight && (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                          modelInsight.tone === "warning"
                            ? "border-amber-300/60 bg-amber-50/80 text-amber-700"
                            : "border-red-300/60 bg-red-50/80 text-red-600"
                        }`}
                      >
                        {modelInsight.shortLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="ly-inline-panel mt-3 ml-2 grid gap-3 px-3.5 py-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-wider">
                    模型 ID
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[12px] font-bold">
                    {model.modelName || "未填写"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-wider">
                    Base URL
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] font-bold leading-relaxed">
                    {model.baseUrl}
                  </p>
                </div>
              </div>

              {modelInsight ? <ModelInsightNotice insight={modelInsight} /> : null}

              <div className="mt-2 ml-2 flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)] opacity-60">
                  {model.lastConnectionTest
                    ? `测试于 ${formatDate(model.lastConnectionTest.testedAt)} — ${formatModelTestMessage(model.lastConnectionTest)}`
                    : `更新于 ${formatDate(model.updatedAt)}`}
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:justify-end">
                  {renderModelCardActions(model, runningTestModelId, {
                    onEditModel,
                    onTestModel,
                    onToggleModel,
                    onRemoveModel,
                  })}
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
