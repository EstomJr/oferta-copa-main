import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const sql = getDb();

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        data_nascimento DATE,
        clube VARCHAR(100),
        jogador_favorito VARCHAR(100),
        peso_estimado VARCHAR(20),
        altura_estimada VARCHAR(20),
        sticker_id VARCHAR(100),
        sticker_url TEXT,
        status VARCHAR(20) DEFAULT 'pendente',
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        delivered_at TIMESTAMP
      )
    `;

    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS sticker_url TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefone VARCHAR(30)`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pdf_url TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS preview_url TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS whats_pendente BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS whats_enviado BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recovery_sent BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMP`;

    await sql`
      CREATE TABLE IF NOT EXISTS pedido_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER,
        email VARCHAR(255),
        nome VARCHAR(100),
        item_type VARCHAR(30) DEFAULT 'product',
        offer_hash VARCHAR(100),
        offer_name VARCHAR(200),
        product_name VARCHAR(200),
        price INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pago',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(order_id, offer_hash)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100),
        clube VARCHAR(100),
        jogador_favorito VARCHAR(100),
        step_reached INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        converted BOOLEAN DEFAULT FALSE
      )
    `;

    return NextResponse.json({ ok: true, message: "Tabelas criadas com sucesso" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
