import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const fileUrl = req.nextUrl.searchParams.get("url");
  const fileName = req.nextUrl.searchParams.get("name") || "figurinha-copa-2026";

  if (!fileUrl) {
    return NextResponse.json({ error: "URL obrigatória" }, { status: 400 });
  }

  try {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const ext = contentType.includes("pdf") ? ".pdf" : contentType.includes("png") ? ".png" : contentType.includes("jpeg") ? ".jpg" : "";
    const fullName = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;

    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fullName}"`,
        "Content-Length": String(body.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao baixar arquivo" }, { status: 500 });
  }
}
