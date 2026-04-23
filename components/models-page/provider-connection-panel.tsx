"use client";

import type { RefObject } from "react";

import { getProviderBadgeClassName, getProviderChineseLabel, getProviderOptionLabel, getProviderPreset } from "@/lib/client/longyuchat-client";
import {
  findTemplateByProviderAndBaseUrl,
  getAvatarPreviewStyle,
  getTemplateAvatarDefaults,
} from "@/components/models-page/model-builder";
import type { ConnectionFormFieldKey } from "@/components/models-page/error-field-resolver";
import { FieldErrorHint, FeedbackPanel, getInputErrorClass } from "@/components/models-page/shared-ui";
import type {
  ClientErrorFeedback,
} from "@/lib/client/longyuchat-client";
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

interface ConnectionFormState {
  id: string;
  templateId: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  probeModelName: string;
}

interface ProviderConnectionPanelProps {
  panelRef: RefObject<HTMLDivElement | null>;
  connectionForm: ConnectionFormState;
  selectedConnectionTemplate: ProviderConnectionTemplateView | null;
  connectionProviderChoiceValue: string;
  connectionDiscoverySupported: boolean;
  connectionFormAvatar: {
    avatarLabel: string;
    avatarColor: string;
  };
  connectionFieldErrors: Partial<Record<ConnectionFormFieldKey, string>>;
  connectionFormFeedback: ClientErrorFeedback | null;
  groupedConnectionTemplates: GroupedConnectionTemplates;
  directCreateProviderChoices: ProviderType[];
  connections: ProviderConnectionView[];
  connectionDiscoveredModels: Record<string, DiscoveredModelView[]>;
  modelConnectionId: string;
  runningTestConnectionId: string | null;
  isBusy: boolean;
  onBackToModelBuilder: () => void;
  onConnectionNameChange: (value: string) => void;
  onProviderChoiceChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onProbeModelNameChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
  onEditConnection: (connection: ProviderConnectionView) => void;
  onUseConnectionForModel: (connection: ProviderConnectionView) => void;
  onTestConnection: (connection: ProviderConnectionView) => void;
  onDiscoverConnectionModels: (connection: ProviderConnectionView) => void;
  onRemoveConnection: (connection: ProviderConnectionView) => void;
  onUseDiscoveredModel: (connection: ProviderConnectionView, modelId: string) => void;
}

