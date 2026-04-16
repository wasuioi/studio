// src/components/dev/DevStagePanel.tsx
// DEV-ONLY. See src/lib/dev-tools/README.md for deletion instructions.
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { devForceStage } from '@/app/bot/actions';
import { clearAllCached, listCached } from '@/lib/dev-tools/response-cache';
import { supabase } from '@/supabase/client';

interface DevStagePanelProps {
  currentStage: number;
}

export function DevStagePanel({ currentStage }: DevStagePanelProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [cacheState, setCacheState] = useState({ bio: false, personality: false, matches: false });

  useEffect(() => {
    setCacheState(listCached());
  }, []);

  const jumpTo = async (n: 0 | 1 | 2) => {
    if (busy) return;
    setBusy(true);
    try {
      await devForceStage(n);
      // Clear useAuth's localStorage cache so the reload shows fresh DB state,
      // not the pre-jump profile snapshot.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) localStorage.removeItem(`profile_cache_${user.id}`);
      } catch {
        // ignore — reload still happens
      }
      toast({ title: 'Dev: stage set', description: `Profile is now at stage ${n}. Reloading…` });
      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Dev action failed', description: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  const handleClearCache = () => {
    clearAllCached();
    setCacheState(listCached());
    toast({ title: 'Dev cache cleared' });
  };

  const mark = (on: boolean) => (on ? '✓' : '✗');

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs shadow-lg">
      <div className="mb-2 font-semibold text-amber-900">DEV TOOLS (ENABLED)</div>
      <div className="mb-2 text-amber-800">Current stage: {currentStage}</div>

      <div className="mb-2 flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => jumpTo(1)}>Skip to 1</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => jumpTo(2)}>Skip to 2</Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => jumpTo(0)}>
          Reset to stage 0
        </Button>
        <Button size="sm" variant="ghost" onClick={handleClearCache}>
          Clear AI cache
        </Button>
      </div>

      <div className="text-amber-800">
        Cached: bio {mark(cacheState.bio)} · personality {mark(cacheState.personality)} · matches {mark(cacheState.matches)}
      </div>
    </div>
  );
}
