"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PhotoUploader from "@/components/PhotoUploader";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleImageLoaded = useCallback(
    async (dataUrl: string, file: File) => {
      setCreating(true);
      try {
        // Upload image via FormData (avoids body size limit)
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const { imageUrl } = await uploadRes.json();

        // Create project with image URL (small payload)
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: imageUrl }),
        });
        if (!res.ok) throw new Error("Create project failed");
        const { id, editToken } = await res.json();
        router.push(`/edit/${id}?token=${editToken}`);
      } catch {
        alert("创建项目失败，请重试");
        setCreating(false);
      }
    },
    [router]
  );

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/">
            <img src="/images/logo-blue.png" alt="MindsLeap" className="h-8" />
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/admin/projects"
              className="text-sm font-medium text-gray-500 hover:text-[var(--primary)] transition-colors"
            >
              项目管理
            </a>
            <a
              href="/admin/faces"
              className="text-sm font-medium text-gray-500 hover:text-[var(--primary)] transition-colors"
            >
              人脸库管理
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 md:py-20">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900">
              MindsLeap「悦动」时刻
            </h2>
            <p className="text-gray-500 text-sm md:text-base">
              记录每一个精彩瞬间，AI 自动识别人脸，轻松标注人物信息
            </p>
          </div>

          {creating ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-4"></div>
              <p className="text-gray-500">正在创建项目...</p>
            </div>
          ) : (
            <PhotoUploader onImageLoaded={handleImageLoaded} />
          )}
        </div>
      </div>
    </main>
  );
}
