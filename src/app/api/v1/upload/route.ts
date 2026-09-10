/**
 * POST /api/v1/upload
 *
 * Upload an image attachment. Images are normalized to JPEG so they can be
 * reused by Instagram's publishing API as well as the other adapters, then
 * stored in Supabase Storage and served from a permanent public URL.
 *
 * Videos are NOT accepted here. Vercel caps serverless request bodies at
 * 4.5 MB, so a Reel can never be streamed through this route in production.
 * The browser requests a signed URL from POST /api/v1/upload/sign and uploads
 * the file straight to Supabase Storage instead.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import sharp from "sharp";
import { requireUser } from "@/lib/server-auth";
import { ApiError } from "@/lib/api-utils";
import {
  MAX_IMAGE_SIZE,
  MAX_IMAGE_UPLOAD_MB,
  buildObjectPath,
  uploadBuffer,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export async function POST(req: Request) {
  try {
    const auth = requireUser(req);

    const requestType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

    // Older clients streamed videos here as a raw body. Point them at the
    // signed-upload flow rather than failing with a confusing 413 from Vercel.
    if (ALLOWED_VIDEO_TYPES.includes(requestType)) {
      return NextResponse.json(
        {
          error: {
            code: "bad_request",
            message:
              "Videos must be uploaded directly to storage. Request an upload URL from /api/v1/upload/sign first.",
          },
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "No file provided" } },
        { status: 400 }
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: {
            code: "bad_request",
            message: "Unsupported media. Upload JPG, PNG or WebP images, or MP4/MOV video.",
          },
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          error: {
            code: "bad_request",
            message: `Image too large (max ${MAX_IMAGE_UPLOAD_MB} MB)`,
          },
        },
        { status: 400 }
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    // `.rotate()` with no argument applies the EXIF orientation, so photos
    // taken on a phone are not published sideways.
    const buffer = await sharp(input).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();

    const safeName = `${crypto.randomUUID()}.jpg`;
    const objectPath = buildObjectPath(auth.workspaceId ?? null, safeName);
    const url = await uploadBuffer(objectPath, buffer, "image/jpeg");

    return NextResponse.json(
      {
        data: {
          url,
          filename: safeName,
          originalName: file.name,
          size: buffer.length,
          type: "image/jpeg",
          normalized: file.type !== "image/jpeg",
        },
        meta: { maxImageUploadMb: MAX_IMAGE_UPLOAD_MB },
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
    console.error("[upload] error:", err);
    return NextResponse.json(
      {
        error: {
          code: "internal",
          message: err instanceof Error ? err.message : "Upload failed",
        },
      },
      { status: 500 }
    );
  }
}
