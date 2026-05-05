'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Pill = 'positive' | 'neutral' | 'negative';

interface Props {
  matchName: string;
  /** Called with the user's free text + (optional) pill choice. */
  onSubmit: (text: string, pill?: Pill) => Promise<void>;
  /** Show the "I'd rather not say" boundary button (true when nudge_count >= 2). */
  showDismiss?: boolean;
  onDismiss?: () => Promise<void>;
  disabled?: boolean;
}

const PILLS: { value: Pill; label: string }[] = [
  { value: 'positive', label: 'It was great' },
  { value: 'neutral', label: 'Not sure yet' },
  { value: 'negative', label: 'Not a match' },
];

export function PostDateCheckInCard({
  matchName,
  onSubmit,
  onDismiss,
  showDismiss,
  disabled,
}: Props) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (pill?: Pill) => {
    if (!pill && !text.trim()) return;
    setPending(true);
    try {
      // If user is just clicking a pill with no free text, send the pill
      // label as the user's "text" so the conversation has something to render.
      const payload = text.trim() || PILLS.find((p) => p.value === pill)?.label || '';
      await onSubmit(payload, pill);
      setText('');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        After your date with {matchName}
      </p>
      <div className="mb-3 flex flex-col gap-2">
        {PILLS.map((p) => (
          <Button
            key={p.value}
            variant="outline"
            size="sm"
            disabled={disabled || pending}
            onClick={() => submit(p.value)}
            className="justify-start"
          >
            {p.label}
          </Button>
        ))}
      </div>
      <p className="mb-2 text-xs italic text-muted-foreground">
        Or just tell me in your own words.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something…"
          disabled={disabled || pending}
        />
        <Button type="submit" disabled={disabled || pending || !text.trim()}>
          Send
        </Button>
      </form>
      {showDismiss && onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-muted-foreground"
          disabled={disabled || pending}
          onClick={() => onDismiss()}
        >
          I&apos;d rather not say
        </Button>
      )}
    </div>
  );
}
