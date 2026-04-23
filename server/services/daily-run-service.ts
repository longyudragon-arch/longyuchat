import type { Prisma } from "@/generated/prisma/client";
import { DailyRunStatus, DailyRunStepStatus, DailyRunType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/http/api-error";
import type {
  CreateDailyRunStepInput,
  DailyRunStepView,
  DailyRunView,
  StartDailyRunInput,
} from "@/types/daily";

const dailyRunInclude = {
  steps: {
    orderBy: {
      startedAt: "asc" as const,
    },
  },
  _count: {
    select: {
      steps: true,
    },
  },
};

type DailyRunRecord = Prisma.DailyRunGetPayload<{
  include: typeof dailyRunInclude;
}>;

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function assertDailyRunType(runType: string) {
  if (!(runType in DailyRunType)) {
    throw new ApiError(400, `Unsupported daily run type: ${runType}`, {
      reasonCode: "invalid_request_payload",
      retryable: false,
      target: runType,
    });
  }
}

function assertDailyRunStepStatus(status: string) {
  if (!(status in DailyRunStepStatus)) {
    throw new ApiError(400, `Unsupported daily run step status: ${status}`, {
      reasonCode: "invalid_request_payload",
      retryable: false,
      target: status,
    });
  }
}

function presentDailyRunStep(step: DailyRunRecord["steps"][number]): DailyRunStepView {
  return {
    id: step.id,
    runId: step.runId,
    stepName: step.stepName,
    status: step.status,
    startedAt: toIsoString(step.startedAt),
    finishedAt: toIsoString(step.finishedAt),
    message: step.message,
    payloadJson: step.payloadJson,
  };
}

function presentDailyRun(run: DailyRunRecord): DailyRunView {
  return {
    id: run.id,
    runType: run.runType,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: toIsoString(run.finishedAt),
    summary: run.summary,
    errorMessage: run.errorMessage,
    statsJson: run.statsJson,
    createdAt: run.createdAt.toISOString(),
    stepCount: run._count.steps,
    steps: run.steps.map(presentDailyRunStep),
  };
}

export async function listRecentDailyRuns(limit = 20) {
  const runs = await prisma.dailyRun.findMany({
    include: dailyRunInclude,
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
  });

  return runs.map(presentDailyRun);
}

export async function getDailyRunById(id: string) {
  const run = await prisma.dailyRun.findUnique({
    where: { id },
    include: dailyRunInclude,
  });

  return run ? presentDailyRun(run) : null;
}

export async function startDailyRun(input: StartDailyRunInput) {
  assertDailyRunType(input.runType);

  const run = await prisma.dailyRun.create({
    data: {
      runType: DailyRunType[input.runType],
      status: DailyRunStatus.RUNNING,
      summary: input.summary ?? null,
      statsJson: input.statsJson ?? null,
    },
    include: dailyRunInclude,
  });

  return presentDailyRun(run);
}

export async function createDailyRunStep(input: CreateDailyRunStepInput) {
  if (input.status) {
    assertDailyRunStepStatus(input.status);
  }

  const run = await prisma.dailyRun.findUnique({
    where: { id: input.runId },
    select: { id: true },
  });

  if (!run) {
    throw new ApiError(404, `Daily run ${input.runId} was not found.`, {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  const step = await prisma.dailyRunStep.create({
    data: {
      runId: input.runId,
      stepName: input.stepName.trim(),
      status: input.status ? DailyRunStepStatus[input.status] : DailyRunStepStatus.PENDING,
      message: input.message ?? null,
      payloadJson: input.payloadJson ?? null,
    },
  });

  return {
    id: step.id,
    runId: step.runId,
    stepName: step.stepName,
    status: step.status,
    startedAt: toIsoString(step.startedAt),
    finishedAt: toIsoString(step.finishedAt),
    message: step.message,
    payloadJson: step.payloadJson,
  } satisfies DailyRunStepView;
}

export async function markDailyRunStepRunning(id: string, message?: string | null) {
  const step = await prisma.dailyRunStep.update({
    where: { id },
    data: {
      status: DailyRunStepStatus.RUNNING,
      startedAt: new Date(),
      message: message ?? undefined,
    },
  });

  return {
    id: step.id,
    runId: step.runId,
    stepName: step.stepName,
    status: step.status,
    startedAt: toIsoString(step.startedAt),
    finishedAt: toIsoString(step.finishedAt),
    message: step.message,
    payloadJson: step.payloadJson,
  } satisfies DailyRunStepView;
}

export async function markDailyRunStepSuccess(id: string, message?: string | null) {
  const step = await prisma.dailyRunStep.update({
    where: { id },
    data: {
      status: DailyRunStepStatus.SUCCESS,
      finishedAt: new Date(),
      message: message ?? undefined,
    },
  });

  return {
    id: step.id,
    runId: step.runId,
    stepName: step.stepName,
    status: step.status,
    startedAt: toIsoString(step.startedAt),
    finishedAt: toIsoString(step.finishedAt),
    message: step.message,
    payloadJson: step.payloadJson,
  } satisfies DailyRunStepView;
}

export async function markDailyRunStepFailed(id: string, message: string) {
  const step = await prisma.dailyRunStep.update({
    where: { id },
    data: {
      status: DailyRunStepStatus.FAILED,
      finishedAt: new Date(),
      message,
    },
  });

  return {
    id: step.id,
    runId: step.runId,
    stepName: step.stepName,
    status: step.status,
    startedAt: toIsoString(step.startedAt),
    finishedAt: toIsoString(step.finishedAt),
    message: step.message,
    payloadJson: step.payloadJson,
  } satisfies DailyRunStepView;
}

export async function finishDailyRunSuccess(id: string, input?: {
  summary?: string | null;
  statsJson?: string | null;
}) {
  const run = await prisma.dailyRun.update({
    where: { id },
    data: {
      status: DailyRunStatus.SUCCESS,
      finishedAt: new Date(),
      summary: input?.summary ?? undefined,
      statsJson: input?.statsJson ?? undefined,
      errorMessage: null,
    },
    include: dailyRunInclude,
  });

  return presentDailyRun(run);
}

export async function finishDailyRunFailure(id: string, errorMessage: string, input?: {
  summary?: string | null;
  statsJson?: string | null;
}) {
  const run = await prisma.dailyRun.update({
    where: { id },
    data: {
      status: DailyRunStatus.FAILED,
      finishedAt: new Date(),
      summary: input?.summary ?? undefined,
      statsJson: input?.statsJson ?? undefined,
      errorMessage,
    },
    include: dailyRunInclude,
  });

  return presentDailyRun(run);
}
