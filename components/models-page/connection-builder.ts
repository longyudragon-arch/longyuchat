"use client";

import { useMemo, useState } from "react";

import { getProviderPreset, supportsAutomaticModelDiscovery } from "@/lib/client/longyuchat-client";
import { getTemplateAvatarDefaults, findTemplateByProviderAndBaseUrl } from "@/components/models-page/model-builder";
import type {
  ProviderConnectionTemplateView,
  ProviderConnectionView,
  ProviderType,
} from "@/types/app";

const defaultProvider = "OPENAI_COMPATIBLE" as ProviderType;

export interface ConnectionFormState {
  id: string;
  templateId: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  probeModelName: string;
}

export function createDefaultConnectionForm(): ConnectionFormState {
  const preset = getProviderPreset(defaultProvider);

  return {
    id: "",
    templateId: "",
    name: "",
    provider: defaultProvider,
    baseUrl: preset.baseUrl,
    apiKey: "",
    enabled: true,
    probeModelName: preset.defaultModelName,
  };
}

function findTemplateById(connectionTemplates: ProviderConnectionTemplateView[], templateId: string) {
  return connectionTemplates.find((template) => template.id === templateId) ?? null;
}

interface UseConnectionBuilderStateOptions {
  connectionTemplates: ProviderConnectionTemplateView[];
  clearInlineFeedback: () => void;
}

export function useConnectionBuilderState({
  connectionTemplates,
  clearInlineFeedback,
}: UseConnectionBuilderStateOptions) {
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>(createDefaultConnectionForm);

  const selectedConnectionTemplate = useMemo(() => {
    if (connectionForm.templateId) {
      return findTemplateById(connectionTemplates, connectionForm.templateId);
    }

    return findTemplateByProviderAndBaseUrl(
      connectionTemplates,
      connectionForm.provider,
      connectionForm.baseUrl,
    );
  }, [connectionForm.baseUrl, connectionForm.provider, connectionForm.templateId, connectionTemplates]);

  const connectionProviderChoiceValue = selectedConnectionTemplate
    ? `template:${selectedConnectionTemplate.id}`
    : `provider:${connectionForm.provider}`;

  const connectionDiscoverySupported = selectedConnectionTemplate
    ? selectedConnectionTemplate.preferredDiscoveryStrategy !== "MANUAL_ONLY"
    : supportsAutomaticModelDiscovery(connectionForm.provider);

  const connectionFormAvatar = getTemplateAvatarDefaults(selectedConnectionTemplate, connectionForm.provider);

  function updateConnectionForm(nextValue: Partial<ConnectionFormState>) {
    clearInlineFeedback();
    setConnectionForm((current) => ({ ...current, ...nextValue }));
  }

  function replaceConnectionForm(nextForm: ConnectionFormState) {
    clearInlineFeedback();
    setConnectionForm(nextForm);
  }

  function resetConnectionForm() {
    replaceConnectionForm(createDefaultConnectionForm());
  }

  function updateConnectionProvider(nextProvider: ProviderType) {
    const currentPreset = getProviderPreset(connectionForm.provider);
    const nextPreset = getProviderPreset(nextProvider);

    updateConnectionForm({
      templateId: "",
      provider: nextProvider,
      baseUrl: nextPreset.baseUrl,
      probeModelName:
        !connectionForm.probeModelName || connectionForm.probeModelName === currentPreset.defaultModelName
          ? nextPreset.defaultModelName
          : connectionForm.probeModelName,
    });
  }

  function applyConnectionTemplate(templateId: string) {
    const template = findTemplateById(connectionTemplates, templateId);

    if (!template) {
      return null;
    }

    const preset = getProviderPreset(template.provider);
    updateConnectionForm({
      templateId: template.id,
      name: connectionForm.name.trim() ? connectionForm.name : template.name,
      provider: template.provider,
      baseUrl: template.suggestedBaseUrl ?? preset.baseUrl,
      probeModelName: template.defaultModelName ?? preset.defaultModelName,
    });

    return template;
  }

  function handleConnectionProviderChoice(nextValue: string) {
    if (nextValue.startsWith("template:")) {
      return {
        template: applyConnectionTemplate(nextValue.slice("template:".length)),
        provider: null,
      };
    }

    if (nextValue.startsWith("provider:")) {
      const provider = nextValue.slice("provider:".length) as ProviderType;
      updateConnectionProvider(provider);
      return {
        template: null,
        provider,
      };
    }

    return {
      template: null,
      provider: null,
    };
  }

  function startEditingConnection(connection: ProviderConnectionView) {
    const matchedTemplate = findTemplateByProviderAndBaseUrl(
      connectionTemplates,
      connection.provider,
      connection.baseUrl,
    );

    replaceConnectionForm({
      id: connection.id,
      templateId: matchedTemplate?.id ?? "",
      name: connection.name,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      apiKey: "",
      enabled: connection.enabled,
      probeModelName: getProviderPreset(connection.provider).defaultModelName,
    });

    return matchedTemplate;
  }

  function resolveConnectionProbeModelName(
    connection: ProviderConnectionView | null,
    probeModelName?: string,
  ) {
    const explicitProbeModel = probeModelName?.trim();

    if (explicitProbeModel) {
      return explicitProbeModel;
    }

    const matchedTemplate = connection
      ? findTemplateByProviderAndBaseUrl(connectionTemplates, connection.provider, connection.baseUrl)
      : selectedConnectionTemplate;

    const templateProbeModel = matchedTemplate?.defaultModelName?.trim();

    if (templateProbeModel) {
      return templateProbeModel;
    }

    const provider = connection?.provider ?? connectionForm.provider;
    return getProviderPreset(provider).defaultModelName.trim() || undefined;
  }

  return {
    connectionForm,
    selectedConnectionTemplate,
    connectionProviderChoiceValue,
    connectionDiscoverySupported,
    connectionFormAvatar,
    updateConnectionForm,
    replaceConnectionForm,
    resetConnectionForm,
    updateConnectionProvider,
    applyConnectionTemplate,
    handleConnectionProviderChoice,
    startEditingConnection,
    resolveConnectionProbeModelName,
  };
}
