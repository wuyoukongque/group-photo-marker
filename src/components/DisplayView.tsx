"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Person } from "@/types";

interface DisplayViewProps {
  title: string;
  imageDataUrl: string;
  persons: Person[];
  showNames: boolean;
  onToggleNames: () => void;
  onBack: () => void;
}

export default function DisplayView({
  title,
  imageDataUrl,
  persons,
  showNames,
  onToggleNames,
  onBack,
}: DisplayViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
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
    const containerWidth = containerRef.current.clientWidth;
    const scale = Math.min(1, containerWidth / imgSize.w);
    setDisplaySize({
      w: Math.round(imgSize.w * scale),
      h: Math.round(imgSize.h * scale),
    });
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

      // Circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Name label
      const fontSize = Math.max(11, r * 0.35);
      ctx.font = `${fontSize}px -apple-system, sans-serif`;
      const textWidth = ctx.measureText(person.name).width;
      const labelX = cx - textWidth / 2;
      const labelY = cy + r + fontSize + 4;

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const padding = 3;
      ctx.beginPath();
      ctx.roundRect(
        labelX - padding,
        labelY - fontSize - 1,
        textWidth + padding * 2,
        fontSize + padding * 2,
        3
      );
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(person.name, labelX, labelY);
    });
  }, [persons, displaySize, imgSize, showNames]);

  useEffect(() => {
    if (imgLoaded) draw();
  }, [draw, imgLoaded]);

  // Extract avatar from image
  const getAvatar = useCallback(
    (person: Person): string => {
      const img = imgRef.current;
      if (!img) return "";

      const avatarCanvas = document.createElement("canvas");
      const size = 120;
      avatarCanvas.width = size;
      avatarCanvas.height = size;
      const ctx = avatarCanvas.getContext("2d")!;

      const sx = person.x * img.naturalWidth - person.radius * img.naturalWidth;
      const sy =
        person.y * img.naturalHeight - person.radius * img.naturalWidth;
      const sSize = person.radius * img.naturalWidth * 2;

      // Clip to circle
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);

      return avatarCanvas.toDataURL("image/jpeg", 0.8);
    },
    []
  );

  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!imgLoaded) return;
    const newAvatars: Record<string, string> = {};
    persons.forEach((p) => {
      newAvatars[p.id] = getAvatar(p);
    });
    setAvatars(newAvatars);
  }, [imgLoaded, persons, getAvatar]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← 返回编辑
        </button>
        <button
          onClick={onToggleNames}
          className="text-sm px-4 py-2 rounded-lg bg-white border border-[var(--border)] hover:bg-gray-50 transition-colors"
        >
          {showNames ? "隐藏标注" : "显示标注"}
        </button>
      </div>

      {/* Title */}
      {title && (
        <h1 className="text-2xl font-bold text-center mb-6">{title}</h1>
      )}

      {/* Photo */}
      <div ref={containerRef} className="flex justify-center mb-8">
        <canvas ref={canvasRef} className="rounded-xl shadow-lg max-w-full" />
      </div>

      {/* Person cards */}
      {persons.some((p) => p.name) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {persons
            .filter((p) => p.name)
            .map((person) => (
              <div
                key={person.id}
                className="flex flex-col items-center p-4 bg-white rounded-xl border border-[var(--border)] shadow-sm"
              >
                {avatars[person.id] && (
                  <img
                    src={avatars[person.id]}
                    alt={person.name}
                    className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-gray-100"
                  />
                )}
                <p className="font-medium text-sm text-center">
                  {person.name}
                </p>
                {person.bio && (
                  <p className="text-xs text-gray-400 text-center mt-1">
                    {person.bio}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
