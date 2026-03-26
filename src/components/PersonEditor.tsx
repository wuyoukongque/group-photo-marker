"use client";

import { useEffect, useRef } from "react";
import { Person } from "@/types";

interface PersonEditorProps {
  persons: Person[];
  selectedPersonId: string | null;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onDeletePerson: (id: string) => void;
  onSelectPerson: (id: string) => void;
}

export default function PersonEditor({
  persons,
  selectedPersonId,
  onUpdatePerson,
  onDeletePerson,
  onSelectPerson,
}: PersonEditorProps) {
  const selectedRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected person
  useEffect(() => {
    if (selectedPersonId && selectedRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const element = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Only scroll if element is not fully visible
      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedPersonId]);

  if (persons.length === 0) return null;

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-800">
          人物信息 <span className="text-gray-400 font-normal">({persons.length})</span>
        </h3>
      </div>
      <div ref={scrollContainerRef} className="max-h-[60vh] overflow-y-auto">
        {persons.map((person, index) => {
          const isSelected = person.id === selectedPersonId;
          return (
            <div
              key={person.id}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onSelectPerson(person.id)}
              className={`px-4 py-3 border-b border-gray-50 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-[var(--primary)]/10 border-l-[3px] border-l-[var(--primary)]"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`text-xs mt-2 w-5 shrink-0 font-bold ${
                  isSelected ? "text-[var(--primary)]" : "text-gray-400"
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => onUpdatePerson(person.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="姓名"
                    className={`w-full text-sm px-2.5 py-1.5 rounded-lg border focus:border-[var(--primary)] focus:outline-none transition-colors font-medium ${
                      isSelected
                        ? "border-[var(--primary)]/30 bg-white shadow-sm"
                        : "border-gray-200 bg-white"
                    }`}
                  />
                  <input
                    type="text"
                    value={person.bio}
                    onChange={(e) => onUpdatePerson(person.id, { bio: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="简介（职位、角色等）"
                    className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:border-[var(--primary)] focus:outline-none transition-colors ${
                      isSelected
                        ? "border-[var(--primary)]/30 bg-white shadow-sm"
                        : "border-gray-200 bg-white"
                    }`}
                  />
                  {person.libraryEntryId && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[var(--primary)] font-medium">
                      已匹配人脸库
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePerson(person.id);
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-2"
                  title="删除"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
