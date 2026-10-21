import "dotenv/config";

import Database from "better-sqlite3";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const cwd = process.cwd();
const port = Number(process.env.UI_SMOKE_PORT ?? "3101");
const providerPort = Number(process.env.UI_SMOKE_PROVIDER_PORT ?? String(port + 100));
const baseUrl = process.env.UI_SMOKE_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
const providerBaseUrl = "https://ui-smoke.invalid/v1";
const outputDir = path.join(cwd, "output", "playwright");
const smokeDatabaseDirectory = path.join(cwd, "prisma", ".ui-smoke");
const smokeDatabaseSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const defaultDatabaseRelativePath = `./prisma/.ui-smoke/ui-smoke-${smokeDatabaseSuffix}.db`;
const databaseRelativePath =
  process.env.UI_SMOKE_DATABASE_PATH?.trim() || defaultDatabaseRelativePath;
const databasePath = path.resolve(cwd, databaseRelativePath.replace(/^\.[\\/]/, ""));

const smokeLoginUsername = process.env.UI_SMOKE_LOGIN_USERNAME?.trim() || "smoke-admin";
const smokeLoginPassword = process.env.UI_SMOKE_LOGIN_PASSWORD?.trim() || "smoke-pass";

const localBypassHosts = ["localhost", "127.0.0.1", "::1"];

