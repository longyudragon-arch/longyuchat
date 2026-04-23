import { describe, expect, it } from "vitest";

import { assertProductionReadiness, buildProductionReadinessReport } from "@/server/config/production-readiness";

function buildEnv(overrides?: Record<string, string | undefined>) {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "file:/srv/longyuchat/data/app.db",
    ENABLE_DEV_MOCKS: "false",
    NEXT_PUBLIC_ENABLE_DEV_MOCKS: "false",
    APP_LOGIN_ENABLED: "true",
    APP_LOGIN_USERNAME: "longyu",
    APP_LOGIN_PASSWORD: "secret",
    APP_LOGIN_SESSION_SECRET: "session-secret",
    BASIC_AUTH_ENABLED: "false",
    BASIC_AUTH_USERNAME: "",
    BASIC_AUTH_PASSWORD: "",
    HEALTHCHECK_BEARER_TOKEN: "health-token",
    MODEL_SECRET_ENCRYPTION_KEY: Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64"),
    ENABLE_API_RATE_LIMITS: "true",
    ENABLE_FILE_LOGGING: "true",
    APP_LOG_DIR: "/srv/longyuchat/logs",
    SQLITE_BACKUP_DIR: "/srv/longyuchat/backups/sqlite",
    SQLITE_BACKUP_RETENTION_DAYS: "7",
    ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION: "false",
    ...overrides,
  };
}

describe("buildProductionReadinessReport", () => {
  it("marks a fully configured production environment as ready", () => {
    const report = buildProductionReadinessReport(buildEnv());

    expect(report.ready).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.checks.fileLoggingEnabled).toBe(true);
    expect(report.checks.sqliteBackupConfigured).toBe(true);
    expect(report.checks.accessProtectionMode).toBe("app");
  });

  it("reports missing production safeguards", () => {
    const report = buildProductionReadinessReport(
      buildEnv({
        ENABLE_DEV_MOCKS: "true",
        ENABLE_FILE_LOGGING: "false",
        SQLITE_BACKUP_DIR: "",
        MODEL_SECRET_ENCRYPTION_KEY: "",
        APP_LOGIN_ENABLED: "false",
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        "ENABLE_DEV_MOCKS and NEXT_PUBLIC_ENABLE_DEV_MOCKS must both be disabled in production.",
        "Access protection is not enabled. Configure APP_LOGIN_* or BASIC_AUTH_* variables, or explicitly allow unprotected access.",
        "MODEL_SECRET_ENCRYPTION_KEY must be configured in production.",
        "File logging must be enabled in production and APP_LOG_DIR must resolve to a writable directory.",
      ]),
    );
  });

  it("accepts Basic Auth as a fallback protection mode", () => {
    const report = buildProductionReadinessReport(
      buildEnv({
        APP_LOGIN_ENABLED: "false",
        BASIC_AUTH_ENABLED: "true",
        BASIC_AUTH_USERNAME: "admin",
        BASIC_AUTH_PASSWORD: "secret",
      }),
    );

    expect(report.ready).toBe(true);
    expect(report.checks.accessProtectionMode).toBe("basic");
  });
});

describe("assertProductionReadiness", () => {
  it("throws with a readable aggregated message when production is not ready", () => {
    expect(() =>
      assertProductionReadiness(
        buildEnv({
          ENABLE_API_RATE_LIMITS: "false",
        }),
      ),
    ).toThrow("Production readiness check failed:");
  });
});
