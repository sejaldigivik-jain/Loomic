import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireAccountAccess } from "@/lib/server-auth";
import { decryptSecret } from "@/lib/secrets";
import { instagramConnectionMethod } from "@/lib/instagram-connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_VERSION = process.env.META_GRAPH_API_VERSION ?? "v26.0";

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId")?.trim();
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!accountId) throw ApiError.badRequest("accountId is required");
  if (q.length < 2) return ok({ configured: true, native: true, suggestions: [] });

  await requireAccountAccess(req, accountId);
  const account = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== "instagram") throw ApiError.notFound("Instagram account not found");
  if (instagramConnectionMethod(account.providerData) !== "facebook_login") {
    return ok({ configured: false, native: false, reason: "facebook_login_required", suggestions: [] });
  }

  const token = decryptSecret(account.accessToken);
  const params = new URLSearchParams({
    q,
    fields: "id,name,location,link",
    access_token: token,
  });

  const response = await fetch(`https://graph.facebook.com/${META_VERSION}/pages/search?${params.toString()}`, {
    cache: "no-store",
  });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }

  if (!response.ok) {
    // Pages Search can require additional Meta App Review/Business Verification.
    // Return a soft failure so Composer can fall back to Geoapify text location.
    return ok({
      configured: false,
      native: true,
      reason: "meta_pages_search_unavailable",
      message: body?.error?.message ?? "Meta native location search is not available for this app yet.",
      suggestions: [],
    });
  }

  const suggestions = (Array.isArray(body?.data) ? body.data : [])
    .filter((item: any) => item?.id && item?.name && item?.location?.latitude != null && item?.location?.longitude != null)
    .slice(0, 12)
    .map((item: any) => {
      const location = item.location ?? {};
      const parts = [location.street, location.city, location.state, location.country].filter(Boolean);
      return {
        id: String(item.id),
        nativeId: String(item.id),
        source: "meta",
        name: String(item.name),
        formatted: parts.length ? `${item.name} · ${parts.join(", ")}` : String(item.name),
        city: location.city,
        state: location.state,
        country: location.country,
        lat: Number(location.latitude),
        lon: Number(location.longitude),
        resultType: "meta_place",
      };
    });

  return ok({ configured: true, native: true, suggestions });
});
