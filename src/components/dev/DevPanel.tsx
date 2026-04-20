// src/components/dev/DevPanel.tsx
// DEV-ONLY. See src/lib/dev-tools/README.md for deletion instructions.
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { devSetVerified, devSeedDemoProfile, devResetProfile, devSeedFakeInvite, devClearFakeInvites } from '@/app/bot/actions';
import { DEMO_INVITE_SENDER_KEY } from '@/lib/dev-tools/demo-invite';
import { clearAllCached, listCached } from '@/lib/dev-tools/response-cache';
import { supabase } from '@/supabase/client';

interface DevPanelProps {
  verified: boolean;
  onClose: () => void;
}

export function DevPanel({ verified, onClose }: DevPanelProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [cacheState, setCacheState] = useState({ bio: false, personality: false, matches: false });

  useEffect(() => {
    setCacheState(listCached());
  }, []);

  const run = async (
    label: string,
    fn: () => Promise<unknown>,
    opts: { reload?: boolean; onResult?: (result: unknown) => void } = {},
  ) => {
    if (busy) return;
    setBusy(true);
    const { reload = true, onResult } = opts;
    try {
      const result = await fn();
      // The session JWT can lag behind (e.g. email_confirm flips) — refresh
      // so the next request picks up the new claims.
      await supabase.auth.refreshSession();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) localStorage.removeItem(`profile_cache_${user.id}`);
      } catch {
        // ignore — reload still happens
      }
      onResult?.(result);
      toast({ title: `Dev: ${label}`, description: reload ? 'Reloading…' : undefined });
      if (reload) setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Dev action failed', description: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  const handleSeedFakeInvite = () =>
    run('fake invite seeded', devSeedFakeInvite, {
      reload: false,
      onResult: (r) => {
        const senderId = (r as { senderId?: string } | undefined)?.senderId;
        if (senderId) {
          try {
            localStorage.setItem(DEMO_INVITE_SENDER_KEY, senderId);
          } catch {
            // ignore quota / private mode
          }
        }
      },
    });

  const handleStopFakeInvite = () =>
    run('fake invite stopped', devClearFakeInvites, {
      reload: false,
      onResult: () => {
        try {
          localStorage.removeItem(DEMO_INVITE_SENDER_KEY);
        } catch {
          // ignore
        }
      },
    });

  const handleClearCache = () => {
    clearAllCached();
    setCacheState(listCached());
    toast({ title: 'Dev cache cleared' });
  };

  const mark = (on: boolean) => (on ? '✓' : '✗');

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-amber-900">DEV TOOLS</span>
        <button
          onClick={onClose}
          className="text-amber-900 hover:text-amber-700 font-bold text-sm leading-none"
          aria-label="Close dev panel"
          title="Close (Ctrl+1)"
        >
          ×
        </button>
      </div>
      <div className="mb-2 text-amber-800">
        Verified: {verified ? '✓' : '✗'}
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {verified ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run('marked unverified', () => devSetVerified(false))}>
            Mark unverified
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run('marked verified', () => devSetVerified(true))}>
            Mark verified
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run('demo profile seeded', devSeedDemoProfile)}>
          Seed demo profile
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={handleSeedFakeInvite}>
          Seed fake invite
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={handleStopFakeInvite}>
          Stop fake invite
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => run('profile reset', devResetProfile)}>
          Reset profile
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
