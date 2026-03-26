import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeJSON } from "@/lib/storage";

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
