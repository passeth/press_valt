import type { Metadata } from "next";
import { Noto_Sans_KR, Inter, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/provider";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Press Vault",
    template: "%s | Press Vault",
  },
  description:
    "읽고, 모으고, 쓰는 순환 구조의 지식 플랫폼. 아티클을 읽으며 소재를 수집하고, AI와 협업하여 나만의 글을 발행하세요.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: "Press Vault",
    description: "읽고, 모으고, 쓰는 순환 구조의 지식 플랫폼",
    siteName: "Press Vault",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} ${inter.variable} ${playfairDisplay.variable}`}>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
