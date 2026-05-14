import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const maxDuration = 60;

const BASE_URL = "https://minha-figurinha-copa2026.vercel.app";

export async function GET(req: NextRequest) {
  // Proteger com token (mesmo do cron da Vercel)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sql = getDb();
  const gmailScriptUrl = process.env.GMAIL_SCRIPT_URL;
  if (!gmailScriptUrl) {
    return NextResponse.json({ error: "Gmail Script não configurado" }, { status: 500 });
  }

  // Buscar pedidos pendentes com +15min, que têm email e figurinha, e que não receberam recovery
  const pendentes = await sql`
    SELECT id, nome, email, sticker_id, sticker_url, preview_url
    FROM pedidos
    WHERE status = 'pendente'
      AND email IS NOT NULL
      AND sticker_url IS NOT NULL
      AND recovery_sent = FALSE
      AND created_at < NOW() - INTERVAL '1 hour'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at ASC
    LIMIT 10
  `;

  console.log(`Recovery: ${pendentes.length} pedidos pendentes encontrados`);

  let sent = 0;
  for (const pedido of pendentes) {
    const imgUrl = pedido.preview_url || pedido.sticker_url;
    const previewUrl = `${BASE_URL}/preview?img=${encodeURIComponent(imgUrl)}&nome=${encodeURIComponent(pedido.nome)}&id=${pedido.sticker_id}`;

    try {
      const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #FFD700; border-radius: 16px;">
          <h1 style="color: #1E3A8A; text-align: center; font-size: 28px; margin-bottom: 8px;">
            &#x26BD; Ultima chance!
          </h1>
          <p style="font-size: 18px; text-align: center; color: #333;">
            Ola! A figurinha de <strong style="color: #1E3A8A;">${pedido.nome}</strong> esta prestes a ser excluida,
            mas voce ainda pode encantar quem voce ama com um desconto especial.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
              <tr>
                <td style="width: 200px; height: 300px; background-image: url('${imgUrl}'); background-size: cover; background-position: center; border-radius: 12px; border: 3px solid #1E3A8A; overflow: hidden;">
                  <img src="https://minha-figurinha-copa2026.vercel.app/watermark.png" width="200" height="300" alt="" style="display: block; opacity: 0.45;" />
                </td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 16px; color: #999; text-decoration: line-through; margin: 0;">R$12,90</p>
            <p style="font-size: 36px; color: #009739; font-weight: 900; margin: 4px 0;">R$9,90</p>
          </div>
          <p style="font-size: 16px; text-align: center; color: #333; margin-bottom: 20px;">
            Aproveite e receba sua figurinha pronta para impressao!
          </p>
          <div style="text-align: center;">
            <a href="${previewUrl}" style="display: inline-block; background: #009739; color: white; font-weight: bold; font-size: 18px; padding: 16px 40px; border-radius: 12px; text-decoration: none; letter-spacing: 1px;">
              QUERO MINHA FIGURINHA
            </a>
          </div>
          <hr style="border: 1px solid rgba(30,58,138,0.2); margin: 24px 0;" />
          <p style="font-size: 14px; text-align: center; margin-bottom: 8px;">
            Indique para seus amigos!
          </p>
          <div style="text-align: center; margin-bottom: 12px;">
            <a href="https://minha-figurinha-copa2026.vercel.app/" style="color: #1E3A8A; font-weight: bold; font-size: 14px;">Criar nova figurinha</a>
          </div>
        </div>
      </body></html>`;

      await fetch(gmailScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          email: pedido.email,
          nome: pedido.nome,
          subject: `A figurinha de ${pedido.nome} esta prestes a ser excluida!`,
          html: htmlBody,
        }),
        redirect: "follow",
      });

      // Marcar como enviado e status recuperação
      await sql`
        UPDATE pedidos SET recovery_sent = TRUE, recovery_sent_at = NOW(), status = 'recuperacao'
        WHERE id = ${pedido.id}
      `;

      sent++;
      console.log(`Recovery enviado para ${pedido.email} (${pedido.nome})`);
    } catch (error) {
      console.error(`Erro ao enviar recovery para ${pedido.email}:`, error);
    }
  }

  return NextResponse.json({ ok: true, processed: pendentes.length, sent });
}
