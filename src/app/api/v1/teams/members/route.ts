/**
 * GET  /api/v1/teams/members?workspaceId=...
 * POST /api/v1/teams/members — invite a new member
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError, parsePagination, paginateMeta } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { sendTransactionalEmail } from "@/lib/email";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) throw ApiError.badRequest("workspaceId is required");
  const auth = await requireWorkspace(req, workspaceId);
  const canSeeTeam = auth.role === "owner" || auth.role === "admin";
  const memberWhere = canSeeTeam ? { workspaceId } : { workspaceId, userId: auth.userId };
  const { page, pageSize } = parsePagination(url.searchParams);

  const [total, memberships, invitations] = await Promise.all([
    db.membership.count({ where: memberWhere }),
    db.membership.findMany({
      where: memberWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            accountAssignments: {
              where: { socialAccount: { workspaceId } },
              select: {
                socialAccount: {
                  select: {
                    id: true,
                    platform: true,
                    handle: true,
                    displayName: true,
                    status: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    canSeeTeam
      ? db.invitation.findMany({
          where: { workspaceId, status: "pending" },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return ok(
    {
      members: memberships.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt,
        isActive: m.isActive,
        assignedAccounts: m.user.accountAssignments.map((row) => row.socialAccount),
      })),
      pendingInvitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    },
    paginateMeta(total, { page, pageSize })
  );
});

const inviteSchema = z.object({
  workspaceId: z.string(),
  email: z.string().email().toLowerCase(),
  role: z.enum(["admin", "editor", "contributor", "viewer"]).default("editor"),
});

export const POST = withHandler(inviteSchema, async ({ req, body }) => {
  const { workspaceId, email, role } = body!;
  const auth = await requireWorkspace(req, workspaceId, "team.invite");
  const invitedById = auth.userId;

  const existing = await db.invitation.findFirst({
    where: { workspaceId, email, status: "pending" },
  });
  if (existing) throw ApiError.conflict("An invitation is already pending for this email");

  const existingMembership = await db.membership.findFirst({
    where: { workspaceId, user: { email } },
  });
  if (existingMembership) throw ApiError.conflict("This user is already a member of the workspace");

  const invitation = await db.invitation.create({
    data: {
      workspaceId,
      email,
      role,
      invitedById,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const inviteUrl = `${origin.replace(/\/$/, "")}/?invite=${encodeURIComponent(invitation.token)}`;
  const emailSent = await sendTransactionalEmail({
    to: email,
    subject: `You're invited to join a Loomic workspace`,
    html: `<p>You have been invited to collaborate in Loomic as <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
  });
  return ok({ invitation, member: null, inviteUrl, emailSent }, {}, 201);
});
