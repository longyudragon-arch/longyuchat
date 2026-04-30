"use client";

import type { CSSProperties, RefObject } from "react";

import {
  getProviderChineseLabel,
  getProviderOptionLabel,
} from "@/lib/client/longyuchat-client";
import {
  getProviderDefaultAvatarColor,
  getProviderDefaultAvatarLabel,
} from "@/lib/model-avatar";
import type {
  ClientErrorFeedback,
} from "@/lib/client/longyuchat-client";
import {
  getAvatarPreviewStyle,
  getTemplateAvatarDefaults,
  type ModelFormState,
  type ModelSourceMode,
} from "@/components/models-page/model-builder";
import type { ModelFormFieldKey } from "@/components/models-page/error-field-resolver";
import {
  FeedbackPanel,
  FieldErrorHint,
  MenuCheck,
  getGlassMenuOptionClassName,
  getInputErrorClass,
} from "@/components/models-page/shared-ui";
import type {
  DiscoveredModelView,
  ProviderConnectionTemplateView,
  ProviderConnectionView,
  ProviderType,
} from "@/types/app";

interface GroupedConnectionTemplates {
  domestic: ProviderConnectionTemplateView[];
  global: ProviderConnectionTemplateView[];
}

interface ModelBuilderPanelProps {
  panelRef: RefObject<HTMLDivElement | null>;
  modelProviderMenuRef: RefObject<HTMLDivElement | null>;
  discoveredModelMenuRef: RefObject<HTMLDivElement | null>;
  modelForm: ModelFormState;
  modelSourceMode: ModelSourceMode;
  selectedModelTemplate: ProviderConnectionTemplateView | null;
  selectedConnection: ProviderConnectionView | null;
  selectedSavedConnectionAvatar: {
    avatarLabel: string;
    avatarColor: string;
  } | null;
  selectedDiscoveredModel: DiscoveredModelView | null;
  discoveredModels: DiscoveredModelView[];
  connections: ProviderConnectionView[];
  groupedConnectionTemplates: GroupedConnectionTemplates;
  directCreateProviderChoices: ProviderType[];
  currentAvatarStyle: CSSProperties;
  currentAvatarLabel: string;
  selectedModelChoiceLabel: string;
  selectedModelChoiceSubtitle: string;
  selectedPresetDefaultModelName: string;
  discoverySupported: boolean;
  modelFieldErrors: Partial<Record<ModelFormFieldKey, string>>;
  modelSubmitFeedback: ClientErrorFeedback | null;
  modelDiscoveryFeedback: ClientErrorFeedback | null;
  activeAction: string | null;
  showModelProviderMenu: boolean;
  showDiscoveredModelMenu: boolean;
  onOpenConnectionManager: () => void;
  onSwitchModelSourceMode: (mode: ModelSourceMode) => void;
  onToggleModelProviderMenu: () => void;
  onChooseModelProviderOption: (value: string) => void;
  onUpdateModelForm: (nextValue: Partial<ModelFormState>) => void;
  onSelectSavedConnection: (connectionId: string) => void;
  onDiscoverModels: () => void;
  onToggleDiscoveredModelMenu: () => void;
  onChooseDiscoveredModel: (modelId: string) => void;
  onClearDiscoveredModel: () => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
}

