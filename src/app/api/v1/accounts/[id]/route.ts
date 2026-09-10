/**
 * PATCH /api/v1/accounts/:id — update follower count, status, etc.
 * DELETE /api/v1/accounts/:id — disconnect (hard delete)
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { requireAccountAccess } from "@/lib/server-auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  followers: z.number().int().min(0).optional(),
  status: z.enum(["connected", "expired", "error"]).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  tokenExpiresAt: z.string().nullable().optional(),
});

export const PATCH = withHandler(patchSchema, async ({ req, ctx, body }) => {
  const id = String(ctx.params.id);
  await requireAccountAccess(req, id, "account.connect");
  const existing = await db.socialAccount.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Account not found");

  const patch = body!;
  const data: Record<string, unknown> = {};
  if (patch.followers !== undefined) data.followers = patch.followers;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl;
  if (patch.tokenExpiresAt !== undefined) {
    data.tokenExpiresAt = patch.tokenExpiresAt ? new Date(patch.tokenExpiresAt) : null;
  }

  const updated = await db.socialAccount.update({ where: { id }, data });
  return ok({
    id: updated.id,
    platform: updated.platform,
    handle: updated.handle,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
    avatarGradient: updated.avatarGradient,
    followers: updated.followers,
    status: updated.status,
    tokenExpiresAt: updated.tokenExpiresAt ?? undefined,
    isReal: updated.accessToken !== "demo-token",
    externalUserId: updated.externalUserId ?? undefined,
    connectedAt: updated.connectedAt,
    clientId: updated.id,
    clientName: updated.displayName || updated.handle,
  });
});

export const DELETE = withHandler(null, async ({ req, ctx }) => {
  const id = String(ctx.params.id);
  await requireAccountAccess(req, id, "account.disconnect");
  const existing = await db.socialAccount.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Account not found");

  await db.socialAccount.delete({ where: { id } });
  return ok({ id, status: "disconnected" });
});
