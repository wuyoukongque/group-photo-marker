import { put, list, del, get } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";

const isVercel = process.env.VERCEL === "1";
const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Read JSON data by key (e.g. "projects/abc123" or "face-library")
 */
export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  if (isVercel) {
    try {
      const result = await get(`${key}.json`, { access: "private" });
      if (!result || !result.stream) return fallback;
      const text = await streamToText(result.stream);
      return JSON.parse(text);
    } catch (err) {
      console.error(`readJSON(${key}) error:`, err);
      return fallback;
    }
  } else {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, `${key}.json`), "utf-8");
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
}

/**
 * Write JSON data by key
 */
export async function writeJSON(key: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data);

  if (isVercel) {
    await put(`${key}.json`, content, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } else {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, `${key}.json`);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content);
  }
}

/**
 * Delete JSON data by key
 */
export async function deleteJSON(key: string): Promise<void> {
  if (isVercel) {
    try {
      const { blobs } = await list({ prefix: `${key}.json` });
      for (const blob of blobs) {
        await del(blob.url);
      }
    } catch {}
  } else {
    try {
      await fs.unlink(path.join(DATA_DIR, `${key}.json`));
    } catch {}
  }
}
