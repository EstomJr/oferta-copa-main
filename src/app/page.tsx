"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Hero from "@/components/Hero";
import QuizStep from "@/components/QuizStep";
import type { QuizData } from "@/components/QuizStep";
import LoadingScreen from "@/components/LoadingScreen";
import ResultScreen from "@/components/ResultScreen";

function compressToBase64(file: File, maxSize = 512, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        const scale = maxSize / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = URL.createObjectURL(file);
  });
}

const initialData: QuizData = {
  nome: "",
  dataNascimento: "",
  email: "",
  clube: "",
  jogadorFavorito: "",
  peso: "",
  altura: "",
  foto: null,
};

type AppStep = "hero" | "quiz-1" | "loading-photo" | "quiz-2" | "quiz-3" | "loading-generate" | "result";

export default function Home() {
  const [appStep, setAppStep] = useState<AppStep>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("figurinha_sticker_url");
      if (saved) return "result";
    }
    return "hero";
  });
  const [quizStep, setQuizStep] = useState(1);
  const [data, setData] = useState<QuizData>(initialData);
  const [stickerUrl, setStickerUrl] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("figurinha_sticker_url") || "";
    return "";
  });
  const [stickerId, setStickerId] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("figurinha_sticker_id") || "";
    return "";
  });
  const [genStartTime, setGenStartTime] = useState(0);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Salvar UTMs da URL na chegada pra usar no checkout depois
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ttclid", "sck"];
    for (const key of utmKeys) {
      const val = params.get(key);
      if (val) {
        try { localStorage.setItem(key, val); } catch { /* ignore */ }
      }
    }
  }, []);

  // Proteger contra saída durante geração
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (appStep === "loading-generate") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [appStep]);

  // Manter tela ligada durante geração (Wake Lock API)
  useEffect(() => {
    if (appStep !== "loading-generate") return;
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Wake Lock não suportado ou negado
      }
    };
    requestWakeLock();

    // Re-adquirir se a página voltar ao foco
    const handleVisibility = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      wakeLock?.release();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [appStep]);

  const updateData = (fields: Partial<QuizData>) => {
    setData((prev) => ({ ...prev, ...fields }));
  };

  const [errorTimestamp, setErrorTimestamp] = useState<string | null>(null);

  const generateFigurinha = useCallback(async (retryAfterError?: string) => {
    const current = dataRef.current;
    try {
      if (!current.foto) throw new Error("Sem foto");

      const fotoBase64 = await compressToBase64(current.foto, 512, 0.7);

      const res = await fetch("/api/figurinha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: current.nome,
          dataNascimento: current.dataNascimento,
          email: current.email,
          clube: current.clube,
          jogadorFavorito: current.jogadorFavorito,
          peso: current.peso,
          altura: current.altura,
          fotoBase64,
          errorTimestamp: retryAfterError || undefined,
        }),
      });

      const result = await res.json();

      if (res.ok && result.imageBase64) {
        const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
        setStickerUrl(dataUrl);
        setStickerId(result.stickerId || "");
        setErrorTimestamp(null);
        sessionStorage.setItem("figurinha_sticker_url", dataUrl);
        sessionStorage.setItem("figurinha_sticker_id", result.stickerId || "");
      } else {
        console.error("Erro:", result.error);
        setStickerUrl("");
        // Registrar o momento do erro
        const now = new Date().toISOString();
        setErrorTimestamp(now);
      }
    } catch (error) {
      console.error("Erro na geração:", error);
      setStickerUrl("");
      const now = new Date().toISOString();
      setErrorTimestamp(now);
    }

    setAppStep("result");
  }, []);

  const handleQuizNext = useCallback(() => {
    if (quizStep === 1) {
      setAppStep("loading-photo");
      setTimeout(() => {
        setQuizStep(2);
        setAppStep("quiz-2");
      }, 3000);
    } else if (quizStep === 2) {
      setQuizStep(3);
      setAppStep("quiz-3");
    } else if (quizStep === 3) {
      setGenStartTime(Date.now());
      setAppStep("loading-generate");
      generateFigurinha();
    }
  }, [quizStep, generateFigurinha]);

  const handleQuizBack = useCallback(() => {
    if (quizStep === 2) {
      setQuizStep(1);
      setAppStep("quiz-1");
    } else if (quizStep === 3) {
      setQuizStep(2);
      setAppStep("quiz-2");
    }
  }, [quizStep]);

  return (
    <main className="flex flex-col items-center min-h-screen bg-copa-yellow">
      {appStep === "hero" && (
        <Hero onStart={() => {
          // Limpar sessão anterior
          sessionStorage.removeItem("figurinha_sticker_url");
          sessionStorage.removeItem("figurinha_sticker_id");
          setQuizStep(1);
          setAppStep("quiz-1");
        }} />
      )}

      {(appStep === "quiz-1" || appStep === "quiz-2" || appStep === "quiz-3") && (
        <QuizStep
          step={quizStep}
          data={data}
          updateData={updateData}
          onNext={handleQuizNext}
          onBack={handleQuizBack}
          totalSteps={3}
        />
      )}

      {appStep === "loading-photo" && (
        <LoadingScreen
          title="CARREGANDO FOTO"
          gifUrl="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjM0bHRyeHlscG1rM3I3M201d25xenFhbjV1bHlvZ3lsaGdhZ3B0OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WxDZ77xhPXf3i/giphy.gif"
        />
      )}

      {appStep === "loading-generate" && (
        <LoadingScreen
          title="GERANDO SUA FIGURINHA"
          gifUrl="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXc1dHJ2bnR2eGt6Nnp5OGQ3Ynd2MHY1aWRpcWN5aGE3ejliYjZlayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tkzfoxijYuxNK/giphy.gif"
          longWait
          startTime={genStartTime}
        />
      )}

      {appStep === "result" && (
        <ResultScreen stickerUrl={stickerUrl} stickerId={stickerId} onRetry={() => {
          sessionStorage.removeItem("figurinha_sticker_url");
          sessionStorage.removeItem("figurinha_sticker_id");
          setGenStartTime(Date.now());
          setAppStep("loading-generate");
          generateFigurinha(errorTimestamp || undefined);
        }} />
      )}
    </main>
  );
}
