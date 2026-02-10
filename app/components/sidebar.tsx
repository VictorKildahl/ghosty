"use client";

import { cn } from "@/lib/utils";
import { BarChart3, LayoutGrid, MessageSquare, Settings } from "lucide-react";

export type View = "home" | "stats" | "style" | "settings";

export function Sidebar({
  currentView,
  onNavigate,
}: {
  currentView: View;
  onNavigate: (view: View) => void;
}) {
  return (
    <aside className="flex w-44 shrink-0 flex-col bg-sidebar">
      {/* Logo — extra top padding to clear macOS traffic lights */}
      <div className="title-bar flex items-center gap-2 px-5 pt-16 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="assets/ghosty.png" alt="Ghosty" className="h-7 w-7" />
        <span className="text-base font-semibold text-ink">GhostWriter</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        <button
          onClick={() => onNavigate("home")}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
            currentView === "home"
              ? "bg-white text-ink shadow-xs"
              : "text-muted hover:bg-white/60 hover:text-ink",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Home
        </button>
        <button
          onClick={() => onNavigate("stats")}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
            currentView === "stats"
              ? "bg-white text-ink shadow-xs"
              : "text-muted hover:bg-white/60 hover:text-ink",
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Stats
        </button>
        <button
          onClick={() => onNavigate("style")}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
            currentView === "style"
              ? "bg-white text-ink shadow-xs"
              : "text-muted hover:bg-white/60 hover:text-ink",
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Style
        </button>
      </nav>

      {/* Bottom: Settings + User */}
      <div className="flex flex-col gap-1 px-3 pb-4">
        <button
          onClick={() => onNavigate("settings")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
            currentView === "settings"
              ? "bg-white text-ink shadow-xs"
              : "text-muted hover:bg-white/60 hover:text-ink",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
