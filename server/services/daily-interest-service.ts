import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/http/api-error";
import type {
  CreateDailyInterestProfileInput,
  DailyInterestProfileView,
  UpdateDailyInterestProfileInput,
} from "@/types/daily";

function requireNonEmpty(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new ApiError(400, `${label} is required.`, {
      reasonCode: "invalid_request_payload",
      retryable: false,
    });
  }

  return normalized;
}

function normalizePriority(value: number | undefined) {
  if (value === undefined) {
    return 100;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new ApiError(400, "Priority must be a non-negative integer.", {
      reasonCode: "invalid_request_payload",
      retryable: false,
    });
  }

  return value;
}

function presentDailyInterestProfile(profile: {
  id: string;
  name: string;
  includeKeywordsJson: string | null;
  excludeKeywordsJson: string | null;
  interestsText: string | null;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}): DailyInterestProfileView {
  return {
    id: profile.id,
    name: profile.name,
    includeKeywordsJson: profile.includeKeywordsJson,
    excludeKeywordsJson: profile.excludeKeywordsJson,
    interestsText: profile.interestsText,
    enabled: profile.enabled,
    priority: profile.priority,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function listDailyInterestProfiles() {
  const profiles = await prisma.dailyInterestProfile.findMany({
    orderBy: [{ enabled: "desc" }, { priority: "asc" }, { updatedAt: "desc" }],
  });

  return profiles.map(presentDailyInterestProfile);
}

export async function getActiveDailyInterestProfile() {
  const profile = await prisma.dailyInterestProfile.findFirst({
    where: {
      enabled: true,
    },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
  });

  return profile ? presentDailyInterestProfile(profile) : null;
}

export async function createDailyInterestProfile(input: CreateDailyInterestProfileInput) {
  const profile = await prisma.dailyInterestProfile.create({
    data: {
      name: requireNonEmpty(input.name, "Interest profile name"),
      includeKeywordsJson: input.includeKeywordsJson?.trim() || null,
      excludeKeywordsJson: input.excludeKeywordsJson?.trim() || null,
      interestsText: input.interestsText?.trim() || null,
      enabled: input.enabled ?? true,
      priority: normalizePriority(input.priority),
    },
  });

  return presentDailyInterestProfile(profile);
}

export async function updateDailyInterestProfile(id: string, input: UpdateDailyInterestProfileInput) {
  const existing = await prisma.dailyInterestProfile.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, `Daily interest profile ${id} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  const profile = await prisma.dailyInterestProfile.update({
    where: { id },
    data: {
      name: input.name !== undefined ? requireNonEmpty(input.name, "Interest profile name") : undefined,
      includeKeywordsJson: input.includeKeywordsJson !== undefined ? input.includeKeywordsJson?.trim() || null : undefined,
      excludeKeywordsJson: input.excludeKeywordsJson !== undefined ? input.excludeKeywordsJson?.trim() || null : undefined,
      interestsText: input.interestsText !== undefined ? input.interestsText?.trim() || null : undefined,
      enabled: input.enabled,
      priority: input.priority !== undefined ? normalizePriority(input.priority) : undefined,
    },
  });

  return presentDailyInterestProfile(profile);
}

export async function deleteDailyInterestProfile(id: string) {
  const existing = await prisma.dailyInterestProfile.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!existing) {
    throw new ApiError(404, `Daily interest profile ${id} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  await prisma.dailyInterestProfile.delete({
    where: { id },
  });

  return existing;
}
