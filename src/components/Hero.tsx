"use client";

import Image from "next/image";

interface HeroProps {
  onStart: () => void;
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="flex flex-col items-center min-h-[100dvh] w-full px-5 py-8 text-center overflow-hidden justify-between">
      <h1
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-4 max-w-2xl"
        style={{ fontFamily: "var(--font-titulo)" }}
      >
        Transforme seu filho em uma{" "}
        <span className="text-copa-blue">figurinha personalizada</span> da Copa do Mundo
      </h1>

      <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-[400px] mb-2">
        <div
          className="absolute left-0 top-6 md:top-8 w-36 h-52 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-xl z-10"
          style={{
            transform: "rotate(-8deg)",
            animation: "wiggle 4s ease-in-out infinite",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-helena.png"
              alt="Figurinha Helena"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 144px, 192px"
              priority
            />
            <div className="absolute inset-0 shine-effect" />
          </div>
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-44 h-64 md:w-60 md:h-[340px] rounded-xl overflow-hidden shadow-2xl z-30"
          style={{
            animation: "wiggle 4s ease-in-out infinite 0.5s",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-miguel.png"
              alt="Figurinha Miguel"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 176px, 240px"
              priority
            />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "1s" }} />
          </div>
        </div>

        <div
          className="absolute right-0 top-6 md:top-8 w-36 h-52 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-xl z-10"
          style={{
            transform: "rotate(8deg)",
            animation: "wiggle 4s ease-in-out infinite 1s",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-arthur.png"
              alt="Figurinha Arthur"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 144px, 192px"
              priority
            />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "2s" }} />
          </div>
        </div>
      </div>

      <p
        className="text-lg md:text-xl max-w-md mb-4 leading-relaxed"
        style={{ fontFamily: "var(--font-papernotes)" }}
      >
        Responda algumas perguntas rápidas e veja como criar uma figurinha exclusiva,
        com o nome, foto e estilo do seu pequeno craque.
      </p>

      <button
        onClick={onStart}
        className="w-full max-w-md bg-copa-blue text-copa-white font-bold text-2xl md:text-3xl py-5 rounded-2xl
          shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200
          animate-pulse-glow cursor-pointer tracking-[0.15em]"
        style={{ fontFamily: "var(--font-titulo)" }}
      >
        INICIAR
      </button>

      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="flex -space-x-2">
          {["🇧🇷", "🇦🇷", "🇫🇷", "🇩🇪", "🇪🇸"].map((flag, i) => (
            <span
              key={i}
              className="w-10 h-10 rounded-full bg-copa-white flex items-center justify-center text-xl border-2 border-copa-yellow"
            >
              {flag}
            </span>
          ))}
        </div>
        <p className="text-sm font-bold" style={{ fontFamily: "var(--font-papernotes)" }}>
          +2.500 figurinhas já criadas!
        </p>
      </div>
    </section>
  );
}
