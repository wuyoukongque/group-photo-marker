"use client";

import { useState, useCallback, useEffect, useRef, use } from "react";
import { useSearchParams } from "next/navigation";
import { Person } from "@/types";
import FaceDetector from "@/components/FaceDetector";
import PersonEditor from "@/components/PersonEditor";

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const editToken = searchParams.get("token") || "";

  const [imageDataUrl, setImageDataUrl] = useState("");
  const [persons, setPersons] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [showNames, setShowNames] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastEditTimeRef = useRef(0);
  const serverUpdatedAtRef = useRef("");
  const hasUnsavedRef = useRef(false);

  // Load project
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
        serverUpdatedAtRef.current = data.updatedAt || "";
        setLoading(false);
        setShareUrl(`${window.location.origin}/view/${id}`);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Poll for updates
  useEffect(() => {
    if (loading || error) return;
    const interval = setInterval(() => {
      if (hasUnsavedRef.current) return;
      if (Date.now() - lastEditTimeRef.current < 3000) return;
      fetch(`/api/projects/${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.updatedAt && data.updatedAt !== serverUpdatedAtRef.current) {
            serverUpdatedAtRef.current = data.updatedAt;
            setTitle(data.title || "");
            setPersons(data.persons || []);
            setShowNames(data.showNames ?? true);
            setHasUnsaved(false);
            hasUnsavedRef.current = false;
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [id, loading, error]);

  // Update page title
  useEffect(() => {
    document.title = title ? `编辑 - ${title}` : "编辑 - 集体照标注工具";
  }, [title]);

  // Load image for avatar extraction
  useEffect(() => {
    if (!imageDataUrl) return;
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

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

  const handleSaveToLibrary = useCallback(async () => {
    const newFaces = persons.filter((p) => p.name && p.descriptor && !p.libraryEntryId);
    if (newFaces.length === 0) {
      alert("没有新的已命名人物需要保存到人脸库");
      return;
    }
    if (!confirm(`将 ${newFaces.length} 个新人物保存到人脸库？`)) return;
    setSavingToLibrary(true);
    let saved = 0;
    let skipped = 0;
    const updatedPersons = [...persons];
    for (const person of newFaces) {
      const avatar = getAvatar(person);
      const res = await fetch("/api/faces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: person.name,
          bio: person.bio,
          avatarDataUrl: avatar,
          descriptor: person.descriptor,
        }),
      });
      const result = await res.json();
      // Update person's libraryEntryId (whether new or existing duplicate)
      const idx = updatedPersons.findIndex((p) => p.id === person.id);
      if (idx !== -1 && result.id) {
        updatedPersons[idx] = { ...updatedPersons[idx], libraryEntryId: result.id };
      }
      if (result.skipped) {
        skipped++;
      } else {
        saved++;
      }
    }
    // Write back libraryEntryId to project data
    setPersons(updatedPersons);
    setHasUnsaved(true);
    hasUnsavedRef.current = true;
    setSavingToLibrary(false);
    const msg = skipped > 0
      ? `新增 ${saved} 人，${skipped} 人已在人脸库中`
      : `已将 ${saved} 个人物保存到人脸库`;
    alert(msg + "，请点击保存同步项目数据");
  }, [persons, getAvatar]);

  const markEdited = useCallback(() => {
    setHasUnsaved(true);
    hasUnsavedRef.current = true;
    setSaveSuccess(false);
    lastEditTimeRef.current = Date.now();
  }, []);

  const handleSave = useCallback(async () => {
    if (!editToken) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken, title, persons, showNames }),
      });
      if (!res.ok) throw new Error("保存失败");
      setLastSaved(new Date().toLocaleTimeString());
      setHasUnsaved(false);
      hasUnsavedRef.current = false;
      setSaveSuccess(true);
      const freshData = await fetch(`/api/projects/${id}`).then((r) => r.json());
      serverUpdatedAtRef.current = freshData.updatedAt || "";
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }, [id, editToken, title, persons, showNames]);

  const handlePersonsDetected = useCallback((newPersons: Person[]) => {
    setPersons(newPersons);
    setHasUnsaved(true);
    hasUnsavedRef.current = true;
    lastEditTimeRef.current = Date.now();
    if (newPersons.length > 0) setSelectedPersonId(newPersons[0].id);
  }, []);

  const feishuMatchTimer = useRef<NodeJS.Timeout | null>(null);

  const handleUpdatePerson = useCallback(
    (id: string, updates: Partial<Person>) => {
      setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      markEdited();

      // Auto-match company info from Feishu when name changes
      if (updates.name && updates.name.length >= 2) {
        if (feishuMatchTimer.current) clearTimeout(feishuMatchTimer.current);
        feishuMatchTimer.current = setTimeout(async () => {
          try {
            const res = await fetch("/api/feishu/match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ names: [updates.name] }),
            });
            const { results } = await res.json();
            const match = results?.[updates.name!];
            if (match) {
              const bio = [match.company, match.role].filter(Boolean).join(" · ");
              if (bio) {
                setPersons((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, bio } : p))
                );
                markEdited();
              }
            }
          } catch {}
        }, 500);
      }
    },
    [markEdited]
  );

  const handleDeletePerson = useCallback(
    (id: string) => {
      setPersons((prev) => prev.filter((p) => p.id !== id));
      if (selectedPersonId === id) setSelectedPersonId(null);
      markEdited();
    },
    [selectedPersonId, markEdited]
  );

  const copyShareLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => alert("分享链接已复制"));
  }, [shareUrl]);

  const copyEditLink = useCallback(() => {
    const editUrl = `${window.location.origin}/edit/${id}?token=${editToken}`;
    navigator.clipboard.writeText(editUrl).then(() => alert("编辑链接已复制（含编辑权限）"));
  }, [id, editToken]);

  const newFacesCount = persons.filter((p) => p.name && p.descriptor && !p.libraryEntryId).length;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-4"></div>
          <p className="text-gray-500">加载项目中...</p>
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

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 md:h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <a href="/" className="shrink-0">
                <img src="/images/logo-blue.png" alt="MindsLeap" className="h-7" />
              </a>
              {lastSaved && (
                <span className="text-xs text-gray-400 hidden sm:inline">
                  保存于 {lastSaved}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyEditLink} className="btn-secondary text-xs px-3 py-1.5 hidden sm:inline-flex">
                编辑链接
              </button>
              <button onClick={copyShareLink} className="btn-secondary text-xs px-3 py-1.5">
                分享链接
              </button>
              {newFacesCount > 0 && (
                <button
                  onClick={handleSaveToLibrary}
                  disabled={savingToLibrary}
                  className="btn-secondary text-xs px-3 py-1.5 text-[var(--primary)] border-[var(--primary)]/30"
                >
                  {savingToLibrary ? "保存中..." : `存入人脸库 (${newFacesCount})`}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsaved}
                className={`btn-primary text-xs px-4 py-1.5 ${
                  saveSuccess
                    ? "!bg-green-500"
                    : !hasUnsaved
                      ? "!opacity-40 !cursor-not-allowed"
                      : ""
                }`}
              >
                {saving ? "保存中..." : saveSuccess ? "已保存" : hasUnsaved ? "保存" : "已保存"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
        {/* Title */}
        <div className="mb-4 md:mb-6">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markEdited(); }}
            placeholder="输入活动主题（如：2024年度团队合影）"
            className="w-full text-base md:text-lg px-4 py-3 rounded-2xl border border-gray-200 focus:border-[var(--primary)] focus:outline-none transition-colors bg-white font-medium"
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Photo */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:p-4">
              <FaceDetector
                imageDataUrl={imageDataUrl}
                persons={persons}
                onPersonsDetected={handlePersonsDetected}
                onPersonSelect={setSelectedPersonId}
                selectedPersonId={selectedPersonId}
                showNames={showNames}
              />
            </div>
            <div className="mt-3 px-1">
              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNames}
                  onChange={(e) => { setShowNames(e.target.checked); markEdited(); }}
                  className="rounded accent-[var(--primary)]"
                />
                在照片上显示姓名
              </label>
            </div>
          </div>

          {/* Person list */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <PersonEditor
                persons={persons}
                selectedPersonId={selectedPersonId}
                onUpdatePerson={handleUpdatePerson}
                onDeletePerson={handleDeletePerson}
                onSelectPerson={setSelectedPersonId}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
