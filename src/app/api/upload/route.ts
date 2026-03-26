import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const isVercel = process.env.VERCEL === "1";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${randomUUID().slice(0, 12)}.${ext}`;
    const imageKey = `images/${filename}`;

    if (isVercel) {
      await put(imageKey, file, {
        access: "private",
        contentType: file.type,
        addRandomSuffix: false,
      });
    } else {
      const dataDir = path.join(process.cwd(), "data", "images");
      await fs.mkdir(dataDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(dataDir, filename), buffer);
    }

    // Return proxy URL that works for both local and production
    return NextResponse.json({ imageUrl: `/api/image?key=${encodeURIComponent(imageKey)}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
