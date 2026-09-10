import { withHandler, ok } from "@/lib/api-utils";
import { requirePostAccess } from "@/lib/server-auth";
import { publishPostById } from "@/lib/publish-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withHandler(null, async ({ req, ctx }) => {
  const id = String(ctx.params.id);
  await requirePostAccess(req, id, "post.publish");
  const result = await publishPostById(id);
  return ok(result);
});
