import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type Body = {
  key?: string;
  filename?: string;
  dataUrl?: string;
};

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9-_.]/gi, "_");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { key = "chart", filename = "upload.png", dataUrl } = body;

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ ok: false, error: "Missing dataUrl" }, { status: 400 });
    }

    const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Invalid data URL" }, { status: 400 });
    }

    const mime = match[1] ?? "image/png";
    const b64 = match[2] ?? "";
    const ext = (mime.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");

    const safeName = safeFilename(filename.replace(/\s+/g, "_"));
    const outName = `${safeFilename(key)}-${Date.now()}-${safeName}.${ext}`;

    const publicDir = path.join(process.cwd(), "public", "admin-charts");
    try {
      await fs.promises.mkdir(publicDir, { recursive: true });
    } catch (e) {
      // continue
    }

    const outPath = path.join(publicDir, outName);
  const buffer = Buffer.from(b64 as string, "base64");
    await fs.promises.writeFile(outPath, buffer);

    const url = `/admin-charts/${outName}`;
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("upload-chart error", err);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}

export const GET = async () => {
  // simple listing to help debugging: return list of files
  try {
    const publicDir = path.join(process.cwd(), "public", "admin-charts");
    const files = await fs.promises.readdir(publicDir).catch(() => []);
    const urls = files.map((f) => `/admin-charts/${f}`);
    return NextResponse.json({ ok: true, urls });
  } catch (err) {
    return NextResponse.json({ ok: true, urls: [] });
  }
};
