import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchPublicLink,
  readLinkContext,
  extractPageMetadata,
  validatePublicLink,
} from "../supabase/functions/candidate-autofill/link-context";
const html =
  '<meta content="Try Kuromon Market in Osaka &amp; local food" property="og:description"><title>Osaka food guide</title>';
test("short links follow validated redirects and extract public metadata, independent of URL slug", async () => {
  const seen: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    seen.push(String(input));
    assert.equal(init?.redirect, "manual");
    return seen.length === 1
      ? new Response(null, {
          status: 302,
          headers: { location: "https://www.instagram.com/p/opaque/" },
        })
      : new Response(html, { headers: { "content-type": "text/html" } });
  };
  const result = await readLinkContext("https://bit.ly/example", fetcher);
  assert.equal(result.resolvedUrl, "https://www.instagram.com/p/opaque/");
  assert.match(result.metadata, /Kuromon Market in Osaka & local food/);
  assert.equal(seen.length, 2);
});
test("private network targets, credentials, non-HTTPS and malicious provider suffixes are rejected before fetch", async () => {
  for (const url of [
    "http://www.tiktok.com/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://169.254.169.254/",
    "https://www.instagram.com.evil.test/",
    "https://user:pass@www.instagram.com/",
    "https://www.tiktok.com:444/",
  ])
    assert.throws(() => validatePublicLink(url));
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return new Response(null, {
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data/" },
    });
  };
  await assert.rejects(() =>
    fetchPublicLink("https://bit.ly/example", fetcher),
  );
  assert.equal(calls, 1);
});
test("redirect loops, oversized bodies and blocked posts return actionable errors", async () => {
  await assert.rejects(
    () =>
      fetchPublicLink(
        "https://bit.ly/loop",
        async () =>
          new Response(null, { status: 302, headers: { location: "/loop" } }),
      ),
    /resolved/,
  );
  await assert.rejects(
    () =>
      fetchPublicLink(
        "https://www.instagram.com/p/1",
        async () => new Response("denied", { status: 403 }),
      ),
    /private/,
  );
  await assert.rejects(
    () =>
      fetchPublicLink(
        "https://www.instagram.com/p/1",
        async () =>
          new Response("x".repeat(512001), {
            headers: { "content-type": "text/html" },
          }),
      ),
    /large/,
  );
});
test("TikTok oEmbed caption is used as place evidence", async () => {
  const fetcher: typeof fetch = async (input) =>
    String(input).includes("/oembed?")
      ? Response.json({ title: "Explore Fushimi Inari Shrine in Kyoto #Japan" })
      : new Response("<title>TikTok</title>", {
          headers: { "content-type": "text/html" },
        });
  assert.match(
    (
      await readLinkContext(
        "https://www.tiktok.com/@traveller/video/123",
        fetcher,
      )
    ).metadata,
    /Fushimi Inari Shrine in Kyoto/,
  );
  const embedOnly: typeof fetch = async (input) =>
    String(input).includes("/oembed?")
      ? Response.json({ title: "Osaka Castle in Osaka" })
      : new Response("Blocked", { status: 403 });
  assert.match(
    (
      await readLinkContext(
        "https://www.tiktok.com/@traveller/video/123",
        embedOnly,
      )
    ).metadata,
    /Osaka Castle/,
  );
  assert.equal(
    extractPageMetadata(
      '<script>steal()</script><meta name="description" content="Paris &quot;food&quot;">',
    ),
    'Paris "food"',
  );
});
