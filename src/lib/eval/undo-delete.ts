// Small helper for deferred-delete-with-undo. Holds a timer per pending delete;
// if commit is called the store operation fires, if cancel is called the timer
// is cleared so the store is never touched.

export interface PendingDelete<T> {
  item: T;
  cancel: () => void;      // call to restore (clears the timer)
  // commit() is called automatically by the internal timer when it expires
}

export function scheduleDelete<T>(
  item: T,
  commitFn: () => void | Promise<void>,
  delayMs: number = 6000,
): PendingDelete<T> {
  let cancelled = false;
  const timer = setTimeout(async () => {
    if (cancelled) return;
    await commitFn();
  }, delayMs);

  return {
    item,
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
    },
  };
}
