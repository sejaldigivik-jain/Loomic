/**
 * POST /api/v1/upload
 *
 * Upload a social media attachment. Static images are normalized to JPEG so
 * they can be reused by Instagram's publishing API as well as other adapters.
 * Videos are kept as MP4. Files are persisted under /public/uploads in the
 * included single-server deployment and should move to object storage when
 * scaling horizontally.
 */
import { NextResponse } from "next/server";
import { writeFile, mkdir, open, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { requireUser } from "@/lib/server-auth";
import { ApiError } from "@/lib/api-utils";

export const runtime = "nodejs";

const MAX_IMAGE_UPLOAD_MB = Math.max(1, Number(process.env.MAX_IMAGE_UPLOAD_MB ?? process.env.MAX_UPLOAD_MB ?? "25") || 25);
const MAX_VIDEO_UPLOAD_MB = Math.min(1024, Math.max(1, Number(process.env.MAX_VIDEO_UPLOAD_MB ?? "1024") || 1024));
const MAX_IMAGE_SIZE = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
const MAX_VIDEO_SIZE = MAX_VIDEO_UPLOAD_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
];

export async function POST(req: Request) {
  let streamedVideoPath: string | null = null;
  try {
    requireUser(req);

    const requestType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

    // Large Reel/video uploads use a raw request body so we can stream the file
    // directly to disk instead of creating another in-memory Buffer. This keeps
    // local development practical for large MP4/MOV files.
    if (ALLOWED_VIDEO_TYPES.includes(requestType)) {
      const declaredSize = Number(req.headers.get("x-file-size") ?? req.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredSize) && declaredSize > MAX_VIDEO_SIZE) {
        return NextResponse.json(
          { error: { code: "bad_request", message: `Video too large (max ${MAX_VIDEO_UPLOAD_MB} MB / 1 GB)` } },
          { status: 400 }
        );
      }
      if (!req.body) {
        return NextResponse.json(
          { error: { code: "bad_request", message: "No video data provided" } },
          { status: 400 }
        );
      }

      const extension = requestType === "video/quicktime" ? ".mov" : ".mp4";
      const safeName = `${crypto.randomUUID()}${extension}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      const destination = path.join(uploadDir, safeName);
      streamedVideoPath = destination;

      const handle = await open(destination, "w");
      let written = 0;
      try {
        const reader = req.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          written += value.byteLength;
          if (written > MAX_VIDEO_SIZE) {
            throw new ApiError("bad_request", `Video too large (max ${MAX_VIDEO_UPLOAD_MB} MB / 1 GB)`, 400);
          }
          await handle.write(value);
        }
      } finally {
        await handle.close();
      }

      streamedVideoPath = null;
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
      const url = `${baseUrl}/uploads/${safeName}`;
      const originalName = decodeURIComponent(req.headers.get("x-file-name") ?? safeName);

      return NextResponse.json(
        {
          data: {
            url,
            filename: safeName,
            originalName,
            size: written,
            type: requestType,
            normalized: false,
          },
          meta: { maxVideoUploadMb: MAX_VIDEO_UPLOAD_MB },
        },
        { status: 201 }
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
            message: "Unsupported media. Upload JPG, PNG, WebP, MP4 or MOV.",
          },
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `Image too large (max ${MAX_IMAGE_UPLOAD_MB} MB)` } },
        { status: 400 }
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    const buffer = await sharp(input).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    const safeName = `${crypto.randomUUID()}.jpg`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, safeName), buffer);

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
    const url = `${baseUrl}/uploads/${safeName}`;

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
    if (streamedVideoPath) {
      await unlink(streamedVideoPath).catch(() => undefined);
    }
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    console.error("[upload] error:", err);
    return NextResponse.json(
      { error: { code: "internal", message: "Upload failed" } },
      { status: 500 }
    );
  }
}
