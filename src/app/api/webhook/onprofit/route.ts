import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import { list, put } from "@vercel/blob";
import { Resend } from "resend";
import { getDb } from "@/lib/db";

export const maxDuration = 300;

// Tamanho figurinha: 6 x 9 cm (proporção 2:3, igual à imagem gerada)
// A4: 21 x 29.7 cm
// Cabe: 3 colunas x 3 linhas = 9 figurinhas por página
const STICKER_W_CM = 6;
const STICKER_H_CM = 9;
const A4_W_CM = 21;
const A4_H_CM = 29.7;
const CM_TO_PT = 28.3465; // 1 cm = 28.3465 points

const STICKER_W = STICKER_W_CM * CM_TO_PT;
const STICKER_H = STICKER_H_CM * CM_TO_PT;
const A4_W = A4_W_CM * CM_TO_PT;
const A4_H = A4_H_CM * CM_TO_PT;

const COLS = Math.floor(A4_W_CM / STICKER_W_CM); // 3
const ROWS = Math.floor(A4_H_CM / STICKER_H_CM); // 3

async function generatePDF(stickerBytes: Uint8Array): Promise<Buffer> {
  const pdf = await PDFDocument.create();

  // Tentar embedPng, se falhar tenta embedJpg
  let stickerImage;
  try {
    stickerImage = await pdf.embedPng(stickerBytes);
  } catch {
    stickerImage = await pdf.embedJpg(stickerBytes);
  }

  const page = pdf.addPage([A4_W, A4_H]);

  const gridW = COLS * STICKER_W;
  const gridH = ROWS * STICKER_H;
  const marginX = (A4_W - gridW) / 2;
  const marginY = (A4_H - gridH) / 2;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = marginX + col * STICKER_W;
      const y = A4_H - marginY - (row + 1) * STICKER_H;
      page.drawImage(stickerImage, {
        x,
        y,
        width: STICKER_W,
        height: STICKER_H,
      });
    }
  }

  // Linhas de corte
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
  return Buffer.from(pdfBytes);
}

// Upscale com Sharp e gera PDF A2
async function generatePosterA2(stickerUrl: string, stickerId: string): Promise<string> {
  const sharp = (await import("sharp")).default;

  // Baixar figurinha original
  const stickerRes = await fetch(stickerUrl);
  const stickerBuffer = Buffer.from(await stickerRes.arrayBuffer());

  // Upscale com Sharp pra 2K
  console.log("Upscaling figurinha com Sharp...");
  const upscaledBuffer = await sharp(stickerBuffer)
    .resize(2048, null, { fit: "inside", kernel: "lanczos3" })
    .png()
    .toBuffer();
  console.log(`Upscale concluido: ${Math.round(upscaledBuffer.length / 1024)} KB`);

  // Gerar PDF A2 (420 x 594 mm)
  const A2_W = 420 * 2.83465; // mm to points
  const A2_H = 594 * 2.83465;

  const posterPdf = await PDFDocument.create();
  let posterImage;
  try {
    posterImage = await posterPdf.embedPng(upscaledBuffer);
  } catch {
    posterImage = await posterPdf.embedJpg(upscaledBuffer);
  }

  const page = posterPdf.addPage([A2_W, A2_H]);

  // Fundo turquesa (#4EB9C2)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A2_W,
    height: A2_H,
    color: rgb(0x4E / 255, 0xB9 / 255, 0xC2 / 255),
  });

  // Manter proporção — preencher vertical, centralizar horizontal
  const imgRatio = posterImage.width / posterImage.height;
  const drawH = A2_H;
  const drawW = A2_H * imgRatio;
  const offsetX = (A2_W - drawW) / 2;

  page.drawImage(posterImage, {
    x: offsetX,
    y: 0,
    width: drawW,
    height: drawH,
  });

  const posterBytes = await posterPdf.save();
  const posterBuffer = Buffer.from(posterBytes);

  // Salvar no Blob
  const posterBlob = await put(`posters/${stickerId}-a2.pdf`, posterBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  console.log(`Poster A2 salvo: ${posterBlob.url} (${Math.round(posterBuffer.length / 1024)} KB)`);
  return posterBlob.url;
}