export function ModelBuilderPanel(props: ModelBuilderPanelProps) {
  const {
    panelRef,
    modelProviderMenuRef,
    discoveredModelMenuRef,
    modelForm,
    modelSourceMode,
    selectedModelTemplate,
    selectedConnection,
    selectedSavedConnectionAvatar,
    selectedDiscoveredModel,
    discoveredModels,
    connections,
    groupedConnectionTemplates,
    directCreateProviderChoices,
    currentAvatarStyle,
    currentAvatarLabel,
    selectedModelChoiceLabel,
    selectedModelChoiceSubtitle,
    selectedPresetDefaultModelName,
    discoverySupported,
    modelFieldErrors,
    modelSubmitFeedback,
    modelDiscoveryFeedback,
    activeAction,
    showModelProviderMenu,
    showDiscoveredModelMenu,
    onOpenConnectionManager,
    onSwitchModelSourceMode,
    onToggleModelProviderMenu,
    onChooseModelProviderOption,
    onUpdateModelForm,
    onSelectSavedConnection,
    onDiscoverModels,
    onToggleDiscoveredModelMenu,
    onChooseDiscoveredModel,
    onClearDiscoveredModel,
    onSubmit,
    onCancelEdit,
  } = props;

  return (
    <div ref={panelRef} className="ly-glass ly-panel-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold tracking-tight">
            {modelForm.id ? "编辑模型" : "新增模型"}
          </h2>
          <p className="mt-0.5 text-[12px] leading-6 text-[var(--muted)]">
            选平台模板 → 填 API Key → 获取/填模型 ID → 创建
          </p>
        </div>
        {!modelForm.id && (
          <button
            type="button"
            data-testid="open-connection-manager"
            onClick={onOpenConnectionManager}
            className="shrink-0 ly-mini-action px-3 py-1.5 text-[11px] font-bold"
          >
            管理连接
          </button>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
            显示名称
          </label>
          <input
            value={modelForm.name}
            onChange={(e) => onUpdateModelForm({ name: e.target.value })}
            className="ly-control"
            placeholder="可留空，将自动使用模型 ID 作为名称"
          />
        </div>

        {connections.length > 0 && (
          <div className="space-y-2">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              来源模式
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="model-source-direct"
                onClick={() => onSwitchModelSourceMode("direct")}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-[12px] font-bold transition ${
                  modelSourceMode === "direct"
                    ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] shadow-[0_10px_24px_rgba(220,117,165,0.12)]"
                    : "border-white/40 bg-white/25 text-[var(--muted)] hover:bg-white/40"
                }`}
              >
                直接配置
              </button>
              <button
                type="button"
                data-testid="model-source-connection"
                onClick={() => onSwitchModelSourceMode("connection")}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-[12px] font-bold transition ${
                  modelSourceMode === "connection"
                    ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] shadow-[0_10px_24px_rgba(220,117,165,0.12)]"
                    : "border-white/40 bg-white/25 text-[var(--muted)] hover:bg-white/40"
                }`}
              >
                使用已保存连接
              </button>
            </div>
            <p className="ml-1 text-[11px] leading-5 text-[var(--muted)]">
              {modelSourceMode === "connection"
                ? "连接模式会继承 Provider、Base URL 和 API Key；你只需要选连接并填写模型 ID。"
                : "直接配置模式会把当前模型保存为独立接入，不依赖已保存连接。"}
            </p>
          </div>
        )}

        {modelSourceMode === "direct" && (
          <div ref={modelProviderMenuRef} className="relative space-y-2">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              厂商 / 平台
            </label>
            <button
              type="button"
              onClick={onToggleModelProviderMenu}
              className={`ly-control flex items-center justify-between gap-3 px-4 text-left transition-all duration-200 ${
                modelFieldErrors.providerTemplate
                  ? `${getInputErrorClass(modelFieldErrors.providerTemplate)} shadow-[0_0_0_3px_rgba(248,113,113,0.16)]`
                  : showModelProviderMenu
                  ? "border-[color:color-mix(in_srgb,var(--accent)_28%,white_72%)] bg-white/75 shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent_90%),0_16px_34px_rgba(220,117,165,0.12)]"
                  : "hover:bg-white/55 hover:shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
              }`}
              aria-haspopup="listbox"
              aria-expanded={showModelProviderMenu}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[9px] font-bold tracking-wide"
                  style={currentAvatarStyle}
                >
                  {currentAvatarLabel}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[var(--foreground)]">
                    {selectedModelChoiceLabel}
                  </p>
                  <p className="truncate text-[11px] leading-5 text-[var(--muted)]">
                    {selectedModelChoiceSubtitle}
                  </p>
                </div>
              </div>
              <span
                className="shrink-0 text-[var(--muted)]/75 transition-transform duration-200"
                style={{ transform: showModelProviderMenu ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            {showModelProviderMenu && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[1.3rem] border border-white/60 bg-[rgba(255,255,255,0.78)] shadow-[0_24px_60px_rgba(31,41,55,0.14)] backdrop-blur-[26px]">
                <div className="max-h-[26rem] overflow-y-auto p-2">
                  <div className="space-y-1">
                    <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/65">
                      国内常用
                    </p>
                    {groupedConnectionTemplates.domestic.map((template) => {
                      const isActive = selectedModelTemplate?.id === template.id;
                      const templateAvatar = getTemplateAvatarDefaults(template, template.provider);
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => onChooseModelProviderOption(`template:${template.id}`)}
                          className={getGlassMenuOptionClassName(isActive)}
                        >
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
                            style={getAvatarPreviewStyle(template.provider, templateAvatar.avatarColor)}
                          >
                            {templateAvatar.avatarLabel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold text-[var(--foreground)]">
                              {template.name}
                            </p>
                            <p className="truncate text-[10px] leading-5 text-[var(--muted)]">
                              {template.subtitle}
                            </p>
                          </div>
                          <MenuCheck visible={isActive} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/65">
                      海外常用
                    </p>
                    {groupedConnectionTemplates.global.map((template) => {
                      const isActive = selectedModelTemplate?.id === template.id;
                      const templateAvatar = getTemplateAvatarDefaults(template, template.provider);
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => onChooseModelProviderOption(`template:${template.id}`)}
                          className={getGlassMenuOptionClassName(isActive)}
                        >
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
                            style={getAvatarPreviewStyle(template.provider, templateAvatar.avatarColor)}
                          >
                            {templateAvatar.avatarLabel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold text-[var(--foreground)]">
                              {template.name}
                            </p>
                            <p className="truncate text-[10px] leading-5 text-[var(--muted)]">
                              {template.subtitle}
                            </p>
                          </div>
                          <MenuCheck visible={isActive} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/65">
                      自定义接入
                    </p>
                    {directCreateProviderChoices.map((provider) => {
                      const isActive = !selectedModelTemplate && modelForm.provider === provider;
                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => onChooseModelProviderOption(`provider:${provider}`)}
                          className={getGlassMenuOptionClassName(isActive)}
                        >
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
                            style={getAvatarPreviewStyle(provider, getProviderDefaultAvatarColor(provider))}
                          >
                            {getProviderDefaultAvatarLabel(provider)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold text-[var(--foreground)]">
                              {getProviderOptionLabel(provider)}
                            </p>
                            <p className="truncate text-[10px] leading-5 text-[var(--muted)]">
                              {getProviderChineseLabel(provider)}
                            </p>
                          </div>
                          <MenuCheck visible={isActive} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <FieldErrorHint message={modelFieldErrors.providerTemplate} />
            <p className="ml-1 text-[11px] leading-5 text-[var(--muted)]">
              先选厂商，系统会自动带出默认 Base URL；如果平台不支持自动获取，再手动填写模型 ID。
            </p>
          </div>
        )}

        {modelSourceMode === "direct" && (
          <div className="ly-inline-panel flex items-start gap-3 px-3.5 py-3">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[9px] font-bold tracking-wide"
              style={currentAvatarStyle}
            >
              {currentAvatarLabel}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-bold text-[var(--foreground)]">
                  {selectedModelTemplate?.name ?? getProviderOptionLabel(modelForm.provider)}
                </p>
                <span className="rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/8 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                  {discoverySupported ? "可尝试获取列表" : "建议手动模型 ID"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">
                {selectedModelTemplate?.subtitle ?? "自定义接入模式，适合 OpenAI 兼容或高级协议调试。"}
              </p>
              {selectedModelTemplate?.note && (
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                  {selectedModelTemplate.note}
                </p>
              )}
              {selectedModelTemplate && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <a
                    href={selectedModelTemplate.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ly-mini-action px-2.5 py-1 text-[10px] font-bold"
                  >
                    官网
                  </a>
                  {selectedModelTemplate.apiKeyUrl && (
                    <a
                      href={selectedModelTemplate.apiKeyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ly-mini-action px-2.5 py-1 text-[10px] font-bold"
                    >
                      获取 Key
                    </a>
                  )}
                  {selectedModelTemplate.modelsUrl && (
                    <a
                      href={selectedModelTemplate.modelsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ly-mini-action px-2.5 py-1 text-[10px] font-bold"
                    >
                      模型列表
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-[1.4rem] border border-white/55 bg-white/45 px-4 py-3.5 shadow-[0_14px_30px_rgba(31,41,55,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wide"
                style={currentAvatarStyle}
              >
                {currentAvatarLabel}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-[var(--foreground)]">模型头像预览</p>
                <p className="truncate text-[11px] leading-5 text-[var(--muted)]">
                  {modelForm.name.trim() ||
                    modelForm.modelName.trim() ||
                    selectedModelTemplate?.name ||
                    getProviderOptionLabel(modelForm.provider)}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[var(--muted)]">
              {currentAvatarLabel} · {modelForm.avatarColor}
            </span>
          </div>
          <div className="mt-3 grid gap-3 border-t border-white/60 pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  头像字母
                </p>
                <input
                  value={modelForm.avatarLabel}
                  onChange={(e) =>
                    onUpdateModelForm({
                      avatarLabel: e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 3),
                    })
                  }
                  className="ly-control ly-control-sm font-mono uppercase tracking-[0.18em]"
                  maxLength={3}
                  placeholder={getProviderDefaultAvatarLabel(modelForm.provider)}
                  aria-label="填写模型头像字母"
                />
                <p className="text-[11px] text-[var(--muted)]">
                  默认按厂商生成，可改成 1 到 3 个字母。
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  头像颜色
                </p>
                <div className="flex items-center gap-2.5">
                  <label className="relative block h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/60 bg-white/75 shadow-sm shadow-black/5 transition hover:border-white/80 hover:bg-white/85">
                    <span
                      className="absolute inset-[5px] rounded-[0.7rem] border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                      style={{ backgroundColor: modelForm.avatarColor }}
                      aria-hidden="true"
                    />
                    <input
                      type="color"
                      value={modelForm.avatarColor}
                      onChange={(e) => onUpdateModelForm({ avatarColor: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="选择模型头像颜色"
                    />
                  </label>
                  <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[var(--muted)]">
                    {modelForm.avatarColor}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  拖动颜色选择器即可实时预览模型头像效果。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  onUpdateModelForm({
                    avatarLabel: selectedModelTemplate
                      ? getTemplateAvatarDefaults(selectedModelTemplate, modelForm.provider).avatarLabel
                      : getProviderDefaultAvatarLabel(modelForm.provider),
                  })
                }
                className="ly-mini-action px-3 py-2 text-[11px] font-bold"
              >
                恢复默认字母
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateModelForm({
                    avatarColor: selectedModelTemplate
                      ? getTemplateAvatarDefaults(selectedModelTemplate, modelForm.provider).avatarColor
                      : getProviderDefaultAvatarColor(modelForm.provider),
                  })
                }
                className="ly-mini-action px-3 py-2 text-[11px] font-bold"
              >
                恢复默认配色
              </button>
            </div>
          </div>
        </div>

        {connections.length > 0 && modelSourceMode === "connection" && (
          <div className="space-y-2">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              已保存连接
            </label>
            <div className="space-y-1.5">
              <select
                data-testid="model-saved-connection-select"
                aria-label="已保存连接"
                value={modelForm.connectionId}
                onChange={(e) => onSelectSavedConnection(e.target.value)}
                aria-invalid={Boolean(modelFieldErrors.connectionId)}
                className={`ly-control ly-glass-select appearance-none ${getInputErrorClass(modelFieldErrors.connectionId)}`}
              >
                <option value="">请选择一个已保存连接</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} · {getProviderChineseLabel(connection.provider)}
                  </option>
                ))}
              </select>
              <FieldErrorHint message={modelFieldErrors.connectionId} />
              {selectedConnection ? (
                <div className="ly-inline-panel flex items-start gap-3 px-3.5 py-3">
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-wide shadow-sm"
                    style={getAvatarPreviewStyle(
                      selectedConnection.provider,
                      selectedSavedConnectionAvatar?.avatarColor ??
                        getProviderDefaultAvatarColor(selectedConnection.provider),
                    )}
                  >
                    {selectedSavedConnectionAvatar?.avatarLabel ??
                      getProviderDefaultAvatarLabel(selectedConnection.provider)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[var(--foreground)]">{selectedConnection.name}</p>
                    <p className="mt-0.5 break-all font-mono text-[11px] leading-5 text-[var(--muted)]">
                      {selectedConnection.baseUrl}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      当前模型会继承这条连接的 Provider、Base URL 和 API Key；你可以随时切换或改回直连模式。
                    </p>
                  </div>
                </div>
              ) : (
                <p className="ml-1 text-[11px] leading-5 text-[var(--muted)]">
                  先选择一条连接，再保存为连接模式；如果想解除绑定，可切回“直接配置”。
                </p>
              )}
            </div>
          </div>
        )}

        {modelSourceMode === "direct" && (
          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              Base URL
            </label>
          <input
            data-testid="model-base-url"
            value={modelForm.baseUrl}
            onChange={(e) => onUpdateModelForm({ baseUrl: e.target.value })}
            aria-invalid={Boolean(modelFieldErrors.baseUrl)}
            className={`ly-control font-mono text-[12px] ${getInputErrorClass(modelFieldErrors.baseUrl)}`}
          />
            <FieldErrorHint message={modelFieldErrors.baseUrl} />
          </div>
        )}

        {modelSourceMode === "direct" && (
          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              API Key
            </label>
          <input
            data-testid="model-api-key"
            value={modelForm.apiKey}
            onChange={(e) => onUpdateModelForm({ apiKey: e.target.value })}
            type="password"
            aria-invalid={Boolean(modelFieldErrors.apiKey)}
              className={`ly-control font-mono text-[12px] tracking-widest placeholder:tracking-normal ${getInputErrorClass(modelFieldErrors.apiKey)}`}
              placeholder={modelForm.id ? "••••••••••••••••" : "输入 API Key"}
            />
            <FieldErrorHint message={modelFieldErrors.apiKey} />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              模型 ID
              {discoverySupported && (
                <span className="ml-2 text-[10px] normal-case text-[var(--accent)]">
                  支持自动获取
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={onDiscoverModels}
              disabled={
                !discoverySupported ||
                (!modelForm.connectionId &&
                  (!modelForm.baseUrl.trim() || (!modelForm.apiKey.trim() && !modelForm.id))) ||
                Boolean(activeAction)
              }
              className="shrink-0 ly-secondary-action rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold shadow-sm border-black/5 disabled:opacity-40"
            >
              {activeAction === "discovering" ? "获取中..." : "获取列表"}
            </button>
          </div>

          {discoveredModels.length > 0 ? (
            <div ref={discoveredModelMenuRef} className="relative">
              <button
                type="button"
                onClick={onToggleDiscoveredModelMenu}
                className={`ly-select-shell flex min-h-[2.625rem] items-center justify-between gap-3 px-3.5 text-left transition-all duration-200 ${
                  showDiscoveredModelMenu
                    ? "border-[color:color-mix(in_srgb,var(--accent)_28%,white_72%)] bg-white/75 shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent_90%),0_16px_34px_rgba(220,117,165,0.12)]"
                    : "hover:bg-white/55 hover:shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
                }`}
                aria-haspopup="listbox"
                aria-expanded={showDiscoveredModelMenu}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                    {selectedDiscoveredModel?.label ?? "请从列表中选择一个模型"}
                  </p>
                  <p className="truncate font-mono text-[10px] leading-5 text-[var(--muted)]">
                    {selectedDiscoveredModel?.id ?? `已获取 ${discoveredModels.length} 个可用模型`}
                  </p>
                </div>
                <span
                  className="shrink-0 text-[var(--muted)]/75 transition-transform duration-200"
                  style={{ transform: showDiscoveredModelMenu ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
              {showDiscoveredModelMenu && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[1.2rem] border border-white/60 bg-[rgba(255,255,255,0.78)] shadow-[0_24px_60px_rgba(31,41,55,0.14)] backdrop-blur-[26px]">
                  <div className="max-h-72 overflow-y-auto p-2">
                    <button
                      type="button"
                      onClick={onClearDiscoveredModel}
                      className={getGlassMenuOptionClassName(!selectedDiscoveredModel)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-[var(--foreground)]">
                          请从列表中选择一个模型
                        </p>
                        <p className="truncate text-[10px] leading-5 text-[var(--muted)]">
                          也可以继续手动填写模型 ID
                        </p>
                      </div>
                      <MenuCheck visible={!selectedDiscoveredModel} />
                    </button>
                    {discoveredModels.map((item) => {
                      const isActive = item.id === modelForm.modelName;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onChooseDiscoveredModel(item.id)}
                          className={getGlassMenuOptionClassName(isActive)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold text-[var(--foreground)]">
                              {item.label}
                            </p>
                            <p className="truncate font-mono text-[10px] leading-5 text-[var(--muted)]">
                              {item.id}
                            </p>
                          </div>
                          <MenuCheck visible={isActive} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            !discoverySupported && (
              <p className="ml-1 text-[11px] leading-5 text-[var(--muted)]">
                当前平台不支持自动获取，请手动填写模型 ID。
              </p>
            )
          )}

          <input
            data-testid="model-id"
            value={modelForm.modelName}
            onChange={(e) => onUpdateModelForm({ modelName: e.target.value })}
            aria-invalid={Boolean(modelFieldErrors.modelName)}
            className={`ly-control font-mono text-[12px] ${getInputErrorClass(modelFieldErrors.modelName)}`}
            placeholder={
              selectedConnection
                ? "填写或从列表选择模型 ID"
                : selectedPresetDefaultModelName || "填写模型 ID（如 gpt-4o）"
            }
          />
          <FieldErrorHint message={modelFieldErrors.modelName} />
          {modelDiscoveryFeedback ? <FeedbackPanel feedback={modelDiscoveryFeedback} /> : null}
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
            回复字数上限
          </label>
          <input
            type="number"
            min={50}
            max={4000}
            step={10}
            value={modelForm.defaultReplyLength}
            onChange={(e) =>
              onUpdateModelForm({
                defaultReplyLength: Number.parseInt(e.target.value, 10) || modelForm.defaultReplyLength,
              })
            }
            className="ly-control"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/30 bg-white/20 px-4 py-3 transition hover:bg-white/20 backdrop-blur-lg">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              className="peer sr-opacity absolute h-5 w-5 opacity-0"
              checked={modelForm.enabled}
              onChange={(e) => onUpdateModelForm({ enabled: e.target.checked })}
            />
            <div className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-[var(--muted)]/30 bg-white/30 transition-all peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)]">
              <svg
                className={`h-3 w-3 text-white transition-transform duration-300 ${
                  modelForm.enabled ? "scale-100" : "scale-0"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <span className="text-[13px] font-bold">创建后立即启用</span>
        </label>

        {modelSubmitFeedback ? <FeedbackPanel feedback={modelSubmitFeedback} /> : null}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            data-testid="model-submit"
            onClick={onSubmit}
            disabled={Boolean(activeAction)}
            className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            {modelForm.id
              ? activeAction === "updating"
                ? "保存中..."
                : "保存修改"
              : activeAction === "creating"
                ? "创建中..."
                : "创建模型"}
          </button>
          {modelForm.id ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="ly-secondary-action px-5 py-3 text-[14px] font-bold active:scale-95"
            >
              取消
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
