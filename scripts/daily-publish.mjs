import { callDailyApi } from "./daily-api-client.mjs";

const issueDate = process.argv[2]?.trim();
const payload = await callDailyApi(
  "/api/daily/admin/runs/publish",
  issueDate ? { issueDate } : {},
);
console.log(JSON.stringify(payload, null, 2));
