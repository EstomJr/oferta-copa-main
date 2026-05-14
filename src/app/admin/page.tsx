"use client";

import { useState, useEffect, useCallback } from "react";

interface Pedido {
  id: number;
  nome: string;
  clube: string;
  jogador_favorito: string;
  sticker_url: string;
  sticker_id: string;
  status: string;
  email: string | null;
  telefone: string | null;
  pdf_url: string | null;
  whats_pendente: boolean;
  whats_enviado: boolean;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
}

interface Stats {
  total: number;
  pendentes: number;
  pagos: number;
  entregues: number;
}

export default function AdminDashboard() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pendentes: 0, pagos: 0, entregues: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendPedidoId, setResendPedidoId] = useState<number | null>(null);
  const [resendStatus, setResendStatus] = useState("");

  const fetchPedidos = useCallback(async (t: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pedidos", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        setError("Token inválido");
        setAuthenticated(false);
        localStorage.removeItem("admin_token");
        return;
      }
      const data = await res.json();
      setPedidos(data.pedidos);
      setStats(data.stats);
      setAuthenticated(true);
      localStorage.setItem("admin_token", t);
    } catch {
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    if (saved) { setToken(saved); fetchPedidos(saved); }
  }, [fetchPedidos]);

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); fetchPedidos(token); };

  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(() => fetchPedidos(token), 30000);
    return () => clearInterval(interval);
  }, [authenticated, token, fetchPedidos]);

  useEffect(() => {
    if (viewerIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerIndex(null);
      if (e.key === "ArrowLeft" && viewerIndex > 0) setViewerIndex(viewerIndex - 1);
      if (e.key === "ArrowRight" && viewerIndex < filteredPedidos.length - 1) setViewerIndex(viewerIndex + 1);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  });

  const handleResend = async (pedidoId: number, email: string) => {
    setResendStatus("Enviando...");
    try {
      const res = await fetch("/api/admin/resend", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendStatus("Enviado!");
        setResendPedidoId(null);
        setResendEmail("");
        fetchPedidos(token);
      } else {
        setResendStatus(data.error || "Erro");
      }
    } catch {
      setResendStatus("Erro de conexão");
    }
    setTimeout(() => setResendStatus(""), 3000);
  };

  const handleDownload = (url: string, nome: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `figurinha-${nome.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.target = "_blank";
    link.click();
  };

  const formatPhone = (phone: string) => {
    return phone.replace(/[^0-9+]/g, "").replace(/^\+/, "");
  };

  const handleWhatsApp = async (p: Pedido) => {
    const phone = p.telefone ? formatPhone(p.telefone) : "";

    // Buscar todos os materiais comprados
    let linksMsg = "";
    if (p.email) {
      try {
        const res = await fetch(`/api/admin/materiais?pedidoId=${p.id}&email=${encodeURIComponent(p.email)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const m of data.materiais) {
            if (m.url && m.url !== "processando") {
              linksMsg += `\n📎 ${m.nome}:\n${m.url}\n`;
            } else if (m.url === "processando") {
              linksMsg += `\n⏳ ${m.nome}:\nEstamos processando seu album completo para a impressão e enviaremos em breve.\n`;
            }
          }
        }
      } catch {
        // Fallback se não conseguir buscar materiais
      }
    }

    // Fallback se não encontrou materiais
    if (!linksMsg) {
      if (p.sticker_url) linksMsg += `\n🏆 Figurinha Avulsa:\n${p.sticker_url}\n`;
      if (p.pdf_url) linksMsg += `\n📄 PDF para Impressão:\n${p.pdf_url}\n`;
    }

    const msg = `Olá ${p.nome}! ⚽\n\nSua figurinha personalizada da Copa 2026 está pronta!\n\nAqui estão seus materiais:${linksMsg}\nObrigado pela compra! 🇧🇷\n\n✨ Conhece alguém que ia amar ter uma figurinha personalizada? Indique para os amigos:\nhttps://minha-figurinha-copa2026.vercel.app/`;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    // Marcar WhatsApp como enviado
    try {
      await fetch("/api/admin/whats-ok", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: p.id }),
      });
      fetchPedidos(token);
    } catch { /* ignora */ }
  };

  if (!authenticated) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-900">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <h1 className="text-2xl font-bold text-white text-center mb-6">Admin Dashboard</h1>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="Token de acesso"
            className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none mb-4" />
          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors cursor-pointer">
            {loading ? "Carregando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "pendente": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "pago": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "entregue": return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const filteredPedidos = search.trim()
    ? pedidos.filter(p =>
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
        p.clube.toLowerCase().includes(search.toLowerCase())
      )
    : pedidos;

  const viewerPedido = viewerIndex !== null ? filteredPedidos[viewerIndex] : null;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard Figurinhas</h1>
          <div className="flex gap-2">
            <button onClick={() => fetchPedidos(token)}
              className="bg-gray-700 px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm cursor-pointer">
              Atualizar
            </button>
            <button onClick={() => { localStorage.removeItem("admin_token"); setAuthenticated(false); setToken(""); }}
              className="bg-gray-700 px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm cursor-pointer">
              Sair
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-gray-400 text-sm">Total</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-yellow-400">{stats.pendentes}</p>
            <p className="text-gray-400 text-sm">Pendentes</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-blue-400">{stats.pagos}</p>
            <p className="text-gray-400 text-sm">Pagos</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-green-400">{stats.entregues}</p>
            <p className="text-gray-400 text-sm">Entregues</p>
          </div>
        </div>

        {/* Busca */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou clube..."
            className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Status de reenvio */}
        {resendStatus && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-center font-bold ${resendStatus === "Enviado!" ? "bg-green-500/20 text-green-400" : resendStatus === "Enviando..." ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"}`}>
            {resendStatus}
          </div>
        )}

        {/* Lista de pedidos */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-left">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Figurinha</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Clube</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Criado</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{p.id}</td>
                    <td className="px-4 py-3">
                      {p.sticker_url ? (
                        <button onClick={() => setViewerIndex(i)} className="cursor-pointer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.sticker_url} alt={p.nome} className="w-12 h-16 object-cover rounded border border-gray-600 hover:border-blue-500 transition-colors" />
                        </button>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.nome}</p>
                      {p.email && <p className="text-gray-500 text-xs">{p.email}</p>}
                      {p.telefone && (
                        <a href={`https://wa.me/${formatPhone(p.telefone)}`} target="_blank" rel="noopener noreferrer"
                          className="text-green-400 text-xs hover:text-green-300">{p.telefone}</a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.clube}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${statusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {/* Download */}
                        {p.sticker_url && (
                          <button onClick={() => handleDownload(p.sticker_url, p.nome)}
                            title="Download figurinha"
                            className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                            ⬇
                          </button>
                        )}
                        {/* Reenviar email */}
                        <button onClick={() => { setResendPedidoId(p.id); setResendEmail(p.email || ""); }}
                          title="Reenviar por email"
                          className="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                          ✉
                        </button>
                        {/* WhatsApp */}
                        {p.whats_pendente && !p.whats_enviado ? (
                          <button onClick={() => handleWhatsApp(p)}
                            title="Entregar no WhatsApp"
                            className="bg-orange-500 hover:bg-orange-400 px-2 py-1 rounded text-xs cursor-pointer transition-colors animate-pulse font-bold">
                            📲 Entregar
                          </button>
                        ) : p.whats_enviado ? (
                          <button onClick={() => handleWhatsApp(p)}
                            title="WhatsApp já enviado - clique para reenviar"
                            className="bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                            ✅ Whats OK
                          </button>
                        ) : (
                          <button onClick={() => handleWhatsApp(p)}
                            title="Enviar via WhatsApp"
                            className="bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                            💬
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPedidos.length === 0 && (
            <p className="text-gray-500 text-center py-12">Nenhum pedido encontrado.</p>
          )}
        </div>
      </div>

      {/* Modal de reenvio */}
      {resendPedidoId !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setResendPedidoId(null)}>
          <div className="bg-gray-800 p-6 rounded-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Reenviar Figurinha #{resendPedidoId}</h3>
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="Email do destinatário"
              className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setResendPedidoId(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors">
                Cancelar
              </button>
              <button onClick={() => { if (resendEmail) handleResend(resendPedidoId, resendEmail); }}
                disabled={!resendEmail}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors disabled:opacity-50">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer de figurinha */}
      {viewerPedido && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setViewerIndex(null)}>
          <button onClick={() => setViewerIndex(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-4xl cursor-pointer z-10">&times;</button>
          {viewerIndex! > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex! - 1); }}
              className="absolute left-4 text-white/70 hover:text-white text-5xl cursor-pointer z-10">&#8249;</button>
          )}
          <div className="flex flex-col items-center gap-4 max-w-md px-12" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewerPedido.sticker_url} alt={viewerPedido.nome} className="max-h-[60vh] w-auto rounded-xl shadow-2xl" />
            <div className="text-center">
              <p className="text-white text-xl font-bold">{viewerPedido.nome}</p>
              <p className="text-gray-400">{viewerPedido.clube} &bull; {viewerPedido.jogador_favorito}</p>
              {viewerPedido.email && <p className="text-gray-500 text-sm">{viewerPedido.email}</p>}
              {viewerPedido.telefone && (
                <a href={`https://wa.me/${formatPhone(viewerPedido.telefone)}`} target="_blank" rel="noopener noreferrer"
                  className="text-green-400 text-sm hover:text-green-300">{viewerPedido.telefone}</a>
              )}
              <p className="text-gray-500 text-sm">{formatDate(viewerPedido.created_at)}</p>
              <span className={`text-xs px-3 py-1 rounded-full border font-medium mt-2 inline-block ${statusBadge(viewerPedido.status)}`}>
                {viewerPedido.status}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleDownload(viewerPedido.sticker_url, viewerPedido.nome)}
                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
                ⬇ Download
              </button>
              <button onClick={() => { setViewerIndex(null); setResendPedidoId(viewerPedido.id); setResendEmail(viewerPedido.email || ""); }}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
                ✉ Reenviar
              </button>
              <button onClick={() => handleWhatsApp(viewerPedido)}
                className={`${viewerPedido.whats_pendente && !viewerPedido.whats_enviado ? "bg-orange-500 hover:bg-orange-400 animate-pulse" : viewerPedido.whats_enviado ? "bg-green-700 hover:bg-green-600" : "bg-green-600 hover:bg-green-500"} px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors`}>
                {viewerPedido.whats_pendente && !viewerPedido.whats_enviado ? "📲 Entregar WhatsApp" : viewerPedido.whats_enviado ? "✅ Whats OK" : "💬 WhatsApp"}
              </button>
            </div>
            <p className="text-gray-600 text-xs">{viewerIndex! + 1} de {filteredPedidos.length}</p>
          </div>
          {viewerIndex! < filteredPedidos.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex! + 1); }}
              className="absolute right-4 text-white/70 hover:text-white text-5xl cursor-pointer z-10">&#8250;</button>
          )}
        </div>
      )}
    </main>
  );
}
