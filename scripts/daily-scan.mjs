import { callDailyApi } from "./daily-api-client.mjs";

const payload = await callDailyApi("/api/daily/admin/runs/scan", {});
console.log(JSON.stringify(payload, null, 2));
