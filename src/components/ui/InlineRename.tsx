import { useEffect, useRef, useState } from 'react';

interface InlineRenameProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
}

/** Enter/odak kaybı: kaydet, Esc: vazgeç. Tıklama/çift tıklama/klavye olayları üst öğeye sızmaz. */
export function InlineRename({ initialValue, onCommit, onCancel, className = '' }: InlineRenameProps) {
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  const focusedRef = useRef(false);

  // Odak bir kare sonra verilir: menü kapanırken oluşan odak kaybı düzenlemeyi hemen bitirmesin.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const finish = (commit: boolean) => {
    if (doneRef.current) return; // Enter + blur çift tetiklenmesin
    doneRef.current = true;
    if (commit) onCommit(draft);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      maxLength={60}
      aria-label="Klasör adı"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        if (focusedRef.current) finish(true); // Hiç odak almadan gelen blur'ü yok say
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`block w-full min-w-0 rounded-md border-0 bg-white px-1.5 py-0.5 text-sm font-semibold tracking-tight text-gray-900 ring-2 ring-gray-900 outline-none ${className}`}
    />
  );
}
