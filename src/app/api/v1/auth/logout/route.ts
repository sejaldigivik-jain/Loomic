import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok } from "@/lib/api-utils";
import { verifyToken, type RefreshTokenPayload } from "@/lib/auth";
import { clearRefreshCookie, readRequestCookie, REFRESH_COOKIE } from "@/lib/auth-cookie";

const schema = z.object({ refreshToken: z.string().optional() });
export const runtime = "nodejs";

export const POST = withHandler(schema, async ({ req, body }) => {
  const token = readRequestCookie(req, REFRESH_COOKIE) ?? body?.refreshToken;
  if (token) {
    const payload = verifyToken<RefreshTokenPayload>(token);
    if (payload?.type === "refresh") {
      await db.session.updateMany({
        where: { userId: payload.sub, sessionToken: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  return clearRefreshCookie(ok({ signedOut: true }));
});