function buildNoProxyValue(...values) {
  const merged = [];

  for (const value of values) {
    for (const entry of String(value ?? "").split(",")) {
      const normalized = entry.trim();

      if (!normalized || merged.includes(normalized)) {
        continue;
      }

      merged.push(normalized);
    }
  }

  for (const host of localBypassHosts) {
    if (!merged.includes(host)) {
      merged.push(host);
    }
  }

  return merged.join(",");
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function removeIfExists(filePath, { suppressErrors = false } = {}) {
  try {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  } catch (error) {
    if (!suppressErrors) {
      throw error;
    }
  }
}

function getSmokeEnvironment() {
  const noProxy = buildNoProxyValue(process.env.NO_PROXY, process.env.no_proxy);

  return {
    ...process.env,
    DATABASE_URL: `file:${databaseRelativePath}`,
    NODE_ENV: "development",
    UI_SMOKE_PROVIDER_TARGET: `http://127.0.0.1:${providerPort}`,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import="${pathToFileURL(path.join(cwd, "scripts/testing/smoke-provider-preload.mjs"))}"`,
    APP_LOGIN_ENABLED: "true",
    APP_LOGIN_USERNAME: smokeLoginUsername,
    APP_LOGIN_PASSWORD: smokeLoginPassword,
    APP_LOGIN_SESSION_SECRET:
      process.env.UI_SMOKE_SESSION_SECRET?.trim() || "ui-smoke-session-secret-32-chars",
    ENABLE_DEV_MOCKS: "true",
    NEXT_PUBLIC_ENABLE_DEV_MOCKS: "true",
    NO_PROXY: noProxy,
    no_proxy: noProxy,
  };
}

function seedSmokeDatabase() {
  const db = new Database(databasePath);
  const now = new Date().toISOString();

  db.pragma("foreign_keys = ON");

  const insertConnection = db.prepare(`
    INSERT INTO provider_connections (
      id, name, provider, base_url, api_key, discovery_strategy, enabled, created_at, updated_at
    ) VALUES (
      @id, @name, @provider, @baseUrl, @apiKey, @discoveryStrategy, @enabled, @createdAt, @updatedAt
    )
  `);

  const insertModel = db.prepare(`
    INSERT INTO model_configs (
      id, name, connection_id, provider, base_url, model_name, avatar_label, avatar_color, api_key,
      default_reply_length, enabled, created_at, updated_at
    ) VALUES (
      @id, @name, @connectionId, @provider, @baseUrl, @modelName, @avatarLabel, @avatarColor, @apiKey,
      @defaultReplyLength, @enabled, @createdAt, @updatedAt
    )
  `);

  const insertRoom = db.prepare(`
    INSERT INTO chat_rooms (
      id, title, type, next_message_sequence, created_at, updated_at
    ) VALUES (
      @id, @title, @type, @nextMessageSequence, @createdAt, @updatedAt
    )
  `);

  const insertRoomModel = db.prepare(`
    INSERT INTO chat_room_models (
      id, room_id, model_id, sort_order, execution_state, consecutive_failure_count, timeout_count
    ) VALUES (
      @id, @roomId, @modelId, @sortOrder, @executionState, @consecutiveFailureCount, @timeoutCount
    )
  `);

  insertConnection.run({
    id: "ui-connection-1",
    name: "UI Smoke Connection",
    provider: "OPENAI_COMPATIBLE",
    baseUrl: providerBaseUrl,
    apiKey: "ui-smoke-key",
    discoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    enabled: 1,
    createdAt: now,
    updatedAt: now,
  });

  [
    {
      id: "ui-model-alpha",
      name: "UI Smoke Alpha",
      connectionId: null,
      provider: "OPENAI_COMPATIBLE",
      baseUrl: providerBaseUrl,
      modelName: "mock-alpha",
      avatarLabel: "OA",
      avatarColor: "#10b981",
      apiKey: "alpha-key",
      defaultReplyLength: 300,
      enabled: 1,
    },
    {
      id: "ui-model-beta",
      name: "UI Smoke Beta",
      connectionId: null,
      provider: "OPENAI_COMPATIBLE",
      baseUrl: providerBaseUrl,
      modelName: "mock-beta",
      avatarLabel: "OB",
      avatarColor: "#6366f1",
      apiKey: "beta-key",
      defaultReplyLength: 300,
      enabled: 1,
    },
    {
      id: "ui-model-disabled",
      name: "UI Smoke Disabled",
      connectionId: null,
      provider: "OPENAI_COMPATIBLE",
      baseUrl: providerBaseUrl,
      modelName: "mock-disabled",
      avatarLabel: "OD",
      avatarColor: "#ef4444",
      apiKey: "disabled-key",
      defaultReplyLength: 300,
      enabled: 0,
    },
    {
      id: "ui-model-linked",
      name: "UI Smoke Linked",
      connectionId: "ui-connection-1",
      provider: "OPENAI_COMPATIBLE",
      baseUrl: providerBaseUrl,
      modelName: "mock-linked",
      avatarLabel: "OL",
      avatarColor: "#f59e0b",
      apiKey: "linked-key",
      defaultReplyLength: 300,
      enabled: 1,
    },
    {
      id: "ui-model-auth-fail",
      name: "UI Smoke Auth Fail",
      connectionId: null,
      provider: "OPENAI_COMPATIBLE",
      baseUrl: providerBaseUrl,
      modelName: "mock-auth-fail",
      avatarLabel: "AF",
      avatarColor: "#ef4444",
      apiKey: "bad-auth-key",
      defaultReplyLength: 300,
      enabled: 1,
    },
  ].forEach((model) =>
    insertModel.run({
      ...model,
      createdAt: now,
      updatedAt: now,
    }),
  );

  insertRoom.run({
    id: "ui-room-1",
    title: "UI Smoke Room",
    type: "GROUP",
    nextMessageSequence: 1,
    createdAt: now,
    updatedAt: now,
  });

  insertRoom.run({
    id: "ui-room-partial",
    title: "UI Smoke Partial Room",
    type: "GROUP",
    nextMessageSequence: 1,
    createdAt: now,
    updatedAt: now,
  });

  [
    {
      id: "ui-room-model-1",
      roomId: "ui-room-1",
      modelId: "ui-model-alpha",
      sortOrder: 1,
    },
    {
      id: "ui-room-model-2",
      roomId: "ui-room-1",
      modelId: "ui-model-beta",
      sortOrder: 2,
    },
    {
      id: "ui-room-partial-model-1",
      roomId: "ui-room-partial",
      modelId: "ui-model-auth-fail",
      sortOrder: 1,
    },
    {
      id: "ui-room-partial-model-2",
      roomId: "ui-room-partial",
      modelId: "ui-model-alpha",
      sortOrder: 2,
    },
  ].forEach((roomModel) =>
    insertRoomModel.run({
      ...roomModel,
      executionState: "ACTIVE",
      consecutiveFailureCount: 0,
      timeoutCount: 0,
    }),
  );

  db.close();
}

async function startProviderStubServer() {
  const models = [
    { id: "mock-alpha", object: "model", owned_by: "ui-smoke" },
    { id: "mock-beta", object: "model", owned_by: "ui-smoke" },
    { id: "mock-gamma", object: "model", owned_by: "ui-smoke" },
  ];

  const server = createServer(async (request, response) => {
    if (!request.url) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Missing request URL." }));
      return;
    }

    const url = new URL(request.url, `http://127.0.0.1:${providerPort}`);
    const authorizationHeader = request.headers.authorization ?? "";

    if (authorizationHeader.includes("bad-auth-key")) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: {
            message: "invalid_api_key: UI smoke simulated authentication failure.",
          },
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ object: "list", data: models }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      const chunks = [];

      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const bodyText = Buffer.concat(chunks).toString("utf8");
      const body = bodyText ? JSON.parse(bodyText) : {};
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "mock-alpha";
      const content =
        body.messages?.at?.(-1)?.content === "ping"
          ? `${model} 已连通，本地 smoke provider 返回 pong。`
          : `【${model}】UI smoke provider 已收到消息。`;

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          id: `smoke-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content,
              },
            },
          ],
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found." }));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(providerPort, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(undefined);
    });
  });

  return server;
}

async function waitForServer(url, timeoutMs, serverState) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (serverState.exited) {
      throw new Error(`Dev server exited before becoming ready.\n${serverState.logs.join("")}`);
    }

    try {
      const response = await fetch(`${url}/login`, { redirect: "manual" });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {}

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${url}.\n${serverState.logs.join("")}`);
}

