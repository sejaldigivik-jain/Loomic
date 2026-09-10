/**
 * POST /api/v1/upload/sign
 *
 * Issue a short-lived signed upload URL so the browser can send a video
 * directly to Supabase Storage. Vercel caps serverless request bodies at
 * 4.5 MB, so large Reels can never pass through our own API routes — the file
 * goes browser → Supabase, and only the resulting public URL comes back to us.
 *
 * Request:  { filename: string, contentType: string, size: number }
 * Response: { data: { signedUrl, token, path, publicUrl, filename } }
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/server-auth";
import { ApiError } from "@/lib/api-utils";
import {
  MAX_VIDEO_SIZE,
  MAX_VIDEO_UPLOAD_MB,
  buildObjectPath,
  createSignedUpload,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export async function POST(req: Request) {
  try {
    const auth = requireUser(req);

    const body = (await req.json().catch(() => null)) as {
      filename?: string;
      contentType?: string;
      size?: number;
    } | null;

    if (!body) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "Invalid request body" } },
        { status: 400 }
      );
    }

    const contentType = (body.contentType ?? "").toLowerCase();
    if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "Unsupported video type. Use MP4 or MOV." } },
        { status: 400 }
      );
    }

    const size = Number(body.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "A valid file size is required" } },
        { status: 400 }
      );
    }

    // Supabase enforces its own per-plan ceiling as well; checking here gives
    // the user a clear message before they wait through a long upload.
    if (size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        {
          error: {
            code: "bad_request",
            message: `Video too large (max ${MAX_VIDEO_UPLOAD_MB} MB on the current Supabase plan)`,
          },
        },
        { status: 400 }
      );
    }

    const extension = contentType === "video/quicktime" ? ".mov" : ".mp4";
    const safeName = `${crypto.randomUUID()}${extension}`;
    const objectPath = buildObjectPath(auth.workspaceId ?? null, safeName);

    const signed = await createSignedUpload(objectPath);

    return NextResponse.json(
      {
        data: {
          signedUrl: signed.signedUrl,
          token: signed.token,
          path: signed.path,
          publicUrl: signed.publicUrl,
          filename: safeName,
          contentType,
        },
        meta: { maxVideoUploadMb: MAX_VIDEO_UPLOAD_MB },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error("[upload/sign] error:", err);
    return NextResponse.json(
      {
        error: {
          code: "internal",
          message: err instanceof Error ? err.message : "Could not create upload URL",
        },
      },
      { status: 500 }
    );
  }
}
