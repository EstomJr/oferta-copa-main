import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sua Figurinha da Copa 2026 | Crie Agora",
  description:
    "Crie sua figurinha personalizada da Copa do Mundo 2026! Sua foto ao lado dos craques. Impressão profissional por apenas R$12,90.",
  robots: "index, follow",
  openGraph: {
    title: "Sua Figurinha da Copa 2026",
    description: "Crie sua figurinha personalizada da Copa do Mundo 2026!",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        <Script
          id="utmify-utms"
          src="https://cdn.utmify.com.br/scripts/utms/latest.js"
          data-utmify-prevent-xcod-sck=""
          data-utmify-prevent-subids=""
          strategy="afterInteractive"
        />
        <Script id="utmify-pixel" strategy="afterInteractive">{`
          window.pixelId = "6a01f90f2bd8b03a22549f61";
          var a = document.createElement("script");
          a.setAttribute("async", "");
          a.setAttribute("defer", "");
          a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
          document.head.appendChild(a);
        `}</Script>
        {children}
      </body>
    </html>
  );
}
