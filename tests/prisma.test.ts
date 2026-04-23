import { afterEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("prisma bootstrap", () => {
  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    vi.resetModules();
  });

  it("does not throw during module import when DATABASE_URL is absent", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();

    await expect(import("@/lib/prisma")).resolves.toHaveProperty("prisma");
  });

  it("still throws when the client is actually accessed without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();

    const prismaModule = await import("@/lib/prisma");

    expect(() => prismaModule.prisma.$transaction).toThrow("DATABASE_URL is required to initialize Prisma.");
  });
});
