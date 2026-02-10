"use client";

import { useEffect, useRef, useState } from "react";

export function Header({
  userName,
  userEmail,
  onLogout,
}: {
  userName?: string;
  userEmail?: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = getInitials(userName, userEmail);

  return (
    <header className="title-bar flex h-12 shrink-0 items-center justify-end bg-sidebar px-4">
      {/* User avatar button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setOpen((v) => !v)}
          className="no-drag flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white transition hover:opacity-90"
          title={userEmail}
        >
          {initials}
        </button>

        {/* Dropdown popover */}
        {open && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-white p-4 shadow-lg"
          >
            {/* User info */}
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                {userName && (
                  <p className="truncate text-sm font-semibold text-ink">
                    {userName}
                  </p>
                )}
                {userEmail && (
                  <p className="truncate text-xs text-muted">{userEmail}</p>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-2">
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted transition hover:bg-gray-50 hover:text-ink"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3h-9m9 0l-3-3m3 3l-3 3"
                  />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "?";
}
