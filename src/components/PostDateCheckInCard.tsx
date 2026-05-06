'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import {
  FIRST_NUDGE_PILLS,
  FIRST_NUDGE_HINT,
  SECOND_NUDGE_PILLS,
  SECOND_NUDGE_HINT,
  SECOND_NUDGE_DISMISS_LABEL,
} from '@/ai/prompts/post-date-check-in-prompt';

type Pill = 'positive' | 'neutral' | 'negative';

interface Props {
  matchName: string;
  /** 'first' = three pills + hint. 'second' = lighter set + dismiss button. */
  variant: 'first' | 'second';
  onSubmit: (text: string, pill?: Pill) => Promise<void>;
  onDismiss: () => Promise<void>;
  disabled?: boolean;
}

export function PostDateCheckInCard({
  matchName,
  variant,
  onSubmit,
  onDismiss,
  disabled,
}: Props) {
  const [pending, setPending] = useState(false);

  const pills = variant === 'first' ? FIRST_NUDGE_PILLS : SECOND_NUDGE_PILLS;
  const hint = variant === 'first' ? FIRST_NUDGE_HINT : SECOND_NUDGE_HINT;

  const handlePill = async (pill: Pill, label: string) => {
    setPending(true);
    try {
      await onSubmit(label, pill);
    } finally {
      setPending(false);
    }
  };

  const handleDismiss = async () => {
    setPending(true);
    try {
      await onDismiss();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-[1.75rem] rounded-tl-none border border-white/10 bg-white/10 backdrop-blur-md p-4 md:p-5 shadow-lg max-w-xs">
      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
        <Sparkles className="h-3 w-3 fill-current" />
        <span>After your date with {matchName}</span>
      </div>
      <div className="flex flex-col gap-2">
        {pills.map((p) => (
          <Button
            key={p.value}
            variant="outline"
            size="sm"
            disabled={disabled || pending}
            onClick={() => handlePill(p.value as Pill, p.label)}
            className="justify-start rounded-full bg-white/5 border-white/10 hover:bg-white/15 text-white transition-transform active:scale-[0.97]"
          >
            {p.label}
          </Button>
        ))}
        {variant === 'second' && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || pending}
            onClick={handleDismiss}
            className="justify-start rounded-full text-white/60 hover:text-white"
          >
            {SECOND_NUDGE_DISMISS_LABEL}
          </Button>
        )}
      </div>
      <p className="mt-3 text-[11px] italic text-white/50 text-center">
        {hint}
      </p>
    </div>
  );
}
