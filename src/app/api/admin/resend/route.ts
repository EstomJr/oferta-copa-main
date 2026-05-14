import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { put } from "@vercel/blob";
import { PDFDocument, rgb } from "pdf-lib";

const STICKER_W_CM = 6;
const STICKER_H_CM = 9;
const A4_W_CM = 21;
const A4_H_CM = 29.7;
const CM_TO_PT = 28.3465;
const STICKER_W = STICKER_W_CM * CM_TO_PT;
const STICKER_H = STICKER_H_CM * CM_TO_PT;
const A4_W = A4_W_CM * CM_TO_PT;
const A4_H = A4_H_CM * CM_TO_PT;
const COLS = 3;
const ROWS = 3;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { pedidoId, email } = await req.json();
  if (!pedidoId || !email) {
    return NextResponse.json({ error: "pedidoId e email obrigatórios" }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`SELECT nome, sticker_url, sticker_id, pdf_url FROM pedidos WHERE id = ${pedidoId}`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const pedido = rows[0];
  if (!pedido.sticker_url) {
    return NextResponse.json({ error: "Figurinha não encontrada" }, { status: 404 });
  }

  const customerName = (pedido.nome || "cliente").replace(/[<>"'&]/g, "");
  let pdfUrl = pedido.pdf_url;

  // Se não tem PDF, gerar
  if (!pdfUrl) {
    const stickerRes = await fetch(pedido.sticker_url);
    const stickerBytes = new Uint8Array(await stickerRes.arrayBuffer());

    const pdf = await PDFDocument.create();
    let stickerImage;
    try { stickerImage = await pdf.embedPng(stickerBytes); } catch { stickerImage = await pdf.embedJpg(stickerBytes); }
    const page = pdf.addPage([A4_W, A4_H]);
    const gridW = COLS * STICKER_W;
    const gridH = ROWS * STICKER_H;
    const marginX = (A4_W - gridW) / 2;
    const marginY = (A4_H - gridH) / 2;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        page.drawImage(stickerImage, {
          x: marginX + col * STICKER_W,
          y: A4_H - marginY - (row + 1) * STICKER_H,
          width: STICKER_W,
          height: STICKER_H,
        });
      }
    }

    const gray = rgb(0.5, 0.5, 0.5);
    const MARK = 10;
    for (let row = 0; row <= ROWS; row++) {
      const y = A4_H - marginY - row * STICKER_H;
      page.drawLine({ start: { x: marginX - MARK, y }, end: { x: marginX, y }, thickness: 0.5, color: gray });
      page.drawLine({ start: { x: marginX + gridW, y }, end: { x: marginX + gridW + MARK, y }, thickness: 0.5, color: gray });
    }
    for (let col = 0; col <= COLS; col++) {
      const x = marginX + col * STICKER_W;
      page.drawLine({ start: { x, y: A4_H - marginY }, end: { x, y: A4_H - marginY + MARK }, thickness: 0.5, color: gray });
      page.drawLine({ start: { x, y: A4_H - marginY - gridH - MARK }, end: { x, y: A4_H - marginY - gridH }, thickness: 0.5, color: gray });
    }

    const pdfBytes = await pdf.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const pdfBlob = await put(`pdfs/${pedido.sticker_id}.pdf`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      allowOverwrite: true,
    });
    pdfUrl = pdfBlob.url;

    await sql`UPDATE pedidos SET pdf_url = ${pdfUrl} WHERE id = ${pedidoId}`;
  }

  // Baixar PDF e figurinha pra anexar
  const pdfRes = await fetch(pdfUrl);
  const pdfBuffer2 = Buffer.from(await pdfRes.arrayBuffer());
  const stickerRes2 = await fetch(pedido.sticker_url);
  const stickerBuf2 = Buffer.from(await stickerRes2.arrayBuffer());
  const fileNameBase = customerName.toLowerCase().replace(/\s+/g, "-");
  const dlLink = `https://minha-figurinha-copa2026.vercel.app/api/download?url=${encodeURIComponent(pdfUrl)}&name=figurinha-copa-2026`;

  // Enviar via Gmail SMTP
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `Figurinha Copa 2026 <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Sua Figurinha da Copa 2026 esta pronta! ⚽",
    html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1E3A8A;text-align:center">GOOLL! ⚽</h1><p style="font-size:18px;text-align:center">Ola <b>${customerName}</b>!</p><p style="font-size:16px;text-align:center">Sua figurinha personalizada da Copa do Mundo 2026 esta pronta!</p><div style="text-align:center;margin:20px 0"><a href="${dlLink}" style="display:inline-block;background:#009739;color:white;font-weight:bold;font-size:18px;padding:16px 40px;border-radius:12px;text-decoration:none">BAIXAR FIGURINHA (PDF)</a></div><p style="font-size:14px;color:#666;text-align:center">Em anexo voce encontra a figurinha avulsa (PNG) e o PDF para impressao.</p><hr style="border:1px solid #FFD700;margin:20px 0"/><p style="font-size:16px;text-align:center">Conhece alguem que ia amar ter uma figurinha personalizada?</p><div style="text-align:center;margin:12px 0"><a href="https://minha-figurinha-copa2026.vercel.app/" style="display:inline-block;background:#1E3A8A;color:white;font-weight:bold;padding:14px 32px;border-radius:12px;text-decoration:none">CRIAR NOVA FIGURINHA</a></div></div>`,
    attachments: [
      { filename: `figurinha-${fileNameBase}.png`, content: stickerBuf2 },
      { filename: `figurinhas-impressao-${fileNameBase}.pdf`, content: pdfBuffer2 },
    ],
  });

  // Atualizar status
  await sql`UPDATE pedidos SET email = ${email}, status = 'entregue', delivered_at = NOW() WHERE id = ${pedidoId}`;

  return NextResponse.json({ ok: true, message: `Enviado para ${email}` });
}
