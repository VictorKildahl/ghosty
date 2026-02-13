"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Book,
  Check,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AddWordModal } from "./add-word-modal";
import { DataTable, RowActionButton } from "./data-table";
import { PageLayout } from "./page-layout";

/* ── Example pills shown in the intro banner ───────────────────────── */
const EXAMPLE_PILLS = [
  "Q3 Roadmap",
  "Ghostwriter → GhostWriter",
  "Figma Jam",
  "Company name",
];

/* ── Types for the edit modal state ────────────────────────────────── */

type EditState = {
  entryId: Id<"dictionaryEntries">;
  word: string;
  isCorrection: boolean;
  misspelling?: string;
};

/* ── Main Dictionary View ──────────────────────────────────────────── */

export function DictionaryView({ userId }: { userId: Id<"users"> }) {
  const entries = useQuery(api.dictionary.list, { userId });
  const addEntry = useMutation(api.dictionary.add);
  const updateEntry = useMutation(api.dictionary.update);
  const removeEntry = useMutation(api.dictionary.remove);
  const acceptEntry = useMutation(api.dictionary.accept);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  // Sync dictionary to local file so the AI main process can access it
  useEffect(() => {
    if (!entries || !window.ghostwriter) return;
    window.ghostwriter
      .syncDictionary(
        entries.map((e) => ({
          id: e._id,
          word: e.word,
          isCorrection: e.isCorrection,
          misspelling: e.misspelling,
          createdAt: e.createdAt,
        })),
      )
      .catch(() => undefined);
  }, [entries]);

  const handleAdd = useCallback(
    async (entry: {
      word: string;
      isCorrection: boolean;
      misspelling?: string;
    }) => {
      await addEntry({ userId, ...entry });
      setShowAddModal(false);
    },
    [addEntry, userId],
  );

  const handleEdit = useCallback(
    async (entry: {
      word: string;
      isCorrection: boolean;
      misspelling?: string;
    }) => {
      if (!editState) return;
      await updateEntry({ entryId: editState.entryId, ...entry });
      setEditState(null);
    },
    [updateEntry, editState],
  );

  const handleDelete = useCallback(
    async (entryId: Id<"dictionaryEntries">) => {
      await removeEntry({ entryId });
    },
    [removeEntry],
  );

  const handleAccept = useCallback(
    async (entryId: Id<"dictionaryEntries">) => {
      await acceptEntry({ entryId });
    },
    [acceptEntry],
  );

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.word.toLowerCase().includes(q) ||
        (e.misspelling && e.misspelling.toLowerCase().includes(q)),
    );
  }, [entries, searchQuery]);

  const tableItems = useMemo(
    () => filteredEntries.map((e) => ({ key: e._id, ...e })),
    [filteredEntries],
  );

  const totalCount = entries?.length ?? 0;

  return (
    <PageLayout
      title="Dictionary"
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

          <h2 className="text-xl font-semibold text-ink">
            GhostWriter speaks the way you speak.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/80">
            GhostWriter learns your unique words and names - automatically or
            manually.{" "}
            <span className="font-semibold">
              Add personal terms, company jargon, client names, or
              industry-specific lingo.
            </span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_PILLS.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-ink"
              >
                {pill}
              </span>
            ))}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
          >
            Add new word
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
              placeholder="Search dictionary…"
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
              {totalCount} {totalCount === 1 ? "word" : "words"}
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
            <Book className="h-6 w-6 text-muted" />
          </div>
          {totalCount === 0 ? (
            <>
              <p className="text-sm font-medium text-ink">No words yet</p>
              <p className="mt-1 text-sm text-muted">
                Add words, names, and terms for better transcription accuracy.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
              >
                <Plus className="h-4 w-4" />
                Add your first word
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">
              No words match &quot;{searchQuery}&quot;
            </p>
          )}
        </div>
      ) : (
        <DataTable
          items={tableItems}
          renderContent={(item) => (
            <span className="flex items-center gap-1.5 text-sm text-ink">
              {item.isCorrection && item.misspelling ? (
                <>
                  {item.misspelling} <span className="text-muted">→</span>{" "}
                  {item.word}
                </>
              ) : (
                item.word
              )}
              {item.autoAdded && (
                <span
                  title="GhostWriter auto-learned from your edits"
                  className="inline-flex items-center gap-0.5 px-1.5  text-[10px] font-medium text-purple-600"
                >
                  <Sparkles className="h-3 w-3" />
                </span>
              )}
            </span>
          )}
          renderActions={(item) => (
            <>
              {item.autoAdded && (
                <RowActionButton
                  icon={Check}
                  label="Accept word"
                  onClick={() => handleAccept(item._id)}
                />
              )}
              <RowActionButton
                icon={Pencil}
                label="Edit entry"
                onClick={() =>
                  setEditState({
                    entryId: item._id,
                    word: item.word,
                    isCorrection: item.isCorrection,
                    misspelling: item.misspelling,
                  })
                }
              />
              <RowActionButton
                icon={Trash2}
                label="Delete entry"
                variant="danger"
                onClick={() => handleDelete(item._id)}
              />
            </>
          )}
        />
      )}

      {/* Add modal */}
      <AddWordModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />

      {/* Edit modal */}
      <AddWordModal
        open={editState !== null}
        onClose={() => setEditState(null)}
        onAdd={handleEdit}
        initialWord={editState?.word}
        initialMisspelling={editState?.misspelling}
        initialIsCorrection={editState?.isCorrection}
      />
    </PageLayout>
  );
}
