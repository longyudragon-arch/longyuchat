import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import Database from "better-sqlite3";

const directory = mkdtempSync(path.join(tmpdir(), "longyuchat-production-"));
const databasePath = path.join(directory, "smoke.db");
const database = new Database(databasePath);
for (const migration of readdirSync("prisma/migrations").sort()) {
  if (/^\d/.test(migration)) database.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
}
const now = new Date().toISOString();
const issueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const insertIssue = database.prepare("INSERT INTO daily_issues (id, issue_date, slug, title, status, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
insertIssue.run("published", issueDate, "smoke-published", "ProductionSmokePublished", "PUBLISHED", now, now, now);
insertIssue.run("draft", "2000-01-01", "smoke-draft", "PrivateDraftMustStayPrivate", "DRAFT", null, now, now);

const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const baseUrl = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString("hex");
const server = spawn(process.execPath, ["scripts/start-prod.mjs", "--port", String(port)], {
  cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, NODE_ENV: "production", NODE_OPTIONS: "",
    DATABASE_URL: "file:" + databasePath.replaceAll("\\", "/"),
    APP_LOGIN_ENABLED: "true", APP_LOGIN_USERNAME: "production-smoke", APP_LOGIN_PASSWORD: password,
    APP_LOGIN_SESSION_SECRET: randomBytes(32).toString("hex"), APP_AUTH_SCOPE: "chat", BASIC_AUTH_ENABLED: "false",
    MODEL_SECRET_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    ENABLE_DEV_MOCKS: "false", NEXT_PUBLIC_ENABLE_DEV_MOCKS: "false",
    ENABLE_API_RATE_LIMITS: "true", ENABLE_FILE_LOGGING: "true", APP_LOG_DIR: path.join(directory, "logs"),
    APP_LISTEN_HOST: "127.0.0.1", SQLITE_BACKUP_DIR: path.join(directory, "backups"),
  },
});
let logs = "";
server.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-16000); });
server.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-16000); });
let cookie;
async function request(route, options = {}) {
  const headers = { ...(cookie ? { cookie } : {}), ...(options.body ? { "content-type": "application/json", origin: baseUrl } : {}), ...options.headers };
  return fetch(baseUrl + route, { ...options, headers, redirect: "manual", signal: AbortSignal.timeout(20000) });
}
async function post(route, body) { return request(route, { method: "POST", body: JSON.stringify(body) }); }
try {
  let ready = false;
  for (let i = 0; i < 60; i += 1) {
    if (server.exitCode !== null) throw new Error("Production server exited: " + logs);
    try { ready = (await request("/login")).status === 200; } catch { /* Wait for startup. */ }
    if (ready) break;
    await delay(500);
  }
  assert(ready, "Production server did not start: " + logs);
  assert.equal((await request("/api/rooms")).status, 401);
  assert.equal((await request("/api/daily/admin/issues")).status, 401);
  assert.equal((await request("/api/daily/issues/smoke-draft")).status, 404);
  assert.equal((await request("/api/daily/issues?status=DRAFT")).status, 400);
  const issues = await (await request("/api/daily/issues")).json();
  assert.deepEqual(issues.issues.map((issue) => issue.status), ["PUBLISHED"]);
  const homepage = await (await request("/")).text();
  assert(homepage.includes("ProductionSmokePublished"), "Homepage did not read the post-build publication.");
  assert(!homepage.includes("PrivateDraftMustStayPrivate"));
  const login = await post("/api/auth/login", { username: "production-smoke", password });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie);
  assert.equal((await request("/api/models", { method: "POST", body: "{}", headers: { origin: "https://foreign.invalid" } })).status, 403);
  const modelResponse = await post("/api/models", {
    name: "Production smoke model", provider: "OPENAI_COMPATIBLE", baseUrl: "http://127.0.0.1:9/v1",
    modelName: "fixture", apiKey: "synthetic-production-smoke-key", defaultReplyLength: 300, enabled: true,
  });
  assert.equal(modelResponse.status, 201);
  const model = (await modelResponse.json()).model;
  assert(!JSON.stringify(model).includes("synthetic-production-smoke-key"));
  const storedKey = database.prepare("SELECT api_key FROM model_configs WHERE id = ?").get(model.id).api_key;
  assert(storedKey.startsWith("enc:v1:"), "Model API key was not encrypted at rest.");
  const roomResponse = await post("/api/rooms", { title: "Production smoke room", type: "SINGLE", modelIds: [model.id] });
  assert.equal(roomResponse.status, 201);
  const room = (await roomResponse.json()).room;
  const messageResponse = await post(`/api/rooms/${room.id}/messages`, { content: "Persisted production message" });
  assert.equal(messageResponse.status, 207);
  const stored = database.prepare("SELECT sequence, content FROM messages WHERE room_id = ? ORDER BY sequence").all(room.id);
  assert.deepEqual(stored, [{ sequence: 1, content: "Persisted production message" }]);
  const publish = await post("/api/daily/admin/runs/publish", { issueDate });
  assert.equal(publish.status, 200);
  assert.equal((await publish.json()).result.outcome, "PRESERVED");
  const source = await post("/api/daily/admin/sources", { name: "Blocked local source", kind: "RSS", feedUrl: "http://127.0.0.1:9/feed", enabled: true, priority: 1 });
  assert.equal(source.status, 201);
  assert.equal((await post("/api/daily/admin/runs/scan", {})).status, 502);
  const run = database.prepare("SELECT status FROM daily_runs WHERE run_type = 'SCAN' ORDER BY started_at DESC LIMIT 1").get();
  assert.equal(run.status, "FAILED");
  console.log(JSON.stringify({ ok: true, mode: "production", checks: ["startup-guard", "private-route-auth", "draft-isolation", "dynamic-homepage", "csrf", "encrypted-model-create", "room-transaction", "failure-message-persistence", "preserve-publication", "blocked-local-feed-and-failed-run"] }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server.exitCode === null) {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    else server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  }
  database.close();
  rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
