import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/client/api.js";

afterEach(() => vi.unstubAllGlobals());

describe("shared upload transport", () => {
  it("keeps CSRF and credentials when upload metadata supplies custom headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ asset: { id: "asset_test" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], "test.png", { type: "image/png" });
    await api.upload("site_test", file, "Test alt", "Studio exports");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sites/site_test/assets");
    expect(init.credentials).toBe("same-origin");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(file);
    expect(init.headers).toMatchObject({
      "x-binhi-request": "editor",
      "content-type": "image/png",
      "x-binhi-filename": "test.png",
      "x-binhi-alt": "Test%20alt",
      "x-binhi-folder": "Studio%20exports",
    });
  });
  it("keeps JSON content type and the same CSRF header on ordinary edits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ site: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await api.updateSite("site_test", { name: "Updated" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-binhi-request": "editor", "content-type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ name: "Updated" }));
  });
});
