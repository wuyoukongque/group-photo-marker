import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

const DUPLICATE_THRESHOLD = 0.5;

export async function GET() {
  const entries = await readJSON<FaceEntry[]>("face-library", []);
  const list = entries.map(({ descriptor: _, ...rest }) => rest);
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const body = await request.json();
  const entries = await readJSON<FaceEntry[]>("face-library", []);
  const newDescriptor: number[] = body.descriptor || [];

  // Check for duplicate
  if (newDescriptor.length === 128) {
    for (let i = 0; i < entries.length; i++) {
      const existing = entries[i];
      if (existing.descriptor?.length === 128) {
        const dist = euclideanDistance(newDescriptor, existing.descriptor);
        if (dist < DUPLICATE_THRESHOLD) {
          entries[i] = {
            ...existing,
            name: body.name || existing.name,
            bio: body.bio || existing.bio,
            avatarDataUrl: body.avatarDataUrl || existing.avatarDataUrl,
            descriptor: newDescriptor,
            updatedAt: new Date().toISOString(),
          };
          await writeJSON("face-library", entries);
          return NextResponse.json({ id: existing.id, updated: true });
        }
      }
    }
  }

  const entry: FaceEntry = {
    id: randomUUID().slice(0, 12),
    name: body.name || "",
    bio: body.bio || "",
    avatarDataUrl: body.avatarDataUrl || "",
    descriptor: newDescriptor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  entries.push(entry);
  await writeJSON("face-library", entries);

  return NextResponse.json({ id: entry.id, updated: false });
}
