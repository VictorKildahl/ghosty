"use client";

import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Pencil,
  Plus,
  Scissors,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AddSnippetModal } from "./add-snippet-modal";
import { DataTable, RowActionButton } from "./data-table";
import { PageLayout } from "./page-layout";

/* ── Example pills shown in the intro banner ───────────────────────── */
const EXAMPLE_SNIPPETS = [
  {
    snippet: "LinkedIn",
    expansion: "https://www.linkedin.com/in/victorkildahl/",
  },
  {
    snippet: "intro email",
    expansion: "Hey, would love to find some time to chat later...",
  },
  {
    snippet: "my address",
    expansion: "123 Main Street, Apt 4B, San Francisco, CA 94102",
  },
];

/* ── Types for the edit modal state ────────────────────────────────── */
type EditState = {
  entryId: Id<"snippetEntries">;
  snippet: string;
  expansion: string;
};

/* ── Main Snippets View ────────────────────────────────────────────── */

export function SnippetsView({ userId }: { userId: Id<"users"> }) {
  const entries = useQuery(api.snippets.list, { userId });
  const addEntry = useMutation(api.snippets.add);
  const updateEntry = useMutation(api.snippets.update);
  const removeEntry = useMutation(api.snippets.remove);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  // Sync snippets to local file so the main process can access them
  useEffect(() => {
    if (!entries || !window.ghosttype) return;
    window.ghosttype
      .syncSnippets(
        entries.map((e) => ({
          id: e._id,
          snippet: e.snippet,
          expansion: e.expansion,
          createdAt: e.createdAt,
        })),
      )
      .catch(() => undefined);
  }, [entries]);

  const handleAdd = useCallback(
    async (entry: { snippet: string; expansion: string }) => {
      await addEntry({ userId, ...entry });
      setShowAddModal(false);
    },
    [addEntry, userId],
  );

  const handleEdit = useCallback(
    async (entry: { snippet: string; expansion: string }) => {
      if (!editState) return;
      await updateEntry({ entryId: editState.entryId, ...entry });
      setEditState(null);
    },
    [updateEntry, editState],
  );

  const handleDelete = useCallback(
    async (entryId: Id<"snippetEntries">) => {
      await removeEntry({ entryId });
    },
    [removeEntry],
  );

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.snippet.toLowerCase().includes(q) ||
        e.expansion.toLowerCase().includes(q),
    );
  }, [entries, searchQuery]);

  const tableItems = useMemo(
    () => filteredEntries.map((e) => ({ key: e._id, ...e })),
    [filteredEntries],
  );

  const totalCount = entries?.length ?? 0;

  return (
    <PageLayout
      title="Snippets"
      headerRight={
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
        >
          Add new
        </button>
      }
    >
      {/* Intro banner */}
      {showBanner && (
        <div className="relative mb-6 rounded-2xl bg-parchment/60 px-6 py-5">
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>

          <h2 className="font-serif text-2xl italic text-ink">
            The stuff you shouldn&apos;t have to re-type.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/80">
            Save shortcuts to speak the things you type all the time - emails,
            links, addresses, bios - anything.{" "}
            <span className="font-semibold">
              Just speak and GhostWriter expands them instantly
            </span>
            , without retyping or hunting through old messages.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {EXAMPLE_SNIPPETS.map((ex) => (
              <div key={ex.snippet} className="flex items-center gap-3">
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-ink">
                  {ex.snippet}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs text-ink/70">
                  {ex.expansion}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
          >
            Add new snippet
          </button>
        </div>
      )}

      {/* Search + count bar */}
      <div className="mb-4 flex items-center gap-2">
        {showSearch ? (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search snippets…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-8 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium text-ink">
              {totalCount} {totalCount === 1 ? "snippet" : "snippets"}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setShowSearch(true)}
              className="rounded-md p-1.5 text-muted transition-colors hover:text-ink"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Entries list */}
      {tableItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-parchment/60">
            <Scissors className="h-6 w-6 text-muted" />
          </div>
          {totalCount === 0 ? (
            <>
              <p className="text-sm font-medium text-ink">No snippets yet</p>
              <p className="mt-1 text-sm text-muted">
                Add shortcuts for text you type all the time.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
              >
                <Plus className="h-4 w-4" />
                Add your first snippet
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">
              No snippets match &quot;{searchQuery}&quot;
            </p>
          )}
        </div>
      ) : (
        <DataTable
          items={tableItems}
          renderContent={(item) => (
            <span className="text-sm text-ink">
              {item.snippet} <span className="text-muted">→</span>{" "}
              <span className="text-ink/70">{item.expansion}</span>
            </span>
          )}
          renderActions={(item) => (
            <>
              <RowActionButton
                icon={Pencil}
                label="Edit snippet"
                onClick={() =>
                  setEditState({
                    entryId: item._id,
                    snippet: item.snippet,
                    expansion: item.expansion,
                  })
                }
              />
              <RowActionButton
                icon={Trash2}
                label="Delete snippet"
                variant="danger"
                onClick={() => handleDelete(item._id)}
              />
            </>
          )}
        />
      )}

      {/* Add modal */}
      <AddSnippetModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />

      {/* Edit modal */}
      <AddSnippetModal
        open={editState !== null}
        onClose={() => setEditState(null)}
        onAdd={handleEdit}
        initialSnippet={editState?.snippet}
        initialExpansion={editState?.expansion}
      />
    </PageLayout>
  );
}
