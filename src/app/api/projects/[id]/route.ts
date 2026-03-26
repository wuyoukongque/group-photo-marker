import { NextResponse } from "next/server";
import { readJSON, writeJSON, deleteJSON } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await readJSON(`projects/${id}`, null);

  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  // Don't expose editToken in GET response
  const { editToken: _, ...publicData } = project as Record<string, unknown>;
  return NextResponse.json(publicData);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await readJSON(`projects/${id}`, null) as Record<string, unknown> | null;

    if (!existing) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const body = await request.json();
    const token = body.editToken;

    if (token !== existing.editToken) {
      return NextResponse.json({ error: "无编辑权限" }, { status: 403 });
    }

    const updated = {
      ...existing,
      title: body.title ?? existing.title,
      imageDataUrl: body.imageDataUrl ?? existing.imageDataUrl,
      persons: body.persons ?? existing.persons,
      showNames: body.showNames ?? existing.showNames,
      updatedAt: new Date().toISOString(),
    };

    await writeJSON(`projects/${id}`, updated);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("PUT /api/projects/[id] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const existing = await readJSON(`projects/${id}`, null) as Record<string, unknown> | null;
    if (!existing) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    if (token !== existing.editToken) {
      return NextResponse.json({ error: "无权限删除" }, { status: 403 });
    }

    await deleteJSON(`projects/${id}`);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("DELETE /api/projects/[id] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