export function ProviderConnectionPanel({
  panelRef,
  connectionForm,
  selectedConnectionTemplate,
  connectionProviderChoiceValue,
  connectionDiscoverySupported,
  connectionFormAvatar,
  connectionFieldErrors,
  connectionFormFeedback,
  groupedConnectionTemplates,
  directCreateProviderChoices,
  connections,
  connectionDiscoveredModels,
  modelConnectionId,
  runningTestConnectionId,
  isBusy,
  onBackToModelBuilder,
  onConnectionNameChange,
  onProviderChoiceChange,
  onBaseUrlChange,
  onApiKeyChange,
  onProbeModelNameChange,
  onEnabledChange,
  onSubmit,
  onCancelEdit,
  onEditConnection,
  onUseConnectionForModel,
  onTestConnection,
  onDiscoverConnectionModels,
  onRemoveConnection,
  onUseDiscoveredModel,
}: ProviderConnectionPanelProps) {
  return (
    <div ref={panelRef} className="ly-glass ly-panel-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold tracking-tight">
            {connectionForm.id ? "编辑连接" : "保存 Provider 连接"}
          </h2>
          <p className="mt-0.5 text-[12px] leading-6 text-[var(--muted)]">
            保存后可在建模型时快速复用，适合同一 Key 下多个模型。
          </p>
        </div>
        <button
          type="button"
          data-testid="back-to-model-builder"
          onClick={onBackToModelBuilder}
          className="shrink-0 ly-mini-action px-3 py-1.5 text-[11px] font-bold"
        >
          ← 返回建模型
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
            连接名称
          </label>
          <input
            data-testid="connection-name"
            value={connectionForm.name}
            onChange={(e) => onConnectionNameChange(e.target.value)}
            className="ly-control"
            placeholder="例如：豆包正式环境 / 个人 OpenAI"
          />
        </div>

        <div className="space-y-2">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
            厂商 / 平台
          </label>
          <select
            data-testid="connection-provider-choice"
            value={connectionProviderChoiceValue}
            onChange={(e) => onProviderChoiceChange(e.target.value)}
            aria-invalid={Boolean(connectionFieldErrors.providerTemplate)}
            className={`ly-control ly-glass-select appearance-none ${getInputErrorClass(connectionFieldErrors.providerTemplate)}`}
          >
            <optgroup label="国内常用">
              {groupedConnectionTemplates.domestic.map((template) => (
                <option key={template.id} value={`template:${template.id}`}>
                  {template.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="海外常用">
              {groupedConnectionTemplates.global.map((template) => (
                <option key={template.id} value={`template:${template.id}`}>
                  {template.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="自定义接入">
              {directCreateProviderChoices.map((provider) => (
                <option key={provider} value={`provider:${provider}`}>
                  {getProviderOptionLabel(provider)}
                </option>
              ))}
            </optgroup>
          </select>
          <FieldErrorHint message={connectionFieldErrors.providerTemplate} />
          <div className="ly-inline-panel mt-2 flex items-start gap-3 px-3.5 py-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
              style={getAvatarPreviewStyle(connectionForm.provider, connectionFormAvatar.avatarColor)}
            >
              {connectionFormAvatar.avatarLabel}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[13px] font-bold text-[#2f2e33]">
                  {selectedConnectionTemplate?.name ?? getProviderOptionLabel(connectionForm.provider)}
                </p>
                <span className="rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/8 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                  {connectionDiscoverySupported ? "可测试并获取列表" : "建议手动模型 ID"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">
                {selectedConnectionTemplate?.subtitle ?? "自定义接入模式，适合 OpenAI 兼容或高级协议调试。"}
              </p>
              {selectedConnectionTemplate?.note && (
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                  {selectedConnectionTemplate.note}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
            Base URL
          </label>
          <input
            data-testid="connection-base-url"
            value={connectionForm.baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            className={`ly-control font-mono text-[12px] ${getInputErrorClass(connectionFieldErrors.baseUrl)}`}
            placeholder="https://api.example.com/v1"
          />
          <FieldErrorHint message={connectionFieldErrors.baseUrl} />
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
            API Key
          </label>
          <input
            type="password"
            data-testid="connection-api-key"
            value={connectionForm.apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            className={`ly-control font-mono text-[12px] ${getInputErrorClass(connectionFieldErrors.apiKey)}`}
            placeholder={connectionForm.id ? "留空则保留原有 Key" : "sk-..."}
          />
          <FieldErrorHint message={connectionFieldErrors.apiKey} />
        </div>

        {!connectionDiscoverySupported && (
          <div className="space-y-1.5">
            <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              测试用模型 ID
            </label>
            <input
              data-testid="connection-probe-model-name"
              value={connectionForm.probeModelName}
              onChange={(e) => onProbeModelNameChange(e.target.value)}
              className={`ly-control font-mono text-[12px] ${getInputErrorClass(connectionFieldErrors.probeModelName)}`}
              placeholder={
                getProviderPreset(connectionForm.provider).defaultModelName || "填写一个可用模型 ID 用于测试连接"
              }
            />
            <FieldErrorHint message={connectionFieldErrors.probeModelName} />
          </div>
        )}

        <label className="ly-inline-panel flex cursor-pointer items-center gap-3 px-3.5 py-3">
          <input
            type="checkbox"
            checked={connectionForm.enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="h-4 w-4 rounded border-white/60 text-[var(--accent)] focus:ring-[var(--accent)]/30"
          />
          <div>
            <p className="text-[12px] font-bold text-[#2f2e33]">创建后立即启用</p>
            <p className="text-[11px] leading-5 text-[var(--muted)]">停用后不会继续被模型复用。</p>
          </div>
        </label>

        {connectionFormFeedback ? <FeedbackPanel feedback={connectionFormFeedback} /> : null}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            data-testid="connection-submit"
            onClick={onSubmit}
            disabled={isBusy}
            className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            {connectionForm.id ? "保存连接" : "创建连接"}
          </button>
          {connectionForm.id && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="ly-secondary-action px-5 py-3 text-[14px] font-bold active:scale-95"
            >
              取消
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            已保存的连接
          </p>
          <span className="rounded-full border border-white/40 bg-white/30 px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
            {connections.length}
          </span>
        </div>
        {connections.length === 0 ? (
          <div className="ly-empty-card px-4 py-4 text-[12px] text-[var(--muted)]">
            还没有保存过连接。上方填写后点“创建连接”即可。
          </div>
        ) : (
          connections.map((connection) => {
            const discoveredFromConnection = connectionDiscoveredModels[connection.id] ?? [];
            const selectedAvatar = getTemplateAvatarDefaults(
              findTemplateByProviderAndBaseUrl(
                [...groupedConnectionTemplates.domestic, ...groupedConnectionTemplates.global],
                connection.provider,
                connection.baseUrl,
              ),
              connection.provider,
            );

            return (
              <div
                key={connection.id}
                data-testid={`connection-card-${connection.id}`}
                className="ly-inline-panel space-y-3 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-bold text-[#2f2e33]">{connection.name}</p>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getProviderBadgeClassName(connection.provider)}`}
                      >
                        {getProviderChineseLabel(connection.provider)}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] leading-5 text-[var(--muted)]">
                      {connection.baseUrl}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold tracking-wide"
                        style={getAvatarPreviewStyle(connection.provider, selectedAvatar.avatarColor)}
                      >
                        {selectedAvatar.avatarLabel}
                      </span>
                      <span>{connection.modelCount} 个模型</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-[var(--muted)]">
                    <p>{connection.modelCount} 个模型</p>
                    {connection.lastAuthCheck && (
                      <span
                        className={`mt-1 block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          connection.lastAuthCheck.status === "success"
                            ? "border-emerald-200/50 bg-emerald-50/80 text-emerald-700"
                            : "border-red-200/50 bg-red-50/80 text-red-600"
                        }`}
                      >
                        {connection.lastAuthCheck.status === "success" ? "连接成功" : "连接失败"}
                      </span>
                    )}
                    {modelConnectionId === connection.id && (
                      <span className="mt-1 block rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--accent)]">
                        当前建模连接
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid={`connection-edit-${connection.id}`}
                    onClick={() => onEditConnection(connection)}
                    className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    data-testid={`connection-use-model-${connection.id}`}
                    onClick={() => onUseConnectionForModel(connection)}
                    className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95"
                  >
                    用它建模
                  </button>
                  <button
                    type="button"
                    data-testid={`connection-test-${connection.id}`}
                    onClick={() => onTestConnection(connection)}
                    className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95"
                  >
                    {runningTestConnectionId === connection.id ? "测试中" : "测试连接"}
                  </button>
                  {connection.supportsAutomaticModelDiscovery && (
                    <button
                      type="button"
                      data-testid={`connection-discover-${connection.id}`}
                      onClick={() => onDiscoverConnectionModels(connection)}
                      className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95"
                    >
                      获取模型
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid={`connection-delete-${connection.id}`}
                    onClick={() => onRemoveConnection(connection)}
                    className="ly-mini-action border-red-200/50 bg-red-50/50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white active:scale-95"
                  >
                    删除
                  </button>
                </div>

                {discoveredFromConnection.length > 0 && (
                  <div className="rounded-xl border border-white/35 bg-white/30 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                      已发现的模型
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {discoveredFromConnection.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`connection-discovered-model-${connection.id}-${item.id}`}
                          onClick={() => onUseDiscoveredModel(connection, item.id)}
                          className="rounded-lg border border-white/50 bg-white/70 px-2.5 py-1.5 text-left text-[11px] font-medium text-[#2f2e33] transition hover:border-[var(--accent)]/30 hover:bg-white"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
