#!/usr/bin/env node
/**
 * Quick, browser-less smoke test of a running BINHI instance.
 *   node scripts/smoke.mjs https://your-binhi.replit.app
 * Checks: health, editor shell, unknown published site → 410, runtime asset,
 * CSRF guard, auth guard. Exit code 1 on any failure.
 */
const base = (process.argv[2] ?? process.env.BINHI_PUBLIC_URL ?? "http://127.0.0.1:4100").replace(/\/$/, "");
const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push([true, name, detail ?? ""]);
  } catch (e) {
    results.push([false, name, e instanceof Error ? e.message : String(e)]);
  }
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

await check("GET /api/health is ok", async () => {
  const r = await fetch(`${base}/api/health`);
  expect(r.status === 200, `status ${r.status}`);
  const j = await r.json();
  expect(j.ok === true && j.service === "binhi", JSON.stringify(j));
  return `env=${j.env} signup=${j.signupEnabled}`;
});
await check("editor shell is served", async () => {
  const r = await fetch(`${base}/signin`);
  expect(r.status === 200, `status ${r.status}`);
  const t = await r.text();
  expect(t.includes('<div id="root">'), "no SPA root in response");
});
await check("unknown published site returns 410", async () => {
  const r = await fetch(`${base}/s/no-such-site-${Date.now().toString(36)}/`);
  expect(r.status === 410, `status ${r.status}`);
  expect((r.headers.get("content-security-policy") ?? "").includes("default-src 'none'"), "CSP missing");
});
await check("published-site runtime is served", async () => {
  const r = await fetch(`${base}/s/_binhi/runtime.js`);
  expect(r.status === 200, `status ${r.status}`);
});
await check("mutations without the editor header are refused", async () => {
  const r = await fetch(`${base}/api/sites`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  expect(r.status === 403, `status ${r.status}`);
});
await check("site APIs require a session", async () => {
  const r = await fetch(`${base}/api/sites`, { headers: { "x-binhi-request": "editor" } });
  expect(r.status === 401, `status ${r.status}`);
});
await check("secure headers present", async () => {
  const r = await fetch(`${base}/api/health`);
  expect(r.headers.get("x-content-type-options") === "nosniff", "nosniff missing");
});

for (const [ok, name, detail] of results) console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => !r[0]).length;
console.log(failed ? `\n${failed} check(s) failed against ${base}` : `\nAll ${results.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
