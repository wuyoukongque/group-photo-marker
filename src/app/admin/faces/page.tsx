"use client";

import { useState, useEffect, useCallback } from "react";

interface FaceEntry {
  id: string;
  name: string;
  bio: string;
  avatarDataUrl: string;
  createdAt: string;
}

export default function FaceLibraryAdmin() {
  const [entries, setEntries] = useState<FaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadEntries = useCallback(() => {
    fetch("/api/faces")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleEdit = (entry: FaceEntry) => {
    setEditingId(entry.id);
    setEditName(entry.name);
    setEditBio(entry.bio);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await fetch(`/api/faces/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, bio: editBio }),
    });
    setEditingId(null);
    loadEntries();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除 "${name}" 吗？`)) return;
    await fetch(`/api/faces/${id}`, { method: "DELETE" });
    loadEntries();
  };

  const filteredEntries = searchQuery
    ? entries.filter(
        (e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.bio.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-4"></div>
          <p className="text-gray-500">加载人脸库...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between">
          <h1 className="text-base md:text-lg font-bold text-[var(--primary)]">
            人脸库管理
          </h1>
          <a href="/" className="text-sm font-medium text-gray-500 hover:text-[var(--primary)] transition-colors">
            ← 返回首页
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8 animate-fade-in">
        {/* Stats */}
        <div className="mb-6">
          <p className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-800">{entries.length}</span> 人 · 标注过的人脸会自动匹配新照片
          </p>
        </div>

        {/* Search */}
        {entries.length > 0 && (
          <div className="mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索姓名或简介..."
              className="w-full px-4 py-2.5 rounded-full border border-gray-200 focus:border-[var(--primary)] focus:outline-none bg-white text-sm"
            />
          </div>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-1 font-medium">人脸库为空</p>
            <p className="text-sm text-gray-400">
              在编辑集体照时标注人物并保存到人脸库
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="card-hover bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="flex justify-center pt-5">
                  {entry.avatarDataUrl ? (
                    <img
                      src={entry.avatarDataUrl}
                      alt={entry.name}
                      className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-gray-100"
                    />
                  ) : (
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-50 flex items-center justify-center text-[var(--primary)] text-xl font-bold">
                      {entry.name?.[0] || "?"}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--primary)]"
                        placeholder="姓名"
                      />
                      <input
                        type="text"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--primary)]"
                        placeholder="简介"
                      />
                      <div className="flex gap-1.5">
                        <button onClick={handleSaveEdit} className="btn-primary flex-1 text-xs py-1.5">
                          保存
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-secondary flex-1 text-xs py-1.5">
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-sm text-center truncate text-gray-800">
                        {entry.name || "未命名"}
                      </p>
                      {entry.bio && (
                        <p className="text-xs text-gray-400 text-center mt-1 truncate">
                          {entry.bio}
                        </p>
                      )}
                      <div className="flex gap-1.5 mt-3">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="flex-1 text-xs px-2 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id, entry.name)}
                          className="flex-1 text-xs px-2 py-1.5 rounded-full bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 font-medium transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
