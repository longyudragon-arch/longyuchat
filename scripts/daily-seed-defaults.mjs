import { callDailyApi } from "./daily-api-client.mjs";

const payload = await callDailyApi("/api/daily/admin/sources/seed", {});
console.log(JSON.stringify(payload, null, 2));
