import { NextResponse } from "next/server";
import { readJSON } from "@/lib/storage";

interface FaceEntry {
  id: string;
  name: string;
  bio: string;
  descriptor: number[];
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export async function POST(request: Request) {
  const body = await request.json();
  const descriptors: number[][] = body.descriptors || [];

  const library = await readJSON<FaceEntry[]>("face-library", []);

  if (library.length === 0) {
    return NextResponse.json({ matches: descriptors.map(() => null) });
  }

  // Tighter threshold to avoid false matches
  const MATCH_THRESHOLD = 0.4;

  const matches = descriptors.map((desc) => {
    if (!desc || desc.length !== 128) return null;

    let bestMatch = null;
    let bestDistance = Infinity;

    for (const entry of library) {
      if (!entry.descriptor || entry.descriptor.length !== 128) continue;
      const dist = euclideanDistance(desc, entry.descriptor);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = entry;
      }
    }

    if (bestMatch && bestDistance < MATCH_THRESHOLD) {
      return {
        libraryEntryId: bestMatch.id,
        name: bestMatch.name,
        bio: bestMatch.bio,
        distance: Math.round(bestDistance * 1000) / 1000,
      };
    }
    return null;
  });

  return NextResponse.json({ matches });
}
