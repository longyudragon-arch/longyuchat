import type { ProviderType } from "@/types/app";

import { findMatchingProviderTemplate, getProviderPreset } from "@/lib/provider-catalog";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{6})$/;
const FALLBACK_AVATAR_COLOR = "#10b981";

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const safeHex = normalizeModelAvatarColor(hex) ?? FALLBACK_AVATAR_COLOR;
  const normalized = safeHex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixWithWhite(hex: string, ratio: number) {
  const { r, g, b } = hexToRgb(hex);
  const nextRatio = Math.max(0, Math.min(1, ratio));
  return `rgb(${clampChannel(r + (255 - r) * nextRatio)}, ${clampChannel(g + (255 - g) * nextRatio)}, ${clampChannel(b + (255 - b) * nextRatio)})`;
}

function getReadableTextColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance >= 160 ? "#1f2937" : "#ffffff";
}

export function normalizeModelAvatarColor(value?: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (!HEX_COLOR_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function normalizeModelAvatarLabel(value?: string | null) {
  const normalized = value?.trim().replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 3);
}

export function getProviderDefaultAvatarLabel(provider: ProviderType) {
  return getProviderPreset(provider).shortName;
}

export function getProviderDefaultAvatarColor(provider: ProviderType) {
  return getProviderPreset(provider).avatarColor ?? FALLBACK_AVATAR_COLOR;
}

export function resolveModelAvatar(provider: ProviderType, baseUrl: string, avatarLabel?: string | null, avatarColor?: string | null) {
  const providerDefaultLabel = getProviderDefaultAvatarLabel(provider);
  const providerDefaultColor = getProviderDefaultAvatarColor(provider);
  const matchedTemplate = findMatchingProviderTemplate(provider, baseUrl);
  const normalizedLabel = normalizeModelAvatarLabel(avatarLabel) ?? providerDefaultLabel;
  const normalizedColor = normalizeModelAvatarColor(avatarColor) ?? providerDefaultColor;

  if (!matchedTemplate) {
    return {
      avatarLabel: normalizedLabel,
      avatarColor: normalizedColor,
    };
  }

  const templateLabel = normalizeModelAvatarLabel(matchedTemplate.avatarLabel) ?? providerDefaultLabel;
  const templateColor = matchedTemplate.avatarColor ?? providerDefaultColor;

  return {
    avatarLabel: normalizedLabel === providerDefaultLabel ? templateLabel : normalizedLabel,
    avatarColor:
      normalizedColor.toLowerCase() === providerDefaultColor.toLowerCase() ? templateColor : normalizedColor,
  };
}

export function getModelAvatarPalette(provider: ProviderType, avatarColor?: string | null) {
  const baseColor = normalizeModelAvatarColor(avatarColor) ?? getProviderDefaultAvatarColor(provider) ?? FALLBACK_AVATAR_COLOR;

  return {
    baseColor,
    textColor: getReadableTextColor(baseColor),
    borderColor: withAlpha(baseColor, 0.28),
    shadowColor: withAlpha(baseColor, 0.28),
    softColor: mixWithWhite(baseColor, 0.84),
    softStrongColor: mixWithWhite(baseColor, 0.72),
  };
}
