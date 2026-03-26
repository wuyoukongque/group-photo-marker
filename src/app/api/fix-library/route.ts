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

interface ProjectData {
  id: string;
  editToken: string;
  title: string;
  imageDataUrl: string;
  persons: Array<{
    id: string;
    name: string;
    bio: string;
    x: number;
    y: number;
    radius: number;
    descriptor?: number[];
    libraryEntryId?: string;
  }>;
  showNames: boolean;
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

// POST: Fix library - clear wrong libraryEntryIds and re-save missing persons
export async function POST(request: Request) {
  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await readJSON<ProjectData | null>(`projects/${projectId}`, null);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const library = await readJSON<FaceEntry[]>("face-library", []);
  const libraryIds = new Set(library.map((e) => e.id));

  // Step 1: Clear libraryEntryId that point to non-existent entries
  // Step 2: For each named person with descriptor, check if they truly match a library entry
  let cleared = 0;
  let added = 0;
  const updatedPersons = project.persons.map((p) => {
    if (!p.name || !p.descriptor || p.descriptor.length !== 128) return p;

    // Check if current libraryEntryId is valid
    if (p.libraryEntryId) {
      const entry = library.find((e) => e.id === p.libraryEntryId);
      if (!entry) {
        // Entry doesn't exist, clear
        cleared++;
        return { ...p, libraryEntryId: undefined };
      }
      // Check if the entry name matches (allowing for same person)
      if (entry.name !== p.name) {
        // Mismatched name - wrong association
        cleared++;
        return { ...p, libraryEntryId: undefined };
      }
    }
    return p;
  });

  // Step 3: For persons without libraryEntryId, try to find or create library entries
  const finalPersons = [];
  for (const p of updatedPersons) {
    if (!p.name || !p.descriptor || p.descriptor.length !== 128 || p.libraryEntryId) {
      finalPersons.push(p);
      continue;
    }

    // Check if already exists in library by name
    const existingByName = library.find((e) => e.name === p.name);
    if (existingByName) {
      finalPersons.push({ ...p, libraryEntryId: existingByName.id });
      continue;
    }

    // Check if similar face exists (threshold 0.35)
    let found = false;
    for (const entry of library) {
      if (entry.descriptor?.length === 128) {
        const dist = euclideanDistance(p.descriptor, entry.descriptor);
        if (dist < 0.35) {
          finalPersons.push({ ...p, libraryEntryId: entry.id });
          found = true;
          break;
        }
      }
    }
    if (found) continue;

    // Create new library entry
    const newId = crypto.randomUUID().slice(0, 12);
    const newEntry: FaceEntry = {
      id: newId,
      name: p.name,
      bio: p.bio || "",
      avatarDataUrl: "",  // Will need to be updated manually
      descriptor: p.descriptor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    library.push(newEntry);
    added++;
    finalPersons.push({ ...p, libraryEntryId: newId });
  }

  // Save updated data
  project.persons = finalPersons;
  project.updatedAt = new Date().toISOString();
  await writeJSON(`projects/${projectId}`, project);
  await writeJSON("face-library", library);

  return NextResponse.json({
    cleared,
    added,
    totalLibrary: library.length,
    totalNamed: finalPersons.filter((p) => p.name).length,
  });
}
