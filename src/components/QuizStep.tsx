"use client";

import { useState, useRef, useEffect } from "react";

export interface QuizData {
  nome: string;
  dataNascimento: string;
  email: string;
  clube: string;
  jogadorFavorito: string;
  peso: string;
  altura: string;
  foto: File | null;
}

// Tabela de crescimento — percentil 50 brasileiro
const growthChart: Record<number, { altura: number; peso: number }> = {
  0: { altura: 50, peso: 3 }, 1: { altura: 76, peso: 10 }, 2: { altura: 88, peso: 12 },
  3: { altura: 96, peso: 14 }, 4: { altura: 103, peso: 16 }, 5: { altura: 110, peso: 18 },
  6: { altura: 116, peso: 21 }, 7: { altura: 122, peso: 23 }, 8: { altura: 128, peso: 26 },
  9: { altura: 133, peso: 29 }, 10: { altura: 138, peso: 32 }, 11: { altura: 143, peso: 36 },
  12: { altura: 149, peso: 40 }, 13: { altura: 156, peso: 45 }, 14: { altura: 163, peso: 51 },
  15: { altura: 170, peso: 56 }, 16: { altura: 173, peso: 61 }, 17: { altura: 175, peso: 65 },
  18: { altura: 175, peso: 68 },
};

function getEstimatedGrowth(dataNascimento: string) {
  if (!dataNascimento) return null;
  const birth = new Date(dataNascimento);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  if (age < 0) age = 0;
  return growthChart[Math.min(age, 18)] || growthChart[18];
}

interface QuizStepProps {
  step: number;
  data: QuizData;
  updateData: (fields: Partial<QuizData>) => void;
  onNext: () => void;
  onBack: () => void;
  totalSteps: number;
}

const clubes = [
  "Flamengo", "Corinthians", "Palmeiras", "São Paulo", "Santos",
  "Vasco", "Grêmio", "Internacional", "Cruzeiro", "Atlético-MG",
  "Fluminense", "Botafogo", "Bahia", "Fortaleza", "Athletico-PR",
  "Sport", "Coritiba", "Goiás", "Ceará", "Vitória",
  "América-MG", "Chapecoense", "Juventude", "Bragantino", "Cuiabá",
  "Náutico", "Santa Cruz", "Guarani", "Ponte Preta", "CRB",
  "Barcelona", "Real Madrid", "Manchester City", "Liverpool",
  "PSG", "Bayern de Munique", "Juventus", "Milan", "Inter de Milão",
];


