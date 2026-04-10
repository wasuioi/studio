'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LocalStorageEvalStore, type EvalStore } from '@/lib/eval/store';
import type { EvalPair } from '@/lib/eval/types';

export default function EvalPage() {
  const [store, setStore] = useState<EvalStore | null>(null);
  const [pairs, setPairs] = useState<EvalPair[]>([]);
  const [editingPair, setEditingPair] = useState<EvalPair | null>(null);

  // Construct store inside useEffect — localStorage is unavailable during SSR.
  useEffect(() => {
    const s = new LocalStorageEvalStore();
    setStore(s);
    s.getPairs().then(setPairs);
  }, []);

  async function handleSavePair(updated: EvalPair) {
    if (!store) return;
    await store.savePair(updated);
    setPairs(await store.getPairs());
    setEditingPair(null);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pt-20 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white">Find-Matches Eval</h1>
        <p className="text-white/60">Compare LLMs, prompts, and strategies against labeled pairs.</p>
      </header>

      <Tabs defaultValue="dataset">
        <TabsList>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="dataset" className="mt-6">
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Expected scores</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell>{p.candidates.length}</TableCell>
                    <TableCell>{p.expected.map(e => e.expectedFinalScore).join(', ')}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setEditingPair(p)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="strategies">Strategies tab (Task 11)</TabsContent>
        <TabsContent value="run">Run tab (Task 12)</TabsContent>
        <TabsContent value="results">Results tab (Task 12)</TabsContent>
      </Tabs>

      <EditPairDialog
        pair={editingPair}
        onClose={() => setEditingPair(null)}
        onSave={handleSavePair}
      />
    </div>
  );
}

function EditPairDialog({
  pair,
  onClose,
  onSave,
}: {
  pair: EvalPair | null;
  onClose: () => void;
  onSave: (p: EvalPair) => void;
}) {
  const [draft, setDraft] = useState<EvalPair | null>(null);
  useEffect(() => setDraft(pair), [pair]);

  if (!draft) return null;

  function updateExpected(idx: number, score: number, reasoning: string) {
    if (!draft) return;
    const next = { ...draft, expected: [...draft.expected] };
    next.expected[idx] = { ...next.expected[idx], expectedFinalScore: score, expectedReasoning: reasoning };
    setDraft(next);
  }

  return (
    <Dialog open={!!pair} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {draft.expected.map((exp, i) => {
            const candidate = draft.candidates.find(c => c.id === exp.candidateId);
            return (
              <div key={exp.candidateId} className="border rounded p-3 space-y-2">
                <div className="text-sm font-bold">{candidate?.name ?? exp.candidateId}</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={exp.expectedFinalScore}
                  onChange={e => updateExpected(i, Number(e.target.value), exp.expectedReasoning)}
                />
                <Input
                  value={exp.expectedReasoning}
                  onChange={e => updateExpected(i, exp.expectedFinalScore, e.target.value)}
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
