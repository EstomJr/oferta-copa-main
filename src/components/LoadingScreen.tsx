"use client";

import { useState, useEffect, useRef } from "react";

interface LoadingScreenProps {
  title: string;
  gifUrl: string;
  longWait?: boolean;
  startTime?: number;
}

const curiosidades = [
  "A Copa de 2026 será a primeira com 48 seleções! Vai ser histórico!",
  "O Brasil é o maior campeão mundial com 5 títulos. Rumo ao hexa!",
  "Pelé marcou 1.283 gols na carreira. O Rei do Futebol!",
  "A primeira Copa do Mundo foi em 1930, no Uruguai.",
  "O recorde de gols em uma Copa é de Just Fontaine: 13 gols em 1958.",
  "Ronaldo Fenômeno é o segundo maior artilheiro de Copas com 15 gols.",
  "O Maracanã já recebeu quase 200 mil pessoas em um único jogo!",
  "A Copa de 2026 será sediada nos EUA, México e Canadá.",
  "O gol mais rápido da história das Copas foi marcado em 10,8 segundos!",
  "Cafu é o único jogador que disputou 3 finais consecutivas de Copa.",
  "Miroslav Klose é o maior artilheiro da história das Copas com 16 gols.",
  "O Brasil é a única seleção que participou de todas as edições da Copa.",
  "A camisa amarela da seleção brasileira foi adotada após a derrota de 1950.",
  "Zagallo foi campeão como jogador (1958 e 1962) e como técnico (1970).",
  "A bola oficial da Copa de 2026 se chama 'adidas Finale 26'.",
  "Neymar é o segundo maior artilheiro da história da seleção brasileira.",
  "Djalma Santos foi eleito o melhor lateral-direito de todos os tempos pela FIFA.",
  "O estádio Azteca, no México, é o único que sediou duas finais de Copa.",
];

export default function LoadingScreen({ title, gifUrl, longWait, startTime }: LoadingScreenProps) {
  const [percent, setPercent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [curiosidadeIndex, setCuriosidadeIndex] = useState(0);
  const start = useRef(startTime || Date.now());

  useEffect(() => {
    start.current = startTime || Date.now();
    setPercent(0);
    setElapsed(0);
    setCuriosidadeIndex(Math.floor(Math.random() * curiosidades.length));
  }, [startTime]);

  // Rotacionar curiosidades a cada 6 segundos
  useEffect(() => {
    if (!longWait) return;
    const interval = setInterval(() => {
      setCuriosidadeIndex((prev) => (prev + 1) % curiosidades.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [longWait]);

  useEffect(() => {
    if (!longWait) {
      const duration = 3000;
      const interval = setInterval(() => {
        const now = Date.now();
        const progress = Math.min(100, Math.round(((now - start.current) / duration) * 100));
        setPercent(progress);
        if (progress >= 100) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }

    // Barra que nunca para: sobe rápido até 80%, depois lentamente até 99%
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - start.current;
      setElapsed(Math.floor(elapsedMs / 1000));

      let newPercent: number;
      if (elapsedMs < 60000) {
        // 0-60s: sobe de 0 a 80%
        newPercent = Math.round((elapsedMs / 60000) * 80);
      } else if (elapsedMs < 180000) {
        // 60-180s: sobe lentamente de 80 a 98%
        const extra = ((elapsedMs - 60000) / 120000) * 18;
        newPercent = Math.round(80 + extra);
      } else {
        // 180s+: fica em 99%, nunca para
        newPercent = 99;
      }

      setPercent((prev) => Math.max(prev, newPercent));
    }, 200);

    return () => clearInterval(interval);
  }, [longWait]);

  return (
    <section className="flex flex-col items-center justify-center min-h-[100dvh] w-full px-4">
      <div className="w-full max-w-md bg-copa-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 animate-slide-up">
        <h2
          className="text-3xl md:text-4xl font-bold text-copa-blue tracking-[0.1em] text-center"
          style={{ fontFamily: "var(--font-titulo)" }}
        >
          {title}
        </h2>

        {longWait && (
          <p className="text-sm font-bold text-copa-blue text-center -mt-4" style={{ fontFamily: "var(--font-papernotes)" }}>
            Não saia dessa tela, leva até 2 minutos.
          </p>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gifUrl}
          alt="Carregando..."
          className="w-48 h-48 rounded-2xl object-cover"
        />

        <p
          className="text-base text-center min-h-[3rem] transition-opacity duration-500"
          style={{ fontFamily: "var(--font-papernotes)" }}
        >
          {longWait ? (
            <>
              <span className="text-copa-blue font-bold">Você sabia?</span>{" "}
              {curiosidades[curiosidadeIndex]}
            </>
          ) : (
            "Esse tem cara de jogador caro hein"
          )}
        </p>

        <div className="w-full">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-copa-blue" style={{ fontFamily: "var(--font-papernotes)" }}>
              {longWait && elapsed > 0 ? `${elapsed}s` : "Carregando..."}
            </span>
            <span className="text-sm font-bold text-copa-blue" style={{ fontFamily: "var(--font-papernotes)" }}>
              {percent}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-copa-blue rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
