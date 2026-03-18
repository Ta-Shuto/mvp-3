import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/common/Providers";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastContainer } from "@/components/common/Toast";

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
      <body className="antialiased">
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
