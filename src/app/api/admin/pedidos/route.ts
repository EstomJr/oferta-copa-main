import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sql = getDb();

  const pedidos = await sql`
    SELECT p.id, p.nome, p.clube, p.jogador_favorito, p.sticker_url, p.sticker_id, p.status, p.email, p.telefone, p.pdf_url,
      COALESCE(p.whats_enviado, FALSE) as whats_enviado,
      CASE WHEN p.status IN ('pago', 'entregue', 'recuperado') AND EXISTS (
        SELECT 1 FROM pedido_items pi
        WHERE pi.email = p.email AND pi.item_type = 'order_bump'
        AND pi.product_name LIKE '%What%'
      ) THEN TRUE ELSE FALSE END as whats_pendente,
      p.created_at, p.paid_at, p.delivered_at
    FROM pedidos p ORDER BY p.id DESC LIMIT 100
  `;

  const statsResult = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
      COUNT(*) FILTER (WHERE status IN ('pago', 'entregue'))::int AS pagos,
      COUNT(*) FILTER (WHERE status = 'entregue')::int AS entregues
    FROM pedidos
  `;

  return NextResponse.json({
    pedidos,
    stats: statsResult[0],
  });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (email === "all") {
    await sql`DELETE FROM pedidos`;
    return NextResponse.json({ ok: true, message: "Todos os pedidos removidos" });
  }

  if (email) {
    await sql`DELETE FROM pedidos WHERE email = ${email}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Parâmetro email obrigatório" }, { status: 400 });
}
