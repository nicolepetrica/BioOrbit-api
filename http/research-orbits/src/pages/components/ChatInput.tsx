import React, { useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";

export default function ChatInput({
  onSubmit,
  disabled,
  placeholder = "Ask a question to over 600 Space Biology publications",
}: {
  onSubmit: (q: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const s = q.trim();
        if (!s) return;
        onSubmit(s);
        setQ("");
        ref.current?.blur();
      }}
      className="mx-auto w-full max-w-[1200px] rounded-full border border-white/20 bg-white/[0.02] p-2 pl-4 pr-2 shadow-[0_0_0_8px_rgba(136,106,234,0.08)_inset] focus-within:shadow-[0_0_0_10px_rgba(136,106,234,0.12)_inset] transition-shadow"
    >
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[15px] text-white placeholder:text-white/60 focus:outline-none"
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || !q.trim()}
          className="inline-flex items-center justify-center rounded-full
                     border border-white/15 bg-white/5 px-4 py-2
                     text-sm text-white/80 hover:bg-white/10 hover:text-white transition
                     disabled:opacity-50"
          aria-label="Ask"
        >
          <SendHorizonal className="size-4 mr-1" />
          Ask
        </button>
      </div>
    </form>
  );
}
