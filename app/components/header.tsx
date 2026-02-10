"use client";

import { AccountMenu } from "@/app/components/account-menu";

export function Header({
  userName,
  userEmail,
  onLogout,
}: {
  userName?: string;
  userEmail?: string;
  onLogout: () => void;
}) {
  return (
    <header className="title-bar flex h-12 shrink-0 items-center justify-end bg-sidebar px-4">
      <div className="no-drag">
        <AccountMenu
          userName={userName}
          userEmail={userEmail}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
