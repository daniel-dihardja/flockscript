import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const PATCHES_ROOT = path.resolve(process.cwd(), "../../packages/audio/patches");

function sanitizeFilePath(file: string) {
  const cleaned = file.replace(/^\.\//, "");
  const normalized = path.normalize(cleaned);
  return normalized;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const file = url.searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
  }

  const relative = sanitizeFilePath(file);
  const resolved = path.join(PATCHES_ROOT, relative);

  if (!resolved.startsWith(PATCHES_ROOT)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(resolved, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Failed to load patch", resolved, error?.message || error);
    return NextResponse.json({ error: "Patch not found" }, { status: 404 });
  }
}
