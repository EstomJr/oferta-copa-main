import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import { list, put } from "@vercel/blob";
import { Resend } from "resend";
import { getDb } from "@/lib/db";

export const maxDuration = 300;

// PDF A4 com figurinhas
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

async function generatePDF(stickerBytes: Uint8Array): Promise<Buffer> {
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
        width: STICKER_W, height: STICKER_H,
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

  return Buffer.from(await pdf.save());
}

export async function POST(req: NextRequest) {
  // Verificar token secreto
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const token = req.headers.get("x-webhook-secret") || new URL(req.url).searchParams.get("secret");
    if (token !== webhookSecret) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sql = getDb();

  console.log("Webhook Vega recebido:", payload.transaction_token, payload.status);

  // Só processa pagamentos aprovados
  if (payload.status !== "approved") {
    console.log(`Vega: status ${payload.status} ignorado.`);
    return NextResponse.json({ ok: true, message: "Status ignorado" });
  }

  const customerEmail = payload.customer?.email;
  const customerName = (payload.customer?.name || "").replace(/[<>"'&]/g, "");
  const customerPhone = payload.customer?.phone || null;
  const src = payload.checkout?.src || null;
  const products = payload.products || [];

  if (!customerEmail) {
    console.error("Vega: webhook sem email do cliente");
    return NextResponse.json({ error: "Email não encontrado" }, { status: 400 });
  }

  // Registrar itens na tabela pedido_items
  for (const product of products) {
    await sql`
      INSERT INTO pedido_items (order_id, email, nome, item_type, offer_hash, offer_name, product_name, price, status, created_at)
      VALUES (${payload.transaction_token}, ${customerEmail}, ${customerName}, 'product', ${product.code}, ${product.title}, ${product.title}, ${product.amount}, 'pago', NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }

  console.log(`Vega: ${products.length} produto(s) registrado(s) para ${customerEmail}`);

  // Identificar produtos por título/código
  for (const product of products) {
    const titleLower = (product.title || "").toLowerCase();
    const descLower = (product.description || "").toLowerCase();
    const productId = `${titleLower} ${descLower}`;

    // FIGURINHA PRINCIPAL
    if (productId.includes("figurinha") && !productId.includes("pacot") && !productId.includes("poster") && !productId.includes("album") && !productId.includes("todas")) {

      // Buscar figurinha pelo src ou último pendente do email
      let stickerUrl: string | null = null;
      let resolvedStickerId: string | null = src;

      if (src) {
        const blobList = await list({ prefix: `figurinhas/${src}` });
        if (blobList.blobs[0]) stickerUrl = blobList.blobs[0].url;
      }

      if (!stickerUrl) {
        const rows = await sql`
          SELECT sticker_id, sticker_url FROM pedidos
          WHERE (email = ${customerEmail} OR status = 'pendente') AND sticker_url IS NOT NULL
          ORDER BY created_at DESC LIMIT 1
        `;
        if (rows.length > 0) {
          stickerUrl = rows[0].sticker_url;
          resolvedStickerId = rows[0].sticker_id;
          console.log(`Vega fallback: usando pedido: ${resolvedStickerId}`);
        }
      }

      if (!stickerUrl) {
        console.error("Vega: figurinha não encontrada para", customerEmail);
        continue;
      }

      try {
        // Baixar imagem, gerar PDF
        const stickerRes = await fetch(stickerUrl);
        const stickerBytes = new Uint8Array(await stickerRes.arrayBuffer());
        const pdfBuffer = await generatePDF(stickerBytes);

        // Salvar PDF no Blob
        const pdfBlob = await put(`pdfs/${resolvedStickerId}.pdf`, pdfBuffer, {
          access: "public", contentType: "application/pdf", allowOverwrite: true,
        });

        // Atualizar banco
        const currentStatus = await sql`SELECT status FROM pedidos WHERE sticker_id = ${resolvedStickerId}`;
        const newStatus = currentStatus[0]?.status === "recuperacao" ? "recuperado" : "pago";

        await sql`
          UPDATE pedidos
          SET status = ${newStatus}, email = ${customerEmail}, telefone = ${customerPhone}, pdf_url = ${pdfBlob.url}, paid_at = NOW()
          WHERE sticker_id = ${resolvedStickerId}
        `;

        // Enviar email
        let emailEnviado = false;
        const fileNameBase = customerName.toLowerCase().replace(/\s+/g, "-");
        const dlLink = `https://minha-figurinha-copa2026.vercel.app/api/download?url=${encodeURIComponent(pdfBlob.url)}&name=figurinha-copa-2026`;

        // 1. Gmail SMTP
        try {
          const nodemailer = (await import("nodemailer")).default;
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await transporter.sendMail({
            from: `Figurinha Copa 2026 <${process.env.SMTP_USER}>`,
            to: customerEmail,
            subject: "Sua Figurinha da Copa 2026 esta pronta! ⚽",
            html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1E3A8A;text-align:center">GOOLL! ⚽</h1><p style="font-size:18px;text-align:center">Ola <b>${customerName}</b>!</p><p style="font-size:16px;text-align:center">Sua figurinha personalizada da Copa do Mundo 2026 esta pronta!</p><div style="text-align:center;margin:20px 0"><a href="${dlLink}" style="display:inline-block;background:#009739;color:white;font-weight:bold;font-size:18px;padding:16px 40px;border-radius:12px;text-decoration:none">BAIXAR FIGURINHA (PDF)</a></div><p style="font-size:14px;color:#666;text-align:center">Em anexo voce encontra a figurinha avulsa (PNG) e o PDF para impressao.</p><hr style="border:1px solid #FFD700;margin:20px 0"/><p style="font-size:16px;text-align:center">Conhece alguem que ia amar ter uma figurinha personalizada?</p><div style="text-align:center;margin:12px 0"><a href="https://minha-figurinha-copa2026.vercel.app/" style="display:inline-block;background:#1E3A8A;color:white;font-weight:bold;padding:14px 32px;border-radius:12px;text-decoration:none">CRIAR NOVA FIGURINHA</a></div></div>`,
            attachments: [
              { filename: `figurinha-${fileNameBase}.png`, content: Buffer.from(stickerBytes) },
              { filename: `figurinhas-impressao-${fileNameBase}.pdf`, content: pdfBuffer },
            ],
          });
          emailEnviado = true;
          console.log(`Vega: email enviado via Gmail SMTP para ${customerEmail}`);
        } catch (err) {
          console.error("Vega: Gmail SMTP falhou:", err instanceof Error ? err.message : err);
        }

        // 2. Fallback Resend
        if (!emailEnviado) {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: "Figurinha Copa 2026 <onboarding@resend.dev>",
              to: customerEmail,
              subject: "Sua Figurinha da Copa 2026 está pronta! ⚽",
              html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1E3A8A;text-align:center">GOOLL! ⚽</h1><p style="font-size:18px;text-align:center">Olá <b>${customerName}</b>!</p><p style="font-size:16px;text-align:center">Sua figurinha personalizada da Copa do Mundo 2026 está pronta!</p><p style="font-size:14px;color:#666;text-align:center">Em anexo você encontra a figurinha avulsa e o PDF para impressão.</p><hr style="border:1px solid #FFD700;margin:20px 0"/><p style="font-size:16px;text-align:center">Conhece alguém que ia amar ter uma figurinha?</p><div style="text-align:center;margin:12px 0"><a href="https://minha-figurinha-copa2026.vercel.app/" style="display:inline-block;background:#1E3A8A;color:white;font-weight:bold;padding:14px 32px;border-radius:12px;text-decoration:none">CRIAR NOVA FIGURINHA</a></div></div>`,
              attachments: [
                { filename: `figurinha-${fileNameBase}.png`, content: Buffer.from(stickerBytes).toString("base64") },
                { filename: `figurinhas-impressao-${fileNameBase}.pdf`, content: pdfBuffer.toString("base64") },
              ],
            });
            emailEnviado = true;
            console.log(`Vega: email enviado via Resend para ${customerEmail}`);
          } catch (err) {
            console.error("Vega: Resend falhou:", err instanceof Error ? err.message : err);
          }
        }

        // Marcar entregue só se enviou
        await sql`
          UPDATE pedidos
          SET status = ${emailEnviado ? "entregue" : newStatus}, delivered_at = ${emailEnviado ? new Date().toISOString() : null}
          WHERE sticker_id = ${resolvedStickerId}
        `;

        console.log(`Vega: figurinha ${emailEnviado ? "entregue" : "NAO entregue"} para ${customerEmail}`);
      } catch (err) {
        console.error("Vega: erro ao processar figurinha:", err);
      }
      continue;
    }

    // PACOTINHO
    if (productId.includes("pacot") || (productId.includes("pdf") && productId.includes("impressa"))) {
      try {
        const nodemailer = (await import("nodemailer")).default;
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        const pacotinhoRes = await fetch("https://minha-figurinha-copa2026.vercel.app/pacotinho-copa-2026.pdf");
        const pacotinhoBuf = Buffer.from(await pacotinhoRes.arrayBuffer());
        await transporter.sendMail({
          from: `Figurinha Copa 2026 <${process.env.SMTP_USER}>`,
          to: customerEmail,
          subject: "Seu Pacotinho Oficial da Copa 2026 esta pronto! ⚽",
          html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1E3A8A;text-align:center">⚽ Seu Pacotinho Copa 2026!</h1><p style="font-size:18px;text-align:center">Ola <b>${customerName}</b>!</p><p style="font-size:16px;text-align:center">Segue em anexo o Pacotinho Oficial da Copa 2026 pronto para impressao!</p></div>`,
          attachments: [{ filename: "pacotinho-copa-2026.pdf", content: pacotinhoBuf }],
        });
        console.log(`Vega: pacotinho enviado para ${customerEmail}`);
      } catch (err) {
        console.error("Vega: erro ao enviar pacotinho:", err);
      }
      continue;
    }

    // POSTER A2
    if (productId.includes("poster") || productId.includes("a2")) {
      try {
        const sharp = (await import("sharp")).default;
        const posterRows = await sql`
          SELECT sticker_url, sticker_id FROM pedidos
          WHERE email = ${customerEmail} AND sticker_url IS NOT NULL
          ORDER BY created_at DESC LIMIT 1
        `;
        if (posterRows.length > 0) {
          const stickerRes = await fetch(posterRows[0].sticker_url);
          const stickerBuf = Buffer.from(await stickerRes.arrayBuffer());
          const upscaled = await sharp(stickerBuf).resize(2048, null, { fit: "inside", kernel: "lanczos3" }).png().toBuffer();

          const A2_W = 420 * 2.83465;
          const A2_H = 594 * 2.83465;
          const posterPdf = await PDFDocument.create();
          let posterImg;
          try { posterImg = await posterPdf.embedPng(upscaled); } catch { posterImg = await posterPdf.embedJpg(upscaled); }
          const page = posterPdf.addPage([A2_W, A2_H]);
          page.drawRectangle({ x: 0, y: 0, width: A2_W, height: A2_H, color: rgb(0x4E / 255, 0xB9 / 255, 0xC2 / 255) });
          const imgRatio = posterImg.width / posterImg.height;
          const drawH = A2_H;
          const drawW = A2_H * imgRatio;
          page.drawImage(posterImg, { x: (A2_W - drawW) / 2, y: 0, width: drawW, height: drawH });
          const posterBuf = Buffer.from(await posterPdf.save());

          const nodemailer = (await import("nodemailer")).default;
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await transporter.sendMail({
            from: `Figurinha Copa 2026 <${process.env.SMTP_USER}>`,
            to: customerEmail,
            subject: "Seu Poster A2 da Copa 2026 esta pronto! ⚽",
            html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1E3A8A;text-align:center">⚽ Seu Poster A2!</h1><p style="font-size:18px;text-align:center">Ola <b>${customerName}</b>!</p><p style="font-size:16px;text-align:center">Segue em anexo o seu Poster A2 em alta resolucao, pronto para impressao!</p><p style="font-size:14px;color:#666;text-align:center">Formato A2 (42 x 59,4 cm). Imprima em uma grafica para melhor qualidade.</p></div>`,
            attachments: [{ filename: `poster-a2-${customerName.toLowerCase().replace(/\s+/g, "-")}.pdf`, content: posterBuf }],
          });
          console.log(`Vega: poster A2 enviado para ${customerEmail}`);
        }
      } catch (err) {
        console.error("Vega: erro ao gerar poster:", err);
      }
      continue;
    }

    // WHATSAPP
    if (productId.includes("whats") || productId.includes("zap")) {
      await sql`UPDATE pedidos SET whats_pendente = TRUE WHERE email = ${customerEmail} AND sticker_url IS NOT NULL ORDER BY created_at DESC LIMIT 1`.catch(() => {});
      console.log(`Vega: WhatsApp registrado para ${customerEmail}`);
      continue;
    }

    // ALBUM
    if (productId.includes("album") || productId.includes("álbum")) {
      console.log(`Vega: Album registrado para ${customerEmail} - aguardando setup`);
      continue;
    }

    // Produto não identificado
    console.log(`Vega: produto não identificado: "${product.title}" para ${customerEmail}`);
  }

  return NextResponse.json({ ok: true, message: "Vega webhook processado" });
}
