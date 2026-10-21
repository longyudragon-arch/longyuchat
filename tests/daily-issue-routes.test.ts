import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("@/server/services/daily-issue-service", () => ({ listDailyIssues: mocks.list, getDailyIssueBySlug: mocks.detail }));
vi.mock("@/server/observability/server-logger", () => ({ logRouteError: vi.fn() }));

import { GET as listPublic } from "@/app/api/daily/issues/route";
import { GET as getPublic } from "@/app/api/daily/issues/[slug]/route";
import { GET as listAdmin } from "@/app/api/daily/admin/issues/route";

beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([]); });

describe("daily issue visibility", () => {
  it("always constrains the public list to published issues", async () => {
    const response = await listPublic(new Request("http://localhost/api/daily/issues?limit=20"));
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({ status: "PUBLISHED", limit: 20 });
  });

  it.each(["DRAFT", "SKIPPED"])("rejects requesting %s from the public list", async (status) => {
    const response = await listPublic(new Request(`http://localhost/api/daily/issues?status=${status}`));
    expect(response.status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "SKIPPED"])("returns 404 for a known %s slug without returning its content", async (status) => {
    mocks.detail.mockResolvedValue({ status, title: "Private editorial draft" });
    const response = await getPublic(new Request("http://localhost/api/daily/issues/private"), { params: Promise.resolve({ slug: "private" }) });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Private editorial draft");
  });

  it("returns published issue details", async () => {
    mocks.detail.mockResolvedValue({ status: "PUBLISHED", title: "Published issue" });
    const response = await getPublic(new Request("http://localhost/api/daily/issues/public"), { params: Promise.resolve({ slug: "public" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).issue.title).toBe("Published issue");
  });

  it("retains draft filtering in the protected admin route", async () => {
    const response = await listAdmin(new Request("http://localhost/api/daily/admin/issues?status=DRAFT&limit=20"));
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({ status: "DRAFT", limit: 20 });
    expect(await response.json()).toHaveProperty("issues", []);
  });
});
