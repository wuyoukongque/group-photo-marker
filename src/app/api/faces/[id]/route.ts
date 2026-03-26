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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entries = await readJSON<FaceEntry[]>("face-library", []);
  const entry = entries.find((e) => e.id === id);
  if (!entry) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  return NextResponse.json(entry);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const entries = await readJSON<FaceEntry[]>("face-library", []);
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  entries[index] = {
    ...entries[index],
    name: body.name ?? entries[index].name,
    bio: body.bio ?? entries[index].bio,
    avatarDataUrl: body.avatarDataUrl ?? entries[index].avatarDataUrl,
    descriptor: body.descriptor ?? entries[index].descriptor,
    updatedAt: new Date().toISOString(),
  };

  await writeJSON("face-library", entries);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entries = await readJSON<FaceEntry[]>("face-library", []);
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  await writeJSON("face-library", filtered);
  return NextResponse.json({ success: true });
}
