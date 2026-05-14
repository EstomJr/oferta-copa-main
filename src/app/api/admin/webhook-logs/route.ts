import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sql = getDb();
  const logs = await sql`SELECT id, payload, created_at FROM webhook_logs ORDER BY id DESC LIMIT 20`;
  return NextResponse.json({ logs });
}
