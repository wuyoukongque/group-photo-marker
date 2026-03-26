"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { Person } from "@/types";

export default function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [title, setTitle] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [persons, setPersons] = useState<Person[]>([]);
  const [showNames, setShowNames] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("项目不存在");
        return r.json();
      })
      .then((data) => {
        setTitle(data.title || "");
        setImageDataUrl(data.imageDataUrl);
        setPersons(data.persons || []);
        setShowNames(data.showNames ?? true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Update page title
  useEffect(() => {
    document.title = title ? `${title} - 集体照标注` : "集体照标注工具";
  }, [title]);

  useEffect(() => {
    if (!imageDataUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    if (!imgSize.w || !containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const scale = Math.min(1, containerWidth / imgSize.w);
      setDisplaySize({
        w: Math.round(imgSize.w * scale),
        h: Math.round(imgSize.h * scale),
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imgSize]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !displaySize.w) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displaySize.w * dpr;
    canvas.height = displaySize.h * dpr;
    canvas.style.width = `${displaySize.w}px`;
    canvas.style.height = `${displaySize.h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.drawImage(img, 0, 0, displaySize.w, displaySize.h);

    if (!showNames) return;
    const scale = displaySize.w / imgSize.w;

    persons.forEach((person) => {
      if (!person.name) return;
      const cx = person.x * imgSize.w * scale;
      const cy = person.y * imgSize.h * scale;
      const r = person.radius * imgSize.w * scale;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const fontSize = Math.max(11, r * 0.35);
      ctx.font = `600 ${fontSize}px "Inter", "Noto Sans SC", sans-serif`;
      const textWidth = ctx.measureText(person.name).width;
      const labelX = cx - textWidth / 2;
      const labelY = cy + r + fontSize + 4;

      ctx.fillStyle = "rgba(30,71,124,0.75)";
      const padding = 4;
      ctx.beginPath();
      ctx.roundRect(labelX - padding, labelY - fontSize - 2, textWidth + padding * 2, fontSize + padding * 2, 4);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(person.name, labelX, labelY);
    });
  }, [persons, displaySize, imgSize, showNames]);

  useEffect(() => {
    if (imgLoaded) draw();
  }, [draw, imgLoaded]);

  const getAvatar = useCallback((person: Person): string => {
    const img = imgRef.current;
    if (!img) return "";
    const canvas = document.createElement("canvas");
    const size = 120;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const sx = person.x * img.naturalWidth - person.radius * img.naturalWidth;
    const sy = person.y * img.naturalHeight - person.radius * img.naturalWidth;
    const sSize = person.radius * img.naturalWidth * 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const [avatars, setAvatars] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!imgLoaded) return;
    const newAvatars: Record<string, string> = {};
    persons.forEach((p) => { newAvatars[p.id] = getAvatar(p); });
    setAvatars(newAvatars);
  }, [imgLoaded, persons, getAvatar]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-red-500 mb-4 text-lg">{error}</p>
          <a href="/" className="btn-primary px-6 py-2 text-sm inline-block">返回首页</a>
        </div>
      </main>
    );
  }

  const namedPersons = persons.filter((p) => p.name);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/"><img src="/images/logo-blue.png" alt="MindsLeap" className="h-6" /></a>
          {title && (
            <h1 className="text-sm md:text-base font-semibold text-gray-800 truncate mx-4 flex-1 text-center">
              {title}
            </h1>
          )}
          <button
            onClick={() => setShowNames((v) => !v)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            {showNames ? "隐藏标注" : "显示标注"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10 animate-fade-in">
        {/* Title */}
        {title && (
          <h1 className="text-xl md:text-3xl font-bold text-center mb-6 md:mb-8 text-gray-900">
            {title}
          </h1>
        )}

        {/* Photo */}
        <div ref={containerRef} className="flex justify-center mb-8 md:mb-12">
          <canvas ref={canvasRef} className="rounded-2xl shadow-lg max-w-full" />
        </div>

        {/* Person cards */}
        {namedPersons.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 md:mb-6">
              参与人员 ({namedPersons.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 animate-stagger">
              {namedPersons.map((person) => (
                <div
                  key={person.id}
                  className="card-hover flex flex-col items-center p-4 md:p-5 bg-white rounded-2xl border border-gray-100 shadow-sm"
                >
                  {avatars[person.id] && (
                    <img
                      src={avatars[person.id]}
                      alt={person.name}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover mb-3 border-2 border-gray-100"
                    />
                  )}
                  <p className="font-semibold text-sm text-center text-gray-800">
                    {person.name}
                  </p>
                  {person.bio && (
                    <p className="text-xs text-gray-400 text-center mt-1 line-clamp-2">
                      {person.bio}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
