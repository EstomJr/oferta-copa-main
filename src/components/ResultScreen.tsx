"use client";

import { useEffect } from "react";

interface ResultScreenProps {
  stickerUrl: string;
  stickerId: string;
  onRetry: () => void;
}

export default function ResultScreen({ stickerUrl, stickerId, onRetry }: ResultScreenProps) {
  const handleCheckout = () => {
    sessionStorage.removeItem("figurinha_sticker_url");
    sessionStorage.removeItem("figurinha_sticker_id");
    const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || "https://pay.onprofit.com.br/QfTIp4Og?off=wCZ0zK";

    // Capturar UTMs da URL original e cookies pra passar pro checkout
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ttclid", "sck", "src"];
    const utms: string[] = [];

    for (const key of utmKeys) {
      // Tentar da URL atual
      let val = params.get(key);
      // Tentar do cookie (UTMify salva lá)
      if (!val) {
        const cookie = document.cookie.split(";").find(c => c.trim().startsWith(`${key}=`));
        if (cookie) val = cookie.split("=")[1];
      }
      // Tentar do localStorage (UTMify também salva lá)
      if (!val) {
        try { val = localStorage.getItem(key); } catch { /* ignore */ }
      }
      if (val && key !== "src") utms.push(`${key}=${encodeURIComponent(val)}`);
    }

    const separator = checkoutUrl.includes("?") ? "&" : "?";
    const utmString = utms.length > 0 ? `&${utms.join("&")}` : "";
    window.location.href = `${checkoutUrl}${separator}src=${stickerId}${utmString}`;
  };

  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "u" || e.key === "S" || e.key === "U")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c")) ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
      }
    };
    const preventDrag = (e: DragEvent) => e.preventDefault();

    // Bloquear zoom por pinch
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("keydown", preventKeys);
    document.addEventListener("dragstart", preventDrag);
    document.addEventListener("touchmove", preventZoom, { passive: false });

    return () => {
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("keydown", preventKeys);
      document.removeEventListener("dragstart", preventDrag);
      document.removeEventListener("touchmove", preventZoom);
    };
  }, []);

  return (
    <section
      className="flex flex-col items-center min-h-[100dvh] w-full px-4 py-8 justify-center"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {!stickerUrl ? (
        <div className="bg-white rounded-2xl p-8 text-center border-4 border-copa-blue max-w-sm w-full animate-slide-up">
          <p className="text-4xl mb-3">📡</p>
          <h2
            className="text-2xl font-bold text-copa-blue mb-2"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            ERRO DE CONEXÃO
          </h2>
          <p className="text-base text-gray-600 mb-6" style={{ fontFamily: "var(--font-papernotes)" }}>
            Verifique sua conexão e clique no botão abaixo.
          </p>
          <button
            onClick={onRetry}
            className="w-full bg-copa-blue text-copa-white font-bold text-lg py-4 rounded-2xl
              shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em]"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-sm animate-slide-up">
          {/* Preview da figurinha com marca d'água */}
          <div
            className="relative w-44 md:w-52 rounded-xl overflow-hidden shadow-2xl border-3 border-copa-blue mb-6"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stickerUrl}
              alt="Figurinha personalizada"
              className="w-full aspect-[2/3] object-cover"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                pointerEvents: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            />
            {/* Marca d'água repetida cobrindo toda a imagem */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rotate-[-30deg] absolute w-[200%]" style={{ top: `${i * 22 - 10}%`, left: "-30%" }}>
                  <p className="text-white text-xl font-black tracking-[0.3em] whitespace-nowrap"
                    style={{ fontFamily: "var(--font-titulo)", textShadow: "1px 1px 4px rgba(0,0,0,0.4)", opacity: 0.3 }}>
                    PREVIEW &nbsp; PREVIEW &nbsp; PREVIEW
                  </p>
                  <p className="text-white text-[9px] font-bold tracking-widest whitespace-nowrap mt-1"
                    style={{ fontFamily: "var(--font-papernotes)", textShadow: "1px 1px 3px rgba(0,0,0,0.3)", opacity: 0.25 }}>
                    minha-figurinha-copa2026 &nbsp;&nbsp; minha-figurinha-copa2026 &nbsp;&nbsp; minha-figurinha-copa2026
                  </p>
                </div>
              ))}
            </div>
            {/* Overlay anti-cópia */}
            <div className="absolute inset-0" />
          </div>

          {/* GOOLL */}
          <h1
            className="text-6xl md:text-8xl font-bold text-copa-blue text-center tracking-[0.1em] mb-1"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            GOOLL!
          </h1>

          {/* Subtítulo */}
          <p
            className="text-lg md:text-xl text-copa-blue text-center font-bold mb-2"
            style={{ fontFamily: "var(--font-papernotes)" }}
          >
            Sua figurinha está pronta!
          </p>

          {/* Descrição */}
          <p
            className="text-base text-gray-600 text-center mb-6"
            style={{ fontFamily: "var(--font-papernotes)" }}
          >
            Receba o arquivo <strong>DIGITAL</strong> para a <strong>IMPRESSÃO</strong>
          </p>

          {/* Preço centralizado com brilho */}
          <p
            className="text-5xl md:text-6xl text-copa-green text-center mb-6 relative inline-block shine-effect"
            style={{ fontFamily: "'Montserrat', Arial Black, sans-serif", fontWeight: 900 }}
          >
            R$12,90
          </p>

          {/* Botão */}
          <button
            onClick={handleCheckout}
            className="w-full bg-copa-blue text-copa-white font-bold text-xl md:text-2xl py-5 rounded-2xl
              shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.15em]"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            RECEBER MINHA FIGURINHA
          </button>
        </div>
      )}
    </section>
  );
}