async function sendEmailViaGmail(to: string, customerName: string, pdfUrl: string) {
  const scriptUrl = process.env.GMAIL_SCRIPT_URL;
  if (!scriptUrl) throw new Error("GMAIL_SCRIPT_URL não configurada");

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1E3A8A; text-align: center;">GOOLL! &#x26BD;</h1>
      <p style="font-size: 18px; text-align: center;">
        Ola <strong>${customerName}</strong>!
      </p>
      <p style="font-size: 16px; text-align: center;">
        Sua figurinha personalizada da Copa do Mundo 2026 esta pronta!
      </p>
      <p style="font-size: 16px; text-align: center;">
        O arquivo PDF em anexo contem sua figurinha no tamanho padrao (6,5 x 9 cm),
        pronta para impressao. Sao 9 figurinhas por pagina A4.
      </p>
      <p style="font-size: 14px; color: #666; text-align: center;">
        Dica: imprima em papel fotografico ou couche para melhor qualidade!
      </p>
      <hr style="border: 1px solid #FFD700; margin: 20px 0;" />
      <p style="font-size: 16px; text-align: center; margin-bottom: 12px;">
        Conhece alguem que ia amar ter uma figurinha personalizada?
      </p>
      <div style="text-align: center; margin-bottom: 16px;">
        <a href="https://minha-figurinha-copa2026.vercel.app/" style="display: inline-block; background: #1E3A8A; color: white; font-weight: bold; font-size: 16px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">CRIAR NOVA FIGURINHA</a>
      </div>
      <p style="font-size: 12px; color: #999; text-align: center;">
        Figurinha Copa 2026 - Arquivo digital para impressao.
      </p>
    </div>
  </body></html>`;

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      email: to,
      nome: customerName,
      subject: "Sua Figurinha da Copa 2026 esta pronta!",
      html: htmlBody,
      pdfUrl,
    }),
    redirect: "follow",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail Script erro: ${res.status} ${text}`);
  }
}

