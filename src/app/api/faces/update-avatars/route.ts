import { NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/storage";

interface FaceEntry {
  id: string;
  name: string;
  bio: string;
  avatarDataUrl: string;
  descriptor: number[];
  createdAt: string;
  updatedAt: string;
}

// POST: Update avatars for library entries that are missing them
export async function POST(request: Request) {
  const { avatars } = await request.json();
  // avatars: { [libraryEntryId]: avatarDataUrl }

  if (!avatars || typeof avatars !== "object") {
    return NextResponse.json({ error: "avatars object required" }, { status: 400 });
  }

  const entries = await readJSON<FaceEntry[]>("face-library", []);
  let updated = 0;

  for (const entry of entries) {
    if (avatars[entry.id] && (!entry.avatarDataUrl || entry.avatarDataUrl.length < 10)) {
      entry.avatarDataUrl = avatars[entry.id];
      entry.updatedAt = new Date().toISOString();
      updated++;
    }
  }

  if (updated > 0) {
    await writeJSON("face-library", entries);
  }

  return NextResponse.json({ updated });
}
