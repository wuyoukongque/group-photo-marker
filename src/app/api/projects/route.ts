import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { readJSON, writeJSON } from "@/lib/storage";
import { list } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";

const isVercel = process.env.VERCEL === "1";

interface ProjectData {
  id: string;
  editToken: string;
  title: string;
  imageDataUrl: string;
  persons: Array<{ name?: string }>;
  showNames: boolean;
  createdAt: string;
  updatedAt: string;
}

// GET: List all projects (for admin)
export async function GET() {
  try {
    const projectIds: string[] = [];

    if (isVercel) {
      const result = await list({ prefix: "projects/" });
      for (const blob of result.blobs) {
        projectIds.push(blob.pathname.replace("projects/", "").replace(".json", ""));
      }
    } else {
      const dataDir = path.join(process.cwd(), "data", "projects");
      try {
        const files = await fs.readdir(dataDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            projectIds.push(file.replace(".json", ""));
          }
        }
      } catch {
        // directory doesn't exist
      }
    }

    const projects = [];
    for (const id of projectIds) {
      const data = await readJSON<ProjectData | null>(`projects/${id}`, null);
      if (data) {
        projects.push({
          id: data.id,
          title: data.title || "(未命名)",
          editToken: data.editToken,
          personsCount: (data.persons || []).length,
          namedCount: (data.persons || []).filter((p) => p.name).length,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    }

    projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(projects);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/projects error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Create new project
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = randomUUID().slice(0, 8);
    const editToken = randomUUID().slice(0, 16);

    const project = {
      id,
      editToken,
      title: body.title || "",
      imageDataUrl: body.imageDataUrl || "",
      persons: body.persons || [],
      showNames: body.showNames ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeJSON(`projects/${id}`, project);

    return NextResponse.json({ id, editToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/projects error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
