"use client";

import { useState, useEffect, useCallback } from "react";

interface ProjectSummary {
  id: string;
  title: string;
  editToken: string;
  personsCount: number;
  namedCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch {
      alert("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (project: ProjectSummary) => {
    if (!confirm(`确定删除「${project.title}」吗？此操作不可恢复。`)) return;
    try {
      const res = await fetch(
        `/api/projects/${project.id}?token=${encodeURIComponent(project.editToken)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("删除失败");
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch {
      alert("删除失败");
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    alert("链接已复制");
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/">
              <img src="/images/logo-blue.png" alt="MindsLeap" className="h-7" />
            </a>
            <span className="text-sm font-medium text-gray-500">项目管理</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/faces" className="text-sm text-gray-500 hover:text-[var(--primary)] transition-colors">
              人脸库
            </a>
            <a href="/" className="btn-primary text-xs px-4 py-1.5">
              新建项目
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-4"></div>
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">暂无项目</p>
            <a href="/" className="btn-primary px-6 py-2 text-sm inline-block">创建第一个项目</a>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{project.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>检测 {project.personsCount} 人</span>
                    <span>标注 {project.namedCount} 人</span>
                    <span>创建 {formatDate(project.createdAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      copyLink(`${window.location.origin}/view/${project.id}`)
                    }
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    分享链接
                  </button>
                  <button
                    onClick={() =>
                      copyLink(
                        `${window.location.origin}/edit/${project.id}?token=${project.editToken}`
                      )
                    }
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    编辑链接
                  </button>
                  <a
                    href={`/edit/${project.id}?token=${project.editToken}`}
                    className="btn-secondary text-xs px-3 py-1.5 inline-flex"
                  >
                    编辑
                  </a>
                  <button
                    onClick={() => handleDelete(project)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