async function sendEmailViaResend(to: string, customerName: string, pdfBuffer: Buffer, stickerBytes?: Uint8Array) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Figurinha Copa 2026 <onboarding@resend.dev>",
    to,
    subject: "Sua Figurinha da Copa 2026 está pronta! ⚽",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1E3A8A; text-align: center;">GOOLL! ⚽</h1>
        <p style="font-size: 18px; text-align: center;">
          Olá <strong>${customerName}</strong>!
        </p>
        <p style="font-size: 16px; text-align: center;">
          Sua figurinha personalizada da Copa do Mundo 2026 está pronta!
        </p>
        <p style="font-size: 16px; text-align: center;">
          O arquivo PDF em anexo contém sua figurinha no tamanho padrão (6,5 x 9 cm),
          pronta para impressão. São 9 figurinhas por página A4.
        </p>
        <p style="font-size: 14px; color: #666; text-align: center;">
          Dica: imprima em papel fotográfico ou couché para melhor qualidade!
        </p>
        <hr style="border: 1px solid #FFD700; margin: 20px 0;" />
        <p style="font-size: 16px; text-align: center; margin-bottom: 12px;">
          Conhece alguém que ia amar ter uma figurinha personalizada?
        </p>
        <div style="text-align: center; margin-bottom: 16px;">
          <a href="https://minha-figurinha-copa2026.vercel.app/" style="display: inline-block; background: #1E3A8A; color: white; font-weight: bold; font-size: 16px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">CRIAR NOVA FIGURINHA</a>
        </div>
        <p style="font-size: 12px; color: #999; text-align: center;">
          Figurinha Copa 2026 — Arquivo digital para impressão.
        </p>
      </div>
    `,
    attachments: [
      ...(stickerBytes ? [{ filename: `figurinha-${customerName.toLowerCase().replace(/\s+/g, "-")}.png`, content: Buffer.from(stickerBytes).toString("base64") }] : []),
      {
        filename: `figurinhas-impressao-${customerName.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  // Verificar token secreto do webhook
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

  console.log("Webhook Onprofit recebido:", payload.id, payload.status);

  // Só processa pagamentos confirmados
  if (payload.status !== "PAID") {
    console.log(`Status ${payload.status} ignorado.`);
    return NextResponse.json({ ok: true, message: "Status ignorado" });
  }

  const customerEmail = payload.customer?.email;
  const rawName = `${payload.customer?.name || ""} ${payload.customer?.lastname || ""}`.trim();
  const customerName = rawName.replace(/[<>"'&]/g, "");
  const customerPhone = payload.customer?.cell || payload.customer?.phone || null;
  const stickerId = payload.src;
  const orderId = payload.id;
  const itemType = payload.item_type; // "product" ou "order_bump"
  const offerHash = payload.offer_hash;
  const offerName = payload.offer_name;
  const price = payload.price;
  const productName = payload.product?.name;

  if (!customerEmail) {
    console.error("Webhook sem email do cliente");
    return NextResponse.json({ error: "Email não encontrado" }, { status: 400 });
  }

  // Registrar TODOS os itens do pedido (produto principal + order bumps)
  await sql`
    INSERT INTO pedido_items (order_id, email, nome, item_type, offer_hash, offer_name, product_name, price, status, created_at)
    VALUES (${orderId}, ${customerEmail}, ${customerName}, ${itemType || "product"}, ${offerHash}, ${offerName}, ${productName}, ${price}, 'pago', NOW())
    ON CONFLICT DO NOTHING
  `.catch(() => {
    // Tabela pode não existir ainda, ignora
    console.log("Tabela pedido_items não existe, ignorando registro de item");
  });

  console.log(`Item registrado: ${itemType || "product"} - ${offerName} - R$${((price || 0) / 100).toFixed(2)}`);

  // Se for order bump, identificar qual e processar
  if (itemType === "order_bump") {
    const offerLower = (offerName || "").toLowerCase();
    const productLower = (productName || "").toLowerCase();
    const bumpId = `${offerLower} ${productLower}`;

    console.log(`Order bump recebido para ${customerEmail}: "${offerName}" / "${productName}"`);

    // PDF do Pacote de Figurinhas
    if (bumpId.includes("pacot") || bumpId.includes("pdf") || bumpId.includes("impressa") || bumpId.includes("impressão")) {
      if (customerEmail) {
        try {
          const pacotinhoUrl = "https://minha-figurinha-copa2026.vercel.app/pacotinho-copa-2026.pdf";
          const pdfRes = await fetch(pacotinhoUrl);
          const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "Figurinha Copa 2026 <onboarding@resend.dev>",
            to: customerEmail,
            subject: "Seu Pacotinho Oficial da Copa 2026 está pronto! ⚽",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1E3A8A; text-align: center;">⚽ Seu Pacotinho Copa 2026!</h1>
              <p style="font-size: 18px; text-align: center;">Olá <strong>${customerName}</strong>!</p>
              <p style="font-size: 16px; text-align: center;">Segue em anexo o <strong>Pacotinho Oficial da Copa 2026</strong> pronto para impressão!</p>
              <p style="font-size: 14px; color: #666; text-align: center;">Dica: imprima em papel mais grosso (couchê ou fotográfico) para melhor resultado.</p>
            </div>`,
            attachments: [{ filename: "pacotinho-copa-2026.pdf", content: pdfBuf.toString("base64") }],
          });
          console.log(`Pacotinho enviado via Resend para ${customerEmail}`);
        } catch (err) {
          console.error("Erro ao enviar pacotinho:", err);
        }
      }
      return NextResponse.json({ ok: true, message: "Order bump: pacotinho enviado" });
    }

    // Envio no WhatsApp — marcar como pendente no admin
    if (bumpId.includes("whats") || bumpId.includes("zap")) {
      console.log(`WhatsApp bump recebido para ${customerEmail} - marcando pendente`);

      // Marcar whats_pendente no pedido
      if (customerEmail) {
        await sql`UPDATE pedidos SET whats_pendente = TRUE WHERE email = ${customerEmail} AND sticker_url IS NOT NULL ORDER BY created_at DESC LIMIT 1`.catch(() => {});
      }

      // WhatsApp: apenas registra no banco, entrega é manual pelo admin
      console.log(`WhatsApp registrado para ${customerEmail}`);

      return NextResponse.json({ ok: true, message: "Order bump: whatsapp processado" });
    }

    // Poster A2 — upscale + PDF A2
    if (bumpId.includes("poster") || bumpId.includes("a2")) {
      if (customerEmail) {
        try {
          // Buscar figurinha do cliente
          let stickerUrlForPoster: string | null = null;
          const posterRows = await sql`
            SELECT sticker_url FROM pedidos
            WHERE email = ${customerEmail} AND sticker_url IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
          `;
          if (posterRows.length > 0) stickerUrlForPoster = posterRows[0].sticker_url;

          if (!stickerUrlForPoster && stickerId) {
            const blobList = await list({ prefix: `figurinhas/${stickerId}` });
            if (blobList.blobs[0]) stickerUrlForPoster = blobList.blobs[0].url;
          }

          if (stickerUrlForPoster) {
            const posterUrl = await generatePosterA2(stickerUrlForPoster, stickerId || "poster");

            const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1E3A8A; text-align: center;">&#x26BD; Seu Poster A2 Copa 2026!</h1>
                <p style="font-size: 18px; text-align: center;">Ola <strong>${customerName}</strong>!</p>
                <p style="font-size: 16px; text-align: center;">Segue em anexo o seu <strong>Poster A2</strong> da figurinha em alta resolucao, pronto para impressao!</p>
                <p style="font-size: 14px; color: #666; text-align: center;">Dica: imprima em uma grafica para melhor qualidade. O formato e A2 (42 x 59,4 cm).</p>
                <hr style="border: 1px solid #FFD700; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999; text-align: center;">Conhece alguem que ia amar ter uma figurinha? <a href='https://minha-figurinha-copa2026.vercel.app/' style='color:#1E3A8A;font-weight:bold'>Crie uma agora!</a></p>
              </div>
            </body></html>`;

            const posterPdfRes = await fetch(posterUrl);
            const posterPdfBuf = Buffer.from(await posterPdfRes.arrayBuffer());
            const resendPoster = new Resend(process.env.RESEND_API_KEY);
            await resendPoster.emails.send({
              from: "Figurinha Copa 2026 <onboarding@resend.dev>",
              to: customerEmail,
              subject: "Seu Poster A2 da Copa 2026 está pronto! ⚽",
              html: htmlBody,
              attachments: [{ filename: `poster-a2-${customerName.toLowerCase().replace(/\s+/g, "-")}.pdf`, content: posterPdfBuf.toString("base64") }],
            });
            console.log(`Poster A2 enviado para ${customerEmail}`);
          } else {
            console.error("Poster A2: figurinha não encontrada para", customerEmail);
          }
        } catch (err) {
          console.error("Erro ao gerar poster A2:", err);
        }
      }
      return NextResponse.json({ ok: true, message: "Order bump: poster A2 processado" });
    }

    // Todas as figurinhas — aguardando setup
    if (bumpId.includes("todas") || bumpId.includes("all")) {
      console.log(`Todas figurinhas bump registrado para ${customerEmail} - aguardando setup`);
      return NextResponse.json({ ok: true, message: "Order bump: todas figurinhas registrado" });
    }

    // Order bump não identificado — registra sem ação
    console.log(`Order bump desconhecido: "${offerName}" / "${productName}" para ${customerEmail}`);
    return NextResponse.json({ ok: true, message: "Order bump registrado (sem acao automatica)" });
  }

  // A partir daqui, processa o produto principal (figurinha)

  // Buscar figurinha — pelo src se disponível, senão pelo último pedido pendente
  let stickerUrl: string | null = null;
  let resolvedStickerId: string | null = stickerId;

  if (stickerId) {
    const blobList = await list({ prefix: `figurinhas/${stickerId}` });
    if (blobList.blobs[0]) {
      stickerUrl = blobList.blobs[0].url;
    }
  }

  if (!stickerUrl) {
    // Fallback: buscar o último pedido pendente por email
    const rows = await sql`
      SELECT sticker_id, sticker_url FROM pedidos
      WHERE (email = ${customerEmail} OR status = 'pendente') AND sticker_url IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    if (rows.length > 0) {
      stickerUrl = rows[0].sticker_url;
      resolvedStickerId = rows[0].sticker_id;
      console.log(`Fallback: usando pedido: ${resolvedStickerId}`);
    }
  }

  if (!stickerUrl) {
    console.error("Nenhuma figurinha encontrada");
    return NextResponse.json({ error: "Figurinha não encontrada" }, { status: 404 });
  }

  try {
    // Baixar imagem do Blob
    const stickerRes = await fetch(stickerUrl);
    const stickerBytes = new Uint8Array(await stickerRes.arrayBuffer());

    // Gerar PDF
    console.log(`Gerando PDF para ${customerName} (${customerEmail})...`);
    const pdfBuffer = await generatePDF(stickerBytes);
    console.log(`PDF gerado: ${Math.round(pdfBuffer.length / 1024)} KB`);

    // Salvar PDF no Blob pra link permanente
    const pdfBlob = await put(`pdfs/${resolvedStickerId}.pdf`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      allowOverwrite: true,
    });
    console.log(`PDF salvo no Blob: ${pdfBlob.url}`);

    // Atualizar pedido no banco — se estava em recuperação, marca como recuperado
    const currentStatus = await sql`SELECT status FROM pedidos WHERE sticker_id = ${resolvedStickerId}`;
    const newStatus = currentStatus[0]?.status === 'recuperacao' ? 'recuperado' : 'pago';

    await sql`
      UPDATE pedidos
      SET status = ${newStatus}, email = ${customerEmail}, telefone = ${customerPhone}, pdf_url = ${pdfBlob.url}, paid_at = NOW()
      WHERE sticker_id = ${resolvedStickerId}
    `;

    // Enviar email — tenta múltiplos métodos
    console.log(`Enviando email para ${customerEmail}...`);
    let emailEnviado = false;

    // 1. Tentar Gmail SMTP direto (nodemailer)
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const dlLink = `https://minha-figurinha-copa2026.vercel.app/api/download?url=${encodeURIComponent(pdfBlob.url)}&name=figurinha-copa-2026`;
      const fileNameBase = customerName.toLowerCase().replace(/\s+/g, "-");
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
      console.log(`Email enviado via Gmail SMTP para ${customerEmail}!`);
    } catch (smtpErr) {
      console.error("Gmail SMTP falhou:", smtpErr instanceof Error ? smtpErr.message : smtpErr);
    }

    // 2. Fallback: Resend
    if (!emailEnviado) {
      try {
        await sendEmailViaResend(customerEmail, customerName, pdfBuffer, stickerBytes);
        emailEnviado = true;
        console.log(`Email enviado via Resend para ${customerEmail}!`);
      } catch (resendErr) {
        console.error("Resend falhou:", resendErr instanceof Error ? resendErr.message : resendErr);
      }
    }

    // 3. Fallback: Gmail Apps Script
    if (!emailEnviado) {
      try {
        await sendEmailViaGmail(customerEmail, customerName, pdfBlob.url);
        emailEnviado = true;
        console.log(`Email enviado via Gmail Script para ${customerEmail}!`);
      } catch (gmailErr) {
        console.error("Gmail Script falhou:", gmailErr instanceof Error ? gmailErr.message : gmailErr);
      }
    }

    if (!emailEnviado) {
      console.error(`FALHA TOTAL: nenhum metodo de envio funcionou para ${customerEmail}`);
    }

    // Só marca entregue se o email foi enviado
    await sql`
      UPDATE pedidos
      SET status = ${emailEnviado ? 'entregue' : newStatus}, delivered_at = ${emailEnviado ? new Date().toISOString() : null}
      WHERE sticker_id = ${resolvedStickerId}
    `;

    return NextResponse.json({ ok: true, message: "Figurinha enviada por email" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Erro no webhook:", errMsg);
    return NextResponse.json({ error: "Erro ao processar: " + errMsg }, { status: 500 });
  }
}
