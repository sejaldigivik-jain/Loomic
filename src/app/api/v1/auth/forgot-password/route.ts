import { z } from "zod";
import { db } from "@/lib/db";
import { ok, withHandler } from "@/lib/api-utils";
import { signPasswordResetToken } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().toLowerCase(),
});

export const POST = withHandler(schema, async ({ req, body }) => {
  const email = body!.email;
  assertRateLimit(req, { namespace: "auth-forgot", limit: 5, windowMs: 15 * 60_000, discriminator: email });
  const user = await db.user.findUnique({ where: { email } });

  let developmentResetUrl: string | undefined;
  if (user?.passwordHash && !user.deletedAt) {
    const token = signPasswordResetToken({
      userId: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
    });
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
    const resetUrl = `${appUrl}/?reset=${encodeURIComponent(token)}`;
    const sent = await sendTransactionalEmail({
      to: user.email,
      subject: "Reset your Loomic password",
      html: `<p>We received a request to reset your Loomic password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
    });
    if (!sent && process.env.NODE_ENV !== "production") developmentResetUrl = resetUrl;
  }

  // Always return the same response so this endpoint cannot be used to
  // enumerate registered email addresses.
  return ok({
    accepted: true,
    ...(developmentResetUrl ? { developmentResetUrl } : {}),
  });
});
