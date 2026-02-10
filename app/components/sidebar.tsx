"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  Book,
  LayoutGrid,
  MessageSquare,
  Settings,
} from "lucide-react";
import { SidebarNavButton } from "./sidebar-nav-button";

export type View = "home" | "stats" | "style" | "dictionary" | "settings";

export function Sidebar({
  currentView,
  onNavigate,
  collapsed,
}: {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
}) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-54",
      )}
    >
      <div className="title-bar h-12 shrink-0" />
      <div className="flex items-center gap-2 overflow-hidden pb-6 pt-4 pl-5">
        <img
          src="assets/ghosty.png"
          alt="Ghosty"
          className="h-7 w-7 shrink-0"
        />
        <span
          className={cn(
            "truncate text-base font-semibold text-ink transition-opacity duration-200",
            collapsed ? "opacity-0" : "opacity-100",
          )}
        >
          GhostWriter
        </span>
      </div>

      <nav className={cn("flex flex-1 flex-col gap-1 px-3")}>
        <SidebarNavButton
          icon={LayoutGrid}
          label="Home"
          active={currentView === "home"}
          collapsed={collapsed}
          onClick={() => onNavigate("home")}
        />
        <SidebarNavButton
          icon={Book}
          label="Dictionary"
          active={currentView === "dictionary"}
          collapsed={collapsed}
          onClick={() => onNavigate("dictionary")}
        />
        <SidebarNavButton
          icon={BarChart3}
          label="Stats"
          active={currentView === "stats"}
          collapsed={collapsed}
          onClick={() => onNavigate("stats")}
        />
        <SidebarNavButton
          icon={MessageSquare}
          label="Style"
          active={currentView === "style"}
          collapsed={collapsed}
          onClick={() => onNavigate("style")}
        />
      </nav>

      <div className={cn("flex flex-col gap-1 pb-4 px-3")}>
        <SidebarNavButton
          icon={Settings}
          label="Settings"
          active={currentView === "settings"}
          collapsed={collapsed}
          onClick={() => onNavigate("settings")}
        />
      </div>
    </aside>
  );
}
