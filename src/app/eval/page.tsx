'use client';

import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { LocalStorageEvalStore } from '@/lib/eval/store';
import { scheduleDelete, type PendingDelete } from '@/lib/eval/undo-delete';
import { promptVariants, promptInputFromRow } from '@/lib/eval/prompts';
import type { EvalRow, PromptVariant, Strategy } from '@/lib/eval/types';

export default function EvalPage() {
  const { toast } = useToast();

  // Store is created inside useEffect — localStorage is unavailable during SSR.
  const [store, setStore] = useState<LocalStorageEvalStore | null>(null);
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [editingRow, setEditingRow] = useState<EvalRow | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');

  // Holds the "most recent pending undo" so Cmd/Ctrl+Z can trigger it.
  // Only the latest delete is undoable via keyboard — earlier pending deletes
  // still commit on their own 6s timer.
  const undoRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const s = new LocalStorageEvalStore();
    setStore(s);
    s.getRows().then(setRows);
    if (s.consumeV1WipeNotice()) {
      toast({
        title: 'Eval framework upgraded to v2',
        description: 'Previous data was reset. Seed examples loaded.',
      });
    }
  }, [toast]);

  // Global Cmd/Ctrl+Z handler for undoing the most recent pending delete.
  // Skips when focus is inside an input/textarea/contenteditable so users
  // can still use the browser's native text undo while editing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (!undoRef.current) return;
      e.preventDefault();
      undoRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleSaveRow(updated: EvalRow) {
    if (!store) return;
    await store.saveRow(updated);
    setRows(await store.getRows());
    setEditingRow(null);
  }

  function handleDeleteRow(row: EvalRow) {
    if (!store) return;
    // Optimistic remove from state.
    setRows(current => current.filter(r => r.id !== row.id));

    // Guard: clicking Undo (or pressing Cmd/Ctrl+Z) twice must not restore twice.
    let undone = false;
    // Set inside toast() below, referenced by doUndo. Declared up front so
    // doUndo can close over the (eventually-defined) dismiss handle.
    let dismiss: () => void = () => {};

    // Schedule the actual store delete for 6s later.
    const pending: PendingDelete<EvalRow> = scheduleDelete(
      row,
      async () => {
        // Timer fired: clear the keyboard-undo slot if it still points at us.
        if (undoRef.current === doUndo) undoRef.current = null;
        await store.deleteRow(row.id);
        await store.deleteResultsForRow(row.id);
      },
    );

    const doUndo = () => {
      if (undone) return;
      undone = true;
      pending.cancel();
      // Only re-add if the row isn't somehow already back in state.
      setRows(current =>
        current.some(r => r.id === row.id) ? current : [...current, row],
      );
      // Close the toast so the user sees the restore took effect.
      dismiss();
      if (undoRef.current === doUndo) undoRef.current = null;
    };

    // Make this the latest undoable action — Cmd/Ctrl+Z will trigger doUndo.
    undoRef.current = doUndo;

    const handle = toast({
      title: `Deleted "${row.label}"`,
      description: 'Press ⌘Z / Ctrl+Z or click Undo to restore.',
      action: (
        <button className="underline text-sm" onClick={doUndo}>
          Undo
        </button>
      ),
    });
    dismiss = handle.dismiss;
  }

  function handleNewRow() {
    setEditingRow({
      id: `row-${Date.now()}`,
      label: 'New row',
      profileA: '',
      profileB: '',
      expected: { score: 50, reasoning: '' },
      tags: [],
    });
  }

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

  useEffect(() => {
    if (!store) return;
    store.getStrategies().then(setStrategies);
  }, [store]);

  async function handleSaveStrategy(updated: Strategy) {
    if (!store) return;
    await store.saveStrategy(updated);
    setStrategies(await store.getStrategies());
    setEditingStrategy(null);
  }

  function handleDeleteStrategy(s: Strategy) {
    if (!store) return;
    // Optimistic remove from state.
    setStrategies(current => current.filter(x => x.id !== s.id));

    // Guard: clicking Undo (or pressing Cmd/Ctrl+Z) twice must not restore twice.
    let undone = false;
    // Set inside toast() below, referenced by doUndo. Declared up front so
    // doUndo can close over the (eventually-defined) dismiss handle.
    let dismiss: () => void = () => {};

    // Schedule the actual store delete for 6s later.
    const pending: PendingDelete<Strategy> = scheduleDelete(
      s,
      async () => {
        // Timer fired: clear the keyboard-undo slot if it still points at us.
        if (undoRef.current === doUndo) undoRef.current = null;
        await store.deleteStrategy(s.id);
        await store.deleteResultsForStrategy(s.id);
      },
    );

    const doUndo = () => {
      if (undone) return;
      undone = true;
      pending.cancel();
      // Only re-add if the strategy isn't somehow already back in state.
      setStrategies(current =>
        current.some(x => x.id === s.id) ? current : [...current, s],
      );
      // Close the toast so the user sees the restore took effect.
      dismiss();
      if (undoRef.current === doUndo) undoRef.current = null;
    };

    // Make this the latest undoable action — Cmd/Ctrl+Z will trigger doUndo.
    undoRef.current = doUndo;

    const handle = toast({
      title: `Deleted "${s.name}"`,
      description: 'Press ⌘Z / Ctrl+Z or click Undo to restore.',
      action: (
        <button className="underline text-sm" onClick={doUndo}>
          Undo
        </button>
      ),
    });
    dismiss = handle.dismiss;
  }

  function handleNewStrategy() {
    setEditingStrategy({
      id: `strategy-${Date.now()}`,
      name: 'New Strategy',
      model: 'google/gemini-2.5-flash',
      promptVariant: 'default',
      runCount: 1,
    });
  }

  // Derive the visible rows from tag + search filters.
  const visibleRows = rows.filter(r => {
    if (tagFilter && !r.tags.includes(tagFilter)) return false;
    if (searchText && !r.label.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  // Collect all tags for the filter dropdown.
  const allTags = Array.from(new Set(rows.flatMap(r => r.tags))).sort();

  return (
    <div className="max-w-6xl mx-auto p-6 pt-20 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white">Find-Matches Eval v2</h1>
        <p className="text-white/60">
          Compare LLMs, prompts, and strategies against labeled pairwise profiles.
        </p>
      </header>

      <Tabs defaultValue="dataset">
        <TabsList>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="dataset" className="mt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleNewRow}>+ New Row</Button>
            <Input
              placeholder="Search labels..."
              className="max-w-xs"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <select
              className="border rounded px-3 py-2 bg-background text-sm"
              value={tagFilter ?? ''}
              onChange={e => setTagFilter(e.target.value || null)}
            >
              <option value="">All tags</option>
              {allTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="text-sm text-white/60 ml-auto">
              {visibleRows.length} / {rows.length} rows
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visibleRows.map(r => (
              <Card
                key={r.id}
                id={`row-${r.id}`}
                className="p-4 cursor-pointer hover:border-white/30 transition-colors"
                onClick={() => setEditingRow(r)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold">{r.label}</div>
                  <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                    {r.tags.map(t => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-white/50">Profile A</div>
                    <div className="line-clamp-3">{r.profileA}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-white/50">Profile B</div>
                    <div className="line-clamp-3">{r.profileB}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="text-2xl font-black">{r.expected.score}</div>
                  <div className="text-xs italic text-white/60 flex-1 line-clamp-2">{r.expected.reasoning}</div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteRow(r);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {visibleRows.length === 0 && (
            <div className="text-center text-white/40 py-12">
              {rows.length === 0 ? 'No rows yet. Click "+ New Row" to add one.' : 'No rows match the current filter.'}
            </div>
          )}
        </TabsContent>

        <TabsContent value="strategies" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/60">{strategies.length} strategies</div>
            <Button onClick={handleNewStrategy}>+ Add Strategy</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map(s => (
              <Card key={s.id} id={`strategy-${s.id}`} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs font-mono text-white/60">{s.model}</div>
                    <div className="text-xs text-white/50 mt-1">
                      prompt: {s.promptVariant} · runCount: {s.runCount}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingStrategy(s)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteStrategy(s)}>Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="run">Run tab (Tasks 12-13)</TabsContent>
        <TabsContent value="results">Results tab (Task 14)</TabsContent>
      </Tabs>

      <EditRowDialog
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveRow}
      />

      <EditStrategyDialog
        strategy={editingStrategy}
        onClose={() => setEditingStrategy(null)}
        onSave={handleSaveStrategy}
      />
    </div>
  );
}

function EditRowDialog({
  row,
  onClose,
  onSave,
}: {
  row: EvalRow | null;
  onClose: () => void;
  onSave: (r: EvalRow) => void;
}) {
  const [draft, setDraft] = useState<EvalRow | null>(null);
  const [promptVariant, setPromptVariant] = useState<PromptVariant>('default');
  const [newTag, setNewTag] = useState<string>('');

  useEffect(() => {
    setDraft(row);
    setPromptVariant('default');
    setNewTag('');
  }, [row]);

  if (!draft) return null;

  const promptPreview = promptVariants[promptVariant](promptInputFromRow(draft));

  function addTag() {
    if (!draft || !newTag.trim()) return;
    if (draft.tags.includes(newTag.trim())) return;
    setDraft({ ...draft, tags: [...draft.tags, newTag.trim()] });
    setNewTag('');
  }

  function removeTag(tag: string) {
    if (!draft) return;
    setDraft({ ...draft, tags: draft.tags.filter(t => t !== tag) });
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            <Input
              value={draft.label}
              onChange={e => setDraft({ ...draft, label: e.target.value })}
              className="text-lg font-bold"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {draft.tags.map(t => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                  <button
                    className="ml-1 text-white/50 hover:text-white"
                    onClick={() => removeTag(t)}
                  >×</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="add tag"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="max-w-xs"
              />
              <Button size="sm" variant="outline" onClick={addTag}>Add</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase">Profile A</label>
              <textarea
                className="w-full border rounded p-2 bg-background min-h-[160px]"
                value={draft.profileA}
                onChange={e => setDraft({ ...draft, profileA: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase">Profile B</label>
              <textarea
                className="w-full border rounded p-2 bg-background min-h-[160px]"
                value={draft.profileB}
                onChange={e => setDraft({ ...draft, profileB: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <div>
              <label className="text-xs font-bold uppercase">Expected Score</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.expected.score}
                onChange={e => {
                  const raw = Number(e.target.value);
                  const clamped = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
                  setDraft({ ...draft, expected: { ...draft.expected, score: clamped } });
                }}
                className="w-24"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase">Expected Reasoning</label>
              <textarea
                className="w-full border rounded p-2 bg-background min-h-[60px]"
                value={draft.expected.reasoning}
                onChange={e =>
                  setDraft({ ...draft, expected: { ...draft.expected, reasoning: e.target.value } })
                }
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-1">
              <label className="text-xs font-bold uppercase">Prompt preview (read-only)</label>
              <select
                className="border rounded px-2 py-1 text-xs bg-background"
                value={promptVariant}
                onChange={e => setPromptVariant(e.target.value as PromptVariant)}
              >
                <option value="default">default</option>
                <option value="simplified">simplified</option>
              </select>
            </div>
            <pre className="border rounded p-3 bg-black/40 text-xs whitespace-pre-wrap font-mono max-h-[200px] overflow-auto">
              {promptPreview}
            </pre>
            <div className="text-xs text-white/40 mt-1">
              To edit prompts, modify <code>src/lib/eval/prompts.ts</code>. UI prompt editing is deferred to v2.1.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const KNOWN_MODELS = [
  'google/gemini-2.5-flash',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3-8b-instruct',
];

function EditStrategyDialog({
  strategy,
  onClose,
  onSave,
}: {
  strategy: Strategy | null;
  onClose: () => void;
  onSave: (s: Strategy) => void;
}) {
  const [draft, setDraft] = useState<Strategy | null>(null);
  useEffect(() => setDraft(strategy), [strategy]);

  if (!draft) return null;

  return (
    <Dialog open={!!strategy} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Strategy</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase">Name</label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase">Model (OpenRouter ID)</label>
            <select
              className="w-full border rounded p-2 bg-background"
              value={draft.model}
              onChange={e => setDraft({ ...draft, model: e.target.value })}
            >
              {KNOWN_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase">Prompt variant</label>
            <select
              className="w-full border rounded p-2 bg-background"
              value={draft.promptVariant}
              onChange={e => setDraft({ ...draft, promptVariant: e.target.value as PromptVariant })}
            >
              <option value="default">default</option>
              <option value="simplified">simplified</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase flex items-center gap-1">
              Run count
              <span
                className="text-white/40 cursor-help"
                title="Advanced: how many internal LLM calls the strategy's algorithm makes (e.g. 'median of 3'). Keep at 1 unless you're using a median-of-N strategy. For repeating the whole evaluation N times, use 'Repeat runs' on the Run tab."
              >?</span>
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={draft.runCount}
              onChange={e => {
                const raw = Number(e.target.value);
                const clamped = Math.max(1, Math.min(10, Number.isFinite(raw) && raw > 0 ? raw : 1));
                setDraft({ ...draft, runCount: clamped });
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
