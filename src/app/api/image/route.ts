import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";

const isVercel = process.env.VERCEL === "1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    if (isVercel) {
      const result = await get(key, { access: "private" });
      if (!result) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      // Stream the blob content through
      return new NextResponse(result.stream, {
        headers: {
          "Content-Type": result.blob.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } else {
      const filePath = path.join(process.cwd(), "data", key);
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath).slice(1);
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      return new NextResponse(data, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/image error:", message);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
