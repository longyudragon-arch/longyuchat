"use client";

import { useMemo, useState } from "react";

import { getProviderPreset } from "@/lib/client/chat-lab-client";
import {
  getModelAvatarPalette,
  getProviderDefaultAvatarColor,
  getProviderDefaultAvatarLabel,
  normalizeModelAvatarLabel,
} from "@/lib/model-avatar";
import type {
  DiscoveredModelView,
  ModelView,
  ProviderConnectionTemplateView,
  ProviderConnectionView,
  ProviderType,
} from "@/types/app";

const defaultProvider = "OPENAI_COMPATIBLE" as ProviderType;

export type ModelSourceMode = "direct" | "connection";

export interface ModelFormState {
  id: string;
  connectionId: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  modelName: string;
  avatarLabel: string;
  avatarColor: string;
  apiKey: string;
  defaultReplyLength: number;
  enabled: boolean;
}

export function getAvatarPreviewStyle(provider: ProviderType, avatarColor: string) {
  const palette = getModelAvatarPalette(provider, avatarColor);

  return {
    backgroundColor: palette.baseColor,
    color: palette.textColor,
    boxShadow: `0 12px 28px ${palette.shadowColor}`,
  };
}

export function getAvatarLabelPreview(avatarLabel: string | undefined, provider: ProviderType) {
  return normalizeModelAvatarLabel(avatarLabel) ?? getProviderDefaultAvatarLabel(provider);
}

export function getTemplateAvatarDefaults(template: ProviderConnectionTemplateView | null, provider: ProviderType) {
  return {
    avatarLabel: normalizeModelAvatarLabel(template?.avatarLabel) ?? getProviderDefaultAvatarLabel(provider),
    avatarColor: template?.avatarColor ?? getProviderDefaultAvatarColor(provider),
  };
}

export function createDefaultModelForm(): ModelFormState {
  const preset = getProviderPreset(defaultProvider);

  return {
    id: "",
    connectionId: "",
    name: "",
    provider: defaultProvider,
    baseUrl: preset.baseUrl,
    modelName: preset.defaultModelName,
    avatarLabel: getProviderDefaultAvatarLabel(defaultProvider),
    avatarColor: getProviderDefaultAvatarColor(defaultProvider),
    apiKey: "",
    defaultReplyLength: preset.defaultReplyLength,
    enabled: true,
  };
}

export function findTemplateByProviderAndBaseUrl(
  connectionTemplates: ProviderConnectionTemplateView[],
  provider: ProviderType,
  baseUrl: string,
) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "").toLowerCase();

  return (
    connectionTemplates.find((template) => {
      if (template.provider !== provider || !template.suggestedBaseUrl) {
        return false;
      }

      return template.suggestedBaseUrl.trim().replace(/\/+$/, "").toLowerCase() === normalizedBaseUrl;
    }) ?? null
  );
}

function findTemplateById(connectionTemplates: ProviderConnectionTemplateView[], templateId: string) {
  return connectionTemplates.find((template) => template.id === templateId) ?? null;
}

interface UseModelBuilderStateOptions {
  connections: ProviderConnectionView[];
  connectionTemplates: ProviderConnectionTemplateView[];
  connectionDiscoveredModels: Record<string, DiscoveredModelView[]>;
  clearInlineFeedback: () => void;
}