export default function QuizStep({ step, data, updateData, onNext, onBack, totalSteps }: QuizStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [clubeQuery, setClubeQuery] = useState(data.clube || "");
  const [showClubeList, setShowClubeList] = useState(false);
  const clubeRef = useRef<HTMLDivElement>(null);


  // Data de nascimento — campos separados
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const filteredClubes = clubeQuery.trim()
    ? clubes.filter((c) => c.toLowerCase().includes(clubeQuery.toLowerCase()))
    : clubes;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clubeRef.current && !clubeRef.current.contains(e.target as Node)) setShowClubeList(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sanitize = (value: string) => value.replace(/<[^>]*>/g, "").replace(/[<>"'&]/g, "");

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    switch (step) {
      case 1:
        if (!data.nome || data.nome.trim().length < 2) newErrors.nome = "Nome deve ter pelo menos 2 caracteres";
        if (data.nome.length > 50) newErrors.nome = "Nome muito longo";
        if (!data.foto) newErrors.foto = "Envie a foto do craque";
        break;
      case 2:
        if (!data.dataNascimento) newErrors.dataNascimento = "Informe a data de nascimento";
        else {
          const birth = new Date(data.dataNascimento);
          const now = new Date();
          const age = now.getFullYear() - birth.getFullYear();
          if (age < 0 || age > 120) newErrors.dataNascimento = "Data inválida";
        }
        if (!data.email || !data.email.includes("@") || !data.email.includes(".")) newErrors.email = "Informe um e-mail válido";
        break;
      case 3:
        if (!data.clube || data.clube.trim().length < 2) newErrors.clube = "Digite ou selecione um clube";
        break;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) onNext();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErrors({ foto: "Envie apenas imagens" }); return; }
    if (file.size > 10 * 1024 * 1024) { setErrors({ foto: "Imagem muito grande (máx. 10MB)" }); return; }
    updateData({ foto: file });
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setErrors((prev) => { const next = { ...prev }; delete next.foto; return next; });
  };

  const progressPercent = (step / totalSteps) * 100;

  return (
    <section className="flex flex-col items-center min-h-[100dvh] w-full px-4 py-8 md:py-16">
      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold" style={{ fontFamily: "var(--font-papernotes)" }}>
            Passo {step} de {totalSteps}
          </span>
          <span className="text-sm" style={{ fontFamily: "var(--font-papernotes)" }}>
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="w-full h-3 bg-copa-white rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-copa-blue rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Card container */}
      <div className="w-full max-w-md bg-copa-white rounded-3xl shadow-2xl p-6 md:p-8 animate-slide-up">

        {/* Step 1: Nome + Foto */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <span className="text-4xl mb-2 block">✍️</span>
              <h2 className="text-2xl md:text-3xl font-black text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                QUAL O NOME DO CRAQUE?
              </h2>
              <p className="text-base mt-1 opacity-70" style={{ fontFamily: "var(--font-papernotes)" }}>
                O nome que vai aparecer na figurinha
              </p>
            </div>
            <div>
              <input
                type="text"
                value={data.nome}
                onChange={(e) => updateData({ nome: sanitize(e.target.value) })}
                placeholder="Nome e sobrenome"
                maxLength={50}
                autoComplete="name"
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors placeholder:text-gray-400"
                style={{ fontFamily: "var(--font-papernotes)" }}
              />
              {errors.nome && <p className="text-red-500 text-sm mt-1">{errors.nome}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                FOTO DO CRAQUE
              </label>
              {photoPreview ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-copa-blue rounded-xl p-4 text-center cursor-pointer hover:opacity-90 transition-opacity">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Preview" className="w-28 h-28 rounded-full mx-auto object-cover border-4 border-copa-blue" />
                  <p className="text-xs mt-2 text-copa-blue font-bold" style={{ fontFamily: "var(--font-papernotes)" }}>Toque para trocar a foto</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-copa-blue transition-colors">
                    <span className="text-3xl block mb-1">🖼️</span>
                    <p className="text-sm font-bold" style={{ fontFamily: "var(--font-papernotes)" }}>Galeria</p>
                  </button>
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-copa-blue transition-colors">
                    <span className="text-3xl block mb-1">📸</span>
                    <p className="text-sm font-bold" style={{ fontFamily: "var(--font-papernotes)" }}>Câmera</p>
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
              {errors.foto && <p className="text-red-500 text-sm mt-1">{errors.foto}</p>}
            </div>
          </div>
        )}

        {/* Step 2: Data de Nascimento — Dia, Mês, Ano separados */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <span className="text-4xl mb-2 block">🎂</span>
              <h2 className="text-2xl md:text-3xl font-black text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                DATA DE NASCIMENTO
              </h2>
              <p className="text-base mt-1 opacity-70" style={{ fontFamily: "var(--font-papernotes)" }}>
                Pra calcular a idade na figurinha
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold mb-1 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>DIA</label>
                <select
                  value={birthDay}
                  onChange={(e) => {
                    setBirthDay(e.target.value);
                    if (e.target.value && birthMonth && birthYear) {
                      updateData({ dataNascimento: `${birthYear}-${birthMonth}-${e.target.value}` });
                    }
                  }}
                  className="w-full px-3 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors bg-white cursor-pointer"
                  style={{ fontFamily: "var(--font-papernotes)" }}
                >
                  <option value="">--</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1).padStart(2, "0")}>{i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex-[1.3]">
                <label className="block text-xs font-bold mb-1 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>MÊS</label>
                <select
                  value={birthMonth}
                  onChange={(e) => {
                    setBirthMonth(e.target.value);
                    if (birthDay && e.target.value && birthYear) {
                      updateData({ dataNascimento: `${birthYear}-${e.target.value}-${birthDay}` });
                    }
                  }}
                  className="w-full px-3 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors bg-white cursor-pointer"
                  style={{ fontFamily: "var(--font-papernotes)" }}
                >
                  <option value="">--</option>
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((m, i) => (
                    <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold mb-1 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>ANO</label>
                <select
                  value={birthYear}
                  onChange={(e) => {
                    setBirthYear(e.target.value);
                    if (birthDay && birthMonth && e.target.value) {
                      updateData({ dataNascimento: `${e.target.value}-${birthMonth}-${birthDay}` });
                    }
                  }}
                  className="w-full px-3 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors bg-white cursor-pointer"
                  style={{ fontFamily: "var(--font-papernotes)" }}
                >
                  <option value="">--</option>
                  {Array.from({ length: new Date().getFullYear() - 1920 + 1 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            {errors.dataNascimento && <p className="text-red-500 text-sm mt-1">{errors.dataNascimento}</p>}

            {/* Email */}
            <div>
              <label className="block text-sm font-bold mb-1 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                SEU MELHOR E-MAIL
              </label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => updateData({ email: e.target.value })}
                placeholder="exemplo@email.com"
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors placeholder:text-gray-400"
                style={{ fontFamily: "var(--font-papernotes)" }}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>
        )}

        {/* Step 3: Clube + Peso/Altura */}
        {step === 3 && (() => {
          // Sugestão baseada na idade
          const estimated = getEstimatedGrowth(data.dataNascimento);
          if (estimated && !data.peso) updateData({ peso: String(estimated.peso) });
          if (estimated && !data.altura) updateData({ altura: String(estimated.altura) });

          return (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <span className="text-4xl mb-2 block">⭐</span>
              <h2 className="text-2xl md:text-3xl font-black text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                CLUBE E DADOS
              </h2>
              <p className="text-base mt-1 opacity-70" style={{ fontFamily: "var(--font-papernotes)" }}>
                O clube do coração e os dados pra figurinha
              </p>
            </div>

            {/* Clube */}
            <div ref={clubeRef} className="relative">
              <label className="block text-sm font-bold mb-1 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                CLUBE DO CORAÇÃO
              </label>
              <input
                type="text"
                value={clubeQuery}
                onChange={(e) => { const v = sanitize(e.target.value); setClubeQuery(v); updateData({ clube: v }); setShowClubeList(true); }}
                onFocus={() => setShowClubeList(true)}
                placeholder="Digite o nome do clube..."
                maxLength={50}
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors placeholder:text-gray-400"
                style={{ fontFamily: "var(--font-papernotes)" }}
              />
              {showClubeList && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredClubes.length > 0 ? filteredClubes.slice(0, 8).map((c) => (
                    <button key={c} type="button"
                      onClick={() => { setClubeQuery(c); updateData({ clube: c }); setShowClubeList(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-copa-yellow/30 transition-colors cursor-pointer ${data.clube === c ? "bg-copa-blue/10 font-bold text-copa-blue" : "text-gray-700"} first:rounded-t-xl last:rounded-b-xl`}
                      style={{ fontFamily: "var(--font-papernotes)" }}
                    >{c}</button>
                  )) : (
                    <div className="px-4 py-3 text-center" style={{ fontFamily: "var(--font-papernotes)" }}>
                      <p className="font-bold text-copa-blue">Clube personalizado</p>
                      <p className="text-sm text-gray-500">Vamos usar &quot;{clubeQuery}&quot;</p>
                    </div>
                  )}
                </div>
              )}
              {errors.clube && <p className="text-red-500 text-sm mt-1">{errors.clube}</p>}
            </div>

            {/* Peso e Altura lado a lado */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-bold mb-1 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                  PESO (kg)
                </label>
                <input
                  type="number"
                  value={data.peso}
                  onChange={(e) => updateData({ peso: e.target.value })}
                  placeholder={estimated ? String(estimated.peso) : "kg"}
                  min="1"
                  max="200"
                  className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors placeholder:text-gray-400"
                  style={{ fontFamily: "var(--font-papernotes)" }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold mb-1 text-copa-blue" style={{ fontFamily: "var(--font-titulo)" }}>
                  ALTURA (cm)
                </label>
                <input
                  type="number"
                  value={data.altura}
                  onChange={(e) => updateData({ altura: e.target.value })}
                  placeholder={estimated ? String(estimated.altura) : "cm"}
                  min="30"
                  max="250"
                  className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-copa-blue focus:outline-none transition-colors placeholder:text-gray-400"
                  style={{ fontFamily: "var(--font-papernotes)" }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-3" style={{ fontFamily: "var(--font-papernotes)" }}>
              Sugestão baseada na idade. Altere se quiser.
            </p>
          </div>
          );
        })()}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button onClick={onBack}
              className="flex-1 px-6 py-4 rounded-xl border-2 border-copa-blue text-copa-blue font-bold hover:bg-copa-blue hover:text-copa-white transition-all duration-200 cursor-pointer tracking-[0.15em]"
              style={{ fontFamily: "var(--font-titulo)" }}
            >VOLTAR</button>
          )}
          <button onClick={handleNext}
            className="flex-1 bg-copa-blue text-copa-white font-bold text-lg px-6 py-4 rounded-xl shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.15em]"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            {step === totalSteps ? "GERAR FIGURINHA ⚽" : "PRÓXIMO →"}
          </button>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mt-6">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${i + 1 <= step ? "bg-copa-blue scale-110" : "bg-copa-white opacity-50"}`} />
        ))}
      </div>
    </section>
  );
}
