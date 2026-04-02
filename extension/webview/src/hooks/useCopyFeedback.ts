import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages copy-with-timeout feedback state.
 * Returns [copiedKey, trigger] where trigger(key) sets copiedKey
 * and automatically resets it to null after 2 seconds.
 */
export function useCopyFeedback(): [string | null, (key: string) => void] {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const trigger = useCallback((key: string) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setCopiedKey(key);
    timerRef.current = setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  return [copiedKey, trigger];
}