export function useModelBuilderState({
  connections,
  connectionTemplates,
  connectionDiscoveredModels,
  clearInlineFeedback,
}: UseModelBuilderStateOptions) {
  const [modelSourceMode, setModelSourceMode] = useState<ModelSourceMode>("direct");
  const [editingInitialConnectionId, setEditingInitialConnectionId] = useState<string | null>(null);
  const [selectedModelTemplateId, setSelectedModelTemplateId] = useState("");
  const [modelForm, setModelForm] = useState<ModelFormState>(createDefaultModelForm);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelView[]>([]);

  const usingSavedConnection = modelSourceMode === "connection";

  const selectedConnection = useMemo(
    () =>
      usingSavedConnection
        ? connections.find((connection) => connection.id === modelForm.connectionId) ?? null
        : null,
    [connections, modelForm.connectionId, usingSavedConnection],
  );

  const selectedModelTemplate = useMemo(() => {
    if (modelForm.connectionId) {
      return null;
    }

    if (selectedModelTemplateId) {
      return connectionTemplates.find((template) => template.id === selectedModelTemplateId) ?? null;
    }

    return findTemplateByProviderAndBaseUrl(connectionTemplates, modelForm.provider, modelForm.baseUrl);
  }, [connectionTemplates, modelForm.baseUrl, modelForm.connectionId, modelForm.provider, selectedModelTemplateId]);

  const selectedSavedConnectionAvatar = selectedConnection
    ? getTemplateAvatarDefaults(
        findTemplateByProviderAndBaseUrl(connectionTemplates, selectedConnection.provider, selectedConnection.baseUrl),
        selectedConnection.provider,
      )
    : null;

  const selectedDiscoveredModel = useMemo(
    () => discoveredModels.find((item) => item.id === modelForm.modelName) ?? null,
    [discoveredModels, modelForm.modelName],
  );

  function updateModelForm(nextValue: Partial<ModelFormState>) {
    clearInlineFeedback();
    if (
      nextValue.provider ||
      nextValue.baseUrl !== undefined ||
      nextValue.apiKey !== undefined ||
      nextValue.connectionId !== undefined
    ) {
      setDiscoveredModels([]);
    }
    setModelForm((current) => ({ ...current, ...nextValue }));
  }

  function replaceModelForm(
    nextForm: ModelFormState,
    options?: {
      sourceMode?: ModelSourceMode;
      editingConnectionId?: string | null;
      selectedTemplateId?: string;
      discoveredModels?: DiscoveredModelView[];
    },
  ) {
    clearInlineFeedback();
    setModelForm(nextForm);
    setModelSourceMode(options?.sourceMode ?? "direct");
    setEditingInitialConnectionId(options?.editingConnectionId ?? null);
    setSelectedModelTemplateId(options?.selectedTemplateId ?? "");
    setDiscoveredModels(options?.discoveredModels ?? []);
  }

  function switchModelSourceMode(nextMode: ModelSourceMode) {
    clearInlineFeedback();
    setModelSourceMode(nextMode);

    if (nextMode === "direct") {
      setDiscoveredModels([]);
      updateModelForm({
        connectionId: "",
      });
      return;
    }

    setDiscoveredModels(modelForm.connectionId ? connectionDiscoveredModels[modelForm.connectionId] ?? [] : []);
  }

  function resetForm() {
    replaceModelForm(createDefaultModelForm());
  }

  function updateProvider(nextProvider: ProviderType) {
    const currentPreset = getProviderPreset(modelForm.provider);
    const nextPreset = getProviderPreset(nextProvider);
    setModelSourceMode("direct");
    setSelectedModelTemplateId("");
    updateModelForm({
      connectionId: "",
      provider: nextProvider,
      baseUrl: nextPreset.baseUrl,
      avatarLabel: getProviderDefaultAvatarLabel(nextProvider),
      avatarColor: getProviderDefaultAvatarColor(nextProvider),
      modelName:
        !modelForm.modelName || modelForm.modelName === currentPreset.defaultModelName
          ? nextPreset.defaultModelName
          : modelForm.modelName,
      defaultReplyLength:
        modelForm.defaultReplyLength === currentPreset.defaultReplyLength
          ? nextPreset.defaultReplyLength
          : modelForm.defaultReplyLength,
    });
  }

  function applyModelTemplate(templateId: string) {
    const template = findTemplateById(connectionTemplates, templateId);

    if (!template) {
      return null;
    }

    const preset = getProviderPreset(template.provider);
    const avatarDefaults = getTemplateAvatarDefaults(template, template.provider);
    setModelSourceMode("direct");
    setSelectedModelTemplateId(template.id);
    updateModelForm({
      connectionId: "",
      provider: template.provider,
      baseUrl: template.suggestedBaseUrl ?? preset.baseUrl,
      modelName: template.defaultModelName ?? preset.defaultModelName,
      avatarLabel: avatarDefaults.avatarLabel,
      avatarColor: avatarDefaults.avatarColor,
      apiKey: "",
    });
    setDiscoveredModels([]);

    return template;
  }

  function attachConnectionToModel(connection: ProviderConnectionView, modelId?: string) {
    setModelSourceMode("connection");
    const matchedTemplate = findTemplateByProviderAndBaseUrl(
      connectionTemplates,
      connection.provider,
      connection.baseUrl,
    );
    const avatarDefaults = getTemplateAvatarDefaults(matchedTemplate, connection.provider);
    setSelectedModelTemplateId(matchedTemplate?.id ?? "");
    updateModelForm({
      connectionId: connection.id,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      avatarLabel: avatarDefaults.avatarLabel,
      avatarColor: avatarDefaults.avatarColor,
      modelName: modelId ?? modelForm.modelName,
    });

    if (connectionDiscoveredModels[connection.id]) {
      setDiscoveredModels(connectionDiscoveredModels[connection.id] ?? []);
    }

    return matchedTemplate;
  }

  function selectSavedConnectionForModel(connectionId: string) {
    if (!connectionId) {
      setModelSourceMode("direct");
      updateModelForm({ connectionId: "" });
      setDiscoveredModels([]);
      return null;
    }

    const connection = connections.find((item) => item.id === connectionId);
    if (!connection) {
      return null;
    }

    setModelSourceMode("connection");
    const matchedTemplate = findTemplateByProviderAndBaseUrl(
      connectionTemplates,
      connection.provider,
      connection.baseUrl,
    );
    const avatarDefaults = getTemplateAvatarDefaults(matchedTemplate, connection.provider);
    updateModelForm({
      connectionId: connection.id,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      avatarLabel: avatarDefaults.avatarLabel,
      avatarColor: avatarDefaults.avatarColor,
    });
    if (connectionDiscoveredModels[connection.id]) {
      setDiscoveredModels(connectionDiscoveredModels[connection.id] ?? []);
    }

    return connection;
  }

  function startEditingModel(model: ModelView) {
    const selectedTemplate = findTemplateByProviderAndBaseUrl(connectionTemplates, model.provider, model.baseUrl);
    replaceModelForm(
      {
        id: model.id,
        connectionId: model.connectionId ?? "",
        name: model.name,
        provider: model.provider,
        baseUrl: model.baseUrl,
        modelName: model.modelName,
        avatarLabel: model.avatarLabel,
        avatarColor: model.avatarColor,
        apiKey: "",
        defaultReplyLength: model.defaultReplyLength,
        enabled: model.enabled,
      },
      {
        sourceMode: model.connectionId ? "connection" : "direct",
        editingConnectionId: model.connectionId ?? null,
        selectedTemplateId: selectedTemplate?.id ?? "",
        discoveredModels: model.connectionId ? connectionDiscoveredModels[model.connectionId] ?? [] : [],
      },
    );
  }

  return {
    modelSourceMode,
    editingInitialConnectionId,
    modelForm,
    discoveredModels,
    selectedConnection,
    selectedModelTemplate,
    selectedSavedConnectionAvatar,
    selectedDiscoveredModel,
    usingSavedConnection,
    updateModelForm,
    replaceModelForm,
    setDiscoveredModels,
    switchModelSourceMode,
    resetForm,
    updateProvider,
    applyModelTemplate,
    attachConnectionToModel,
    selectSavedConnectionForModel,
    startEditingModel,
  };
}
