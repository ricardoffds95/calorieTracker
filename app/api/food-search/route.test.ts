import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));
vi.mock("@/lib/off-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/off-search")>()),
  searchOffServer: vi.fn(),
}));

import { OffUnavailableError, searchOffServer } from "@/lib/off-search";
import { GET } from "./route";

const get = (q?: string, page?: string) => {
  const params = new URLSearchParams();
  if (q !== undefined) params.set("q", q);
  if (page !== undefined) params.set("page", page);
  return GET(new Request(`http://localhost/api/food-search?${params}`));
};
const results = [{ id: "1", source: "off", name: "Arroz", calories_100g: 130, protein_100g: 2.7, carbs_100g: 28, fat_100g: 0.3 }];
const page = { results, page: 1, pageCount: 21, total: 401, totalExact: true };

beforeEach(() => {
  vi.resetAllMocks();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
});

describe("GET /api/food-search", () => {
  it("rejects requests without a session (401) and never calls Open Food Facts", async () => {
    getClaims.mockResolvedValue({ data: null });
    const response = await get("arroz");
    expect(response.status).toBe(401);
    expect(searchOffServer).not.toHaveBeenCalled();
  });

  it.each([["missing", undefined], ["empty", "  "], ["too short", "a"], ["too long", "a".repeat(101)]])(
    "rejects a %s query (400) without calling Open Food Facts",
    async (_label, q) => {
      const response = await get(q);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_request" });
      expect(searchOffServer).not.toHaveBeenCalled();
    },
  );

  it("accepts two letters (no 3-letter minimum any more)", async () => {
    vi.mocked(searchOffServer).mockResolvedValue(page as never);
    expect((await get("ar")).status).toBe(200);
  });

  it("returns the page for a normalized query, defaulting to page 1", async () => {
    vi.mocked(searchOffServer).mockResolvedValue(page as never);
    const response = await get("  Arroz  ");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(vi.mocked(searchOffServer).mock.calls[0]![0]).toBe("arroz");
    expect(vi.mocked(searchOffServer).mock.calls[0]![1]).toMatchObject({ page: 1 });
  });

  it("passes the requested page on and rejects pages outside 1..25 or not numbers", async () => {
    vi.mocked(searchOffServer).mockResolvedValue(page as never);
    expect((await get("arroz", "3")).status).toBe(200);
    expect(vi.mocked(searchOffServer).mock.calls[0]![1]).toMatchObject({ page: 3 });
    for (const bad of ["0", "26", "-1", "abc", "1.5"]) {
      expect((await get("arroz", bad)).status, bad).toBe(400);
    }
    expect(searchOffServer).toHaveBeenCalledTimes(1);
  });

  it("answers 503 'off_unavailable' without leaking the reason", async () => {
    vi.mocked(searchOffServer).mockRejectedValue(new OffUnavailableError("rate_limited"));
    const response = await get("arroz");
    expect(response.status).toBe(503);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("off_unavailable");
    expect(body).not.toContain("rate_limited");
  });

  it("answers 500 for unexpected errors", async () => {
    vi.mocked(searchOffServer).mockRejectedValue(new Error("boom"));
    const response = await get("arroz");
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("boom");
  });
});
