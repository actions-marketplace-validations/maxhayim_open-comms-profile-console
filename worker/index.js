// Cloudflare Worker: counts a visit and returns a freshly drawn VISITOR LOG strip on every request.
// GitHub's image proxy fetches no-cache images again on each profile view, so the number changes on every refresh.
// The count lives in Workers KV (binding COUNTER). If it's empty, the first request seeds it from SEED_PAGE_ID,
// an existing visitor-badge.laobi.icu page_id, so an old count carries on.
import { buildStrip } from "../src/strip.mjs";

const KEY = "visits";

const HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

// Current visitor-badge count, read without adding a visit.
async function seed(pageId) {
  if (!pageId) return 0;
  try {
    const res = await fetch(`https://visitor-badge.laobi.icu/badge?page_id=${encodeURIComponent(pageId)}&query_only=true`, { signal: AbortSignal.timeout(8000) });
    const texts = [...(await res.text()).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].trim());
    const n = Number(texts.at(-1));
    return Number.isInteger(n) ? n : 0;
  } catch {
    return 0;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 404 });

    // ?peek shows the count without adding a visit (for checking it yourself).
    const peek = url.searchParams.has("peek");
    let count = null;
    try {
      const stored = await env.COUNTER.get(KEY);
      const prev = stored == null ? await seed(env.SEED_PAGE_ID) : Number(stored);
      count = peek ? prev : prev + 1;
      // KV writes are eventually consistent and capped on the free plan; a failed write still shows this view's number.
      if (!peek || stored == null) ctx.waitUntil(env.COUNTER.put(KEY, String(count)).catch(() => {}));
    } catch {
      count = null;
    }
    return new Response(request.method === "HEAD" ? null : buildStrip(count), { headers: HEADERS });
  },
};