async function expectVisibleText(page, text) {
  await page.getByText(text, { exact: false }).waitFor({ state: "visible", timeout: 10000 });
}

async function waitForInputValue(locator, expectedValue, timeoutMs = 30000) {
  const start = Date.now();
  let lastValue = "";

  while (Date.now() - start < timeoutMs) {
    try {
      lastValue = await locator.inputValue();
    } catch {
      lastValue = "";
    }

    if (lastValue === expectedValue) {
      return;
    }

    await delay(500);
  }

  throw new Error(
    `Timed out waiting for input value "${expectedValue}". Last observed value: "${lastValue}".`,
  );
}

async function runBrowserChecks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();

  try {
    await page.goto("/login");

    await page.getByTestId("login-username").fill("wrong-user");
    await page.getByTestId("login-password").fill("wrong-pass");
    await page.getByTestId("login-submit").click();

    await expectVisibleText(page, "用户名或密码不正确");
    await expectVisibleText(page, "请检查登录用户名是否正确。");
    await expectVisibleText(page, "请检查登录密码是否正确。");

    await page.getByTestId("login-username").fill(smokeLoginUsername);
    await page.getByTestId("login-password").fill(smokeLoginPassword);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 }),
      page.getByTestId("login-submit").click(),
    ]);

    await page.goto("/models");
    await page.getByTestId("model-base-url").fill("not-a-url");
    await page.getByTestId("model-api-key").fill("");
    await page.getByTestId("model-id").fill("");
    await page.getByTestId("model-submit").click();
    await expectVisibleText(page, "请求参数不完整或格式不正确");
    await expectVisibleText(page, "请确认 Base URL 是否正确，并检查它是否与当前厂商模板匹配。");
    await expectVisibleText(page, "请检查 API Key 是否正确，并确认它属于当前厂商或平台。");
    await expectVisibleText(page, "请核对模型 ID 是否存在，并确认它与当前接口地址和模板匹配。");

    await page.getByTestId("model-source-connection").click();
    const savedConnectionSelect = page.getByTestId("model-saved-connection-select");
    await savedConnectionSelect.waitFor({ state: "visible", timeout: 10000 });
    const savedConnectionOptions = await savedConnectionSelect.locator("option").allTextContents();
    if (!savedConnectionOptions.some((option) => option.includes("UI Smoke Connection"))) {
      throw new Error("Expected the saved connection selector to include the seeded smoke connection.");
    }
    await page.getByTestId("model-source-direct").click();
    await expectVisibleText(page, "直接配置模式会把当前模型保存为独立接入");

    await page.getByTestId("open-connection-manager").click();
    await page.getByTestId("connection-name").waitFor({ state: "visible", timeout: 10000 });
    await page.getByTestId("connection-name").fill("UI Smoke Broken Connection");
    await page.getByTestId("connection-base-url").fill("not-a-url");
    await page.getByTestId("connection-api-key").fill("");
    await page.getByTestId("connection-submit").click();
    await expectVisibleText(page, "请求参数不完整或格式不正确");
    await expectVisibleText(page, "请确认接口地址是否正确，并检查当前网络或上游平台连通性。");
    await expectVisibleText(page, "请检查 API Key 是否正确，并确认它属于当前厂商或平台。");

    await page.getByTestId("connection-test-ui-connection-1").click();
    await expectVisibleText(page, "连接「UI Smoke Connection」连接验证通过。");

    await page.getByTestId("connection-discover-ui-connection-1").click();
    await expectVisibleText(page, "连接「UI Smoke Connection」已获取到 3 个模型。");
    await expectVisibleText(page, "已发现的模型");
    await page.getByTestId("connection-discovered-model-ui-connection-1-mock-alpha").click();
    await expectVisibleText(page, "已选择连接「UI Smoke Connection」并填入模型 ID「mock-alpha」。");
    await page.getByTestId("back-to-model-builder").click();
    await page.getByTestId("model-saved-connection-select").waitFor({ state: "visible", timeout: 10000 });
    const selectedConnectionValue = await page.getByTestId("model-saved-connection-select").inputValue();
    if (selectedConnectionValue !== "ui-connection-1") {
      throw new Error(`Expected the model builder to bind ui-connection-1. Got "${selectedConnectionValue}".`);
    }
    const selectedModelId = await page.getByTestId("model-id").inputValue();
    if (selectedModelId !== "mock-alpha") {
      throw new Error(`Expected the model builder to reuse discovered model mock-alpha. Got "${selectedModelId}".`);
    }

    await page.goto("/rooms/ui-room-1/edit");
    const roomTitleInput = page.getByTestId("edit-room-title");
    await roomTitleInput.waitFor({ state: "visible", timeout: 10000 });
    await expectVisibleText(page, "UI Smoke Alpha");
    await expectVisibleText(page, "UI Smoke Beta");
    await waitForInputValue(roomTitleInput, "UI Smoke Room");

    await page.getByText("UI Smoke Disabled", { exact: false }).click();
    await expectVisibleText(page, "这个模型当前已停用");
    await expectVisibleText(page, "当前选中了不可用模型");

    await page.goto("/rooms/ui-room-partial");
    await page.getByTestId("room-composer-input").waitFor({ state: "visible", timeout: 10000 });

    const executionChain = page.getByTestId("room-execution-chain");
    if ((await executionChain.count()) === 0) {
      await page.getByRole("button", { name: "显示执行链" }).click();
      await executionChain.waitFor({ state: "visible", timeout: 10000 });
    }

    await page.getByTestId("room-composer-input").fill("smoke partial round");
    await page.getByTestId("room-composer-send").click();
    await expectVisibleText(page, "UI Smoke Auth Fail 已自动暂停");
    await expectVisibleText(page, "本轮后续模型");
    if (await page.getByText("【mock-alpha】UI smoke provider 已收到消息。", { exact: true }).count()) {
      throw new Error("A later model replied after an earlier failure.");
    }

    const failedStatus = page.getByTestId("room-model-status-ui-model-auth-fail");
    await failedStatus.waitFor({ state: "visible", timeout: 10000 });
    const firstRoundFailedStatus = (await failedStatus.textContent())?.trim();
    if (firstRoundFailedStatus !== "已暂停") {
      throw new Error(
        `Expected auth-fail model to show paused after the degraded round. Got "${firstRoundFailedStatus}".`,
      );
    }

    const healthyStatus = page.getByTestId("room-model-status-ui-model-alpha");
    await healthyStatus.waitFor({ state: "visible", timeout: 10000 });
    const firstRoundHealthyStatus = (await healthyStatus.textContent())?.trim();
    if (firstRoundHealthyStatus === "完成" || firstRoundHealthyStatus === "回复中") {
      throw new Error(
        `Expected later model to remain unexecuted after failure. Got "${firstRoundHealthyStatus}".`,
      );
    }

    await page.getByTestId("room-composer-input").fill("smoke skipped round");
    await page.getByTestId("room-composer-send").click();
    await expectVisibleText(page, "本轮已跳过不可用模型");
    await expectVisibleText(page, "【mock-alpha】UI smoke provider 已收到消息。");
    await page.reload();
    await expectVisibleText(page, "smoke skipped round");
    await expectVisibleText(page, "【mock-alpha】UI smoke provider 已收到消息。");

    const secondRoundFailedStatus = (await failedStatus.textContent())?.trim();
    if (secondRoundFailedStatus !== "已停用") {
      throw new Error(
        `Expected paused model to be skipped as disabled on the next round. Got "${secondRoundFailedStatus}".`,
      );
    }
  } catch (error) {
    ensureDirectory(outputDir);
    await page.screenshot({ path: path.join(outputDir, "ui-smoke-failure.png"), fullPage: true });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

function initializeSmokeDatabase() {
  ensureDirectory(smokeDatabaseDirectory);
  const relative = path.relative(smokeDatabaseDirectory, databasePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("UI smoke database must be inside prisma/.ui-smoke.");
  }
  if (fs.existsSync(databasePath)) throw new Error("Refusing to overwrite an existing smoke database.");
  const db = new Database(databasePath);
  try {
    const migrations = path.join(cwd, "prisma", "migrations");
    for (const directory of fs.readdirSync(migrations).sort()) {
      if (!/^\d/.test(directory)) continue;
      db.exec(fs.readFileSync(path.join(migrations, directory, "migration.sql"), "utf8"));
    }
    db.pragma("foreign_keys = ON");
  } finally {
    db.close();
  }
}

async function main() {
  ensureDirectory(outputDir);
  initializeSmokeDatabase();

  const env = getSmokeEnvironment();
  const providerServer = await startProviderStubServer();

  seedSmokeDatabase();

  const serverState = { exited: false, logs: [] };
  const nextBinPath = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBinPath, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => {
    serverState.logs.push(chunk.toString());
  });
  server.stderr.on("data", (chunk) => {
    serverState.logs.push(chunk.toString());
  });
  server.on("exit", () => {
    serverState.exited = true;
  });

  try {
    await waitForServer(baseUrl, 120000, serverState);
    await runBrowserChecks();
    console.log("UI smoke checks passed.");
  } finally {
    await new Promise((resolve) => {
      providerServer.close(() => resolve(undefined));
    });
    if (!server.killed) {
      server.kill("SIGTERM");
    }
    if (!process.env.UI_SMOKE_PRESERVE_DB) {
      removeIfExists(databasePath, { suppressErrors: true });
      removeIfExists(`${databasePath}-journal`, { suppressErrors: true });
      removeIfExists(`${databasePath}-wal`, { suppressErrors: true });
      removeIfExists(`${databasePath}-shm`, { suppressErrors: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
