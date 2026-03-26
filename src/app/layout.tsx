import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindsLeap「悦动」时刻",
  description: "记录每一个精彩瞬间，AI 自动识别人脸，轻松标注人物信息",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
