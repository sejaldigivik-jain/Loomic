/**
 * PATCH /api/v1/auth/me/profile
 *
 * Update the authenticated user's profile: name, email, bio, image, theme,
 * and notification preferences. All fields are optional — only provided
 * fields are updated.
 *
 * Body: {
 *   name?: string,
 *   email?: string,
 *   bio?: string,                    // stored in preferences JSON
 *   image?: string,                  // base64 data URL or null to remove
 *   theme?: "dark" | "light",
 *   notifications?: {                // merged into preferences JSON
 *     postPublished?: boolean,
 *     postFailed?: boolean,
 *     comments?: boolean,
 *     teamActivity?: boolean,
 *     weeklyDigest?: boolean,
 *     productUpdates?: boolean,
 *   }
 * }
 *
 * Requires: Authorization: Bearer <accessToken>
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { getBearerToken, verifyToken, type AccessTokenPayload } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().toLowerCase().optional(),
  bio: z.string().max(500).optional(),
  image: z.string().nullable().optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  notifications: z.object({
    postPublished: z.boolean().optional(),
    postFailed: z.boolean().optional(),
    comments: z.boolean().optional(),
    teamActivity: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    productUpdates: z.boolean().optional(),
  }).optional(),
});

export const PATCH = withHandler(schema, async ({ req, body }) => {
  // 1. Verify auth token
  const token = getBearerToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");
  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  // 2. Load current user
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.notFound("User not found");

  // 3. Check email uniqueness if email is being changed
  if (body!.email && body!.email !== user.email) {
    const existing = await db.user.findUnique({ where: { email: body!.email } });
    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }
  }

  // 4. Parse existing preferences (JSON) and merge updates
  const currentPrefs = user.preferences ? JSON.parse(user.preferences) : {};
  const newPrefs = { ...currentPrefs };
  if (body!.bio !== undefined) newPrefs.bio = body!.bio;
  if (body!.notifications) {
    newPrefs.notifications = { ...(currentPrefs.notifications ?? {}), ...body!.notifications };
  }

  // 5. Build the update payload (only provided fields)
  const updateData: Record<string, unknown> = {};
  if (body!.name !== undefined) updateData.name = body!.name;
  if (body!.email !== undefined) updateData.email = body!.email;
  if (body!.image !== undefined) updateData.image = body!.image;
  if (body!.theme !== undefined) updateData.theme = body!.theme;
  if (body!.bio !== undefined || body!.notifications) {
    updateData.preferences = JSON.stringify(newPrefs);
  }

  // 6. Apply the update
  const updated = await db.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      theme: true,
      preferences: true,
    },
  });

  // 7. Return the updated profile (parsed preferences)
  const prefs = updated.preferences ? JSON.parse(updated.preferences) : {};
  return ok({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    image: updated.image,
    theme: updated.theme,
    bio: prefs.bio ?? "",
    notifications: prefs.notifications ?? {
      postPublished: true,
      postFailed: true,
      comments: true,
      teamActivity: false,
      weeklyDigest: true,
      productUpdates: false,
    },
  });
});
