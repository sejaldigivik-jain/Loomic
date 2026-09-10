import { z } from "zod";
import { withHandler, ok } from "@/lib/api-utils";
import { requireWorkspace } from "@/lib/server-auth";
import { revokeAccountConnectionGrant } from "@/lib/account-connection-lock";

export const runtime = "nodejs";

const schema = z.object({
  workspaceId: z.string().min(1),
  grant: z.string().min(1).max(256),
});

export const POST = withHandler(schema, async ({ req, body }) => {
  const { workspaceId, grant } = body!;
  const auth = await requireWorkspace(req, workspaceId);
  await revokeAccountConnectionGrant(workspaceId, auth.userId, grant);
  return ok({ locked: true });
});
