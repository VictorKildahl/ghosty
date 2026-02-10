"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/* ── Action button (hover-reveal icon button used inside rows) ───── */

export function RowActionButton({
  icon: Icon,
  activeIcon: ActiveIcon,
  active,
  label,
  variant = "default",
  onClick,
}: {
  icon: LucideIcon;
  /** Optional icon shown when `active` is true (e.g. a check mark). */
  activeIcon?: LucideIcon;
  active?: boolean;
  label: string;
  variant?: "default" | "danger";
  onClick: () => void;
}) {
  const Glyph = active && ActiveIcon ? ActiveIcon : Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 transition hover:cursor-pointer",
        variant === "danger"
          ? "text-muted hover:bg-red-50 hover:text-red-500"
          : active
            ? "text-ghosty"
            : "text-muted hover:bg-sidebar hover:text-ink",
      )}
      title={label}
    >
      <Glyph size={16} />
    </button>
  );
}

/* ── Generic data-table ──────────────────────────────────────────── */

export function DataTable<T extends { key: string }>({
  items,
  renderContent,
  renderActions,
  className,
}: {
  items: T[];
  /** Render the main content for each row. */
  renderContent: (item: T) => ReactNode;
  /** Render action buttons that appear on hover. */
  renderActions?: (item: T) => ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border border-border bg-white",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="group flex items-center gap-6 px-5 py-3 text-sm transition-colors hover:bg-sidebar"
        >
          {/* Content */}
          <div className="min-w-0 flex-1">{renderContent(item)}</div>

          {/* Actions — visible on hover */}
          {renderActions && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {renderActions(item)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
