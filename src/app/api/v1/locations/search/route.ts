import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GeoapifyResult = {
  place_id?: string;
  name?: string;
  formatted?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
  result_type?: string;
};

type CachedValue = { expiresAt: number; suggestions: ReturnType<typeof normalize>[] };
const cache = new Map<string, CachedValue>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalize(item: GeoapifyResult, index: number) {
  const formatted = item.formatted || [item.name, item.city, item.state, item.country].filter(Boolean).join(", ");
  return {
    id: item.place_id || `${item.lat ?? ""}:${item.lon ?? ""}:${index}`,
    name: item.name || item.city || item.state || formatted || "Location",
    formatted: formatted || item.name || "Location",
    city: item.city || undefined,
    state: item.state || undefined,
    country: item.country || undefined,
    lat: typeof item.lat === "number" ? item.lat : undefined,
    lon: typeof item.lon === "number" ? item.lon : undefined,
    resultType: item.result_type || undefined,
  };
}

export async function GET(req: Request) {
  try {
    requireUser(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return NextResponse.json({ data: { configured: Boolean(process.env.GEOAPIFY_API_KEY), provider: "geoapify", suggestions: [] } });
    }
    if (q.length > 120) {
      return NextResponse.json({ error: { code: "bad_request", message: "Location query is too long" } }, { status: 400 });
    }

    const apiKey = (process.env.GEOAPIFY_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json({ data: { configured: false, provider: "geoapify", suggestions: [] } });
    }

    const countryCode = (process.env.LOCATION_SEARCH_COUNTRY_CODE || "").trim().toLowerCase();
    const bias = (process.env.LOCATION_SEARCH_BIAS || "").trim();
    const cacheKey = `${countryCode}|${bias}|${q.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ data: { configured: true, provider: "geoapify", suggestions: cached.suggestions, cached: true } });
    }

    const params = new URLSearchParams({
      text: q,
      format: "json",
      limit: "7",
      lang: "en",
      apiKey,
    });
    if (countryCode) params.set("filter", `countrycode:${countryCode}`);
    if (bias) params.set("bias", bias);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    let response: Response;
    try {
      response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[locations/search] Geoapify error", response.status, detail.slice(0, 300));
      return NextResponse.json({ error: { code: "provider_error", message: "Location suggestions are temporarily unavailable" } }, { status: 502 });
    }

    const payload = (await response.json()) as { results?: GeoapifyResult[] };
    const suggestions = (payload.results || []).map(normalize).filter((item) => item.formatted);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, suggestions });

    if (cache.size > 250) {
      const now = Date.now();
      for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
      while (cache.size > 250) cache.delete(cache.keys().next().value as string);
    }

    return NextResponse.json({ data: { configured: true, provider: "geoapify", suggestions } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Location search failed";
    const status = /token|unauthor/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: { code: status === 401 ? "unauthorized" : "location_search_failed", message } }, { status });
  }
}
