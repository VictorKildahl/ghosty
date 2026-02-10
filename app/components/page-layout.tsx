"use client";

import type { ReactNode } from "react";

export function PageLayout({
  title,
  subtitle,
  headerRight,
  headerExtra,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Content rendered to the right of the title (e.g. stats badges). */
  headerRight?: ReactNode;
  /** Extra content rendered below the title row but still inside the sticky header. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Sticky header */}
      <header className="shrink-0 px-8 pt-8 pb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          {headerRight}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        {headerExtra}
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
    </div>
  );
}
