import assert from "node:assert/strict";
import { test } from "node:test";
import { demoClaims, fmtGen, makeClaimId, parseUrls, summarize, timeLeft, toWei, validPublicUrl, GEN } from "../lib/domain";

test("fmtGen and toWei round-trip", () => {
  assert.equal(fmtGen(2n * GEN), "2");
  assert.equal(fmtGen((25n * GEN) / 10n), "2.5");
  assert.equal(fmtGen("0"), "0");
  assert.equal(toWei(2), 2n * GEN);
  assert.equal(toWei(1.5), (3n * GEN) / 2n);
});

test("validPublicUrl mirrors the contract rule", () => {
  assert.ok(validPublicUrl("https://status.acme.example/history"));
  for (const bad of ["http://a.example", "https://localhost/x", "https://10.0.0.1/", "https://a.local/x", "https://u:p@a.example/", "https://a.example:8443/", "https://a.example/#x", "not a url"]) {
    assert.equal(validPublicUrl(bad), false, bad);
  }
});

test("parseUrls splits and dedupes", () => {
  assert.deepEqual(parseUrls("https://a.example/x, https://b.example\nhttps://a.example/x"), ["https://a.example/x", "https://b.example"]);
});

test("makeClaimId satisfies the contract regex", () => {
  for (let i = 0; i < 50; i++) assert.match(makeClaimId("https://Northwind.example/pricing", "99.99% uptime guaranteed!!"), /^[a-z0-9-]{1,48}$/);
  assert.match(makeClaimId("https://x.example", "???"), /^[a-z0-9-]{1,48}$/);
});

test("summarize and demo data", () => {
  const s = summarize(demoClaims());
  assert.equal(s.total, 6);
  assert.equal(s.counts.SUPPORTS + s.counts.MISREPRESENTS + s.counts.PARTIAL + s.counts.NOT_FOUND, 6);
  assert.ok(s.staked > 0n);
});

test("timeLeft", () => {
  assert.equal(timeLeft(100, 200), "window closed");
  assert.equal(timeLeft(200 + 3 * 3600 + 120, 200), "3h 2m left");
});
