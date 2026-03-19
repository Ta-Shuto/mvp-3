import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/common/Providers";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastContainer } from "@/components/common/Toast";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "面談支援プラットフォーム",
  description: "面談の事前準備からリアルタイム支援、事後レビューまでを一気通貫で支援するプラットフォーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.className} antialiased`}>
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
