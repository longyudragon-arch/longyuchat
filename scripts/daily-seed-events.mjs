import { callDailyApi } from "./daily-api-client.mjs";

const takeArg = process.argv[2];
const take = takeArg ? Number.parseInt(takeArg, 10) : 30;
const payload = await callDailyApi("/api/daily/admin/events/seed", {
  includeAihot: true,
  take: Number.isFinite(take) ? take : 30,
  maxEventsPerDay: 1,
});

console.log(JSON.stringify(payload, null, 2));
