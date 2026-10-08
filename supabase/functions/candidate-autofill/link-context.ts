// Fetch only supported public providers. Validate EVERY redirect before making another request.
const hosts = new Set([
  "instagram.com",
  "www.instagram.com",
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
  "maps.app.goo.gl",
  "goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "youtu.be",
  "youtube.com",
  "www.youtube.com",
  "tripadvisor.com",
  "www.tripadvisor.com",
  "booking.com",
  "www.booking.com",
]);
export function validatePublicLink(value: string): URL {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    !hosts.has(u.hostname)
  )
    throw Error(
      "Use an HTTPS Instagram, TikTok, Maps or supported travel link.",
    );
  if (u.href.length > 2000) throw Error("This link is too long.");
  return u;
}
function decode(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const code =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    });
}
export function extractPageMetadata(html: string): string {
  const values: string[] = [];
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) values.push(title);
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    ))
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (
      [
        "og:title",
        "og:description",
        "description",
        "twitter:title",
        "twitter:description",
      ].includes(key) &&
      attrs.content
    )
      values.push(attrs.content);
  }
  return [
    ...new Set(
      values.map((v) =>
        decode(v)
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    ),
  ]
    .join("\n")
    .slice(0, 10000);
}
async function limitedText(response: Response) {
  if (Number(response.headers.get("content-length") || 0) > 512000) {
    await response.body?.cancel();
    throw Error("The linked page is too large.");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 512000) throw Error("The linked page is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(joined);
}
export async function fetchPublicLink(
  value: string,
  fetcher: typeof fetch = fetch,
  signal = AbortSignal.timeout(12000),
  allowUnavailable = false,
) {
  let url = validatePublicLink(value);
  for (let hop = 0; hop <= 5; hop++) {
    const response = await fetcher(url.href, {
      redirect: "manual",
      signal,
      headers: {
        Accept: "text/html,application/json",
        "User-Agent": "Eggsplore/1.0 (public place metadata)",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const target = response.headers.get("location");
      await response.body?.cancel();
      if (!target || hop === 5)
        throw Error("The short link could not be resolved.");
      url = validatePublicLink(new URL(target, url).href);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (allowUnavailable) return { url: url.href, text: "" };
      throw Error(
        "This post is private, unavailable or blocks public access. Enter its place details manually.",
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/json/i.test(contentType)) {
      await response.body?.cancel();
      throw Error("This link has no readable public place information.");
    }
    try {
      return { url: url.href, text: await limitedText(response) };
    } catch (cause) {
      if (allowUnavailable && !signal.aborted)
        return { url: url.href, text: "" };
      throw cause;
    }
  }
  throw Error("The short link could not be resolved.");
}
export async function readLinkContext(
  value: string,
  fetcher: typeof fetch = fetch,
) {
  const signal = AbortSignal.timeout(12000);
  const page = await fetchPublicLink(value, fetcher, signal, true);
  let metadata = extractPageMetadata(page.text);
  const url = new URL(page.url);
  if (
    /(^|\.)tiktok\.com$/.test(url.hostname) &&
    /\/@[^/]+\/video\/\d+/.test(url.pathname)
  ) {
    try {
      const embed = await fetchPublicLink(
        "https://www.tiktok.com/oembed?url=" + encodeURIComponent(url.href),
        fetcher,
        signal,
      );
      const data = JSON.parse(embed.text);
      if (typeof data.title === "string")
        metadata += "\nTikTok caption: " + data.title.slice(0, 8000);
    } catch {
      /* Public page metadata remains usable if oEmbed is unavailable. */
    }
  }
  if (!metadata.trim())
    throw Error(
      "No public caption or place metadata was available. Enter details manually.",
    );
  return { resolvedUrl: page.url, metadata: metadata.slice(0, 10000) };
}
