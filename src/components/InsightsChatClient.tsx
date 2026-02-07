"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const starterPrompts = [
  "Where could I cut this month?",
  "What are my biggest non-essential spends?",
  "Which categories are trending up?",
];

export default function InsightsChatClient({
  variant = "card",
}: {
  variant?: "card" | "widget";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me about your spending and I’ll surface insights from your data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = input.trim().length > 0 && !loading;

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text.trim() },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const response = await fetch("/api/insights/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: nextMessages
          .filter((msg) => msg.content.trim().length > 0)
          .slice(-6),
      }),
    });

    if (!response.ok) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn’t fetch insights right now. Try again in a moment.",
        },
      ]);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as { answer?: string };
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.answer ?? "No insights available yet." },
    ]);
    setLoading(false);
  };

  const promptButtons = useMemo(
    () =>
      starterPrompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => sendMessage(prompt)}
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
        >
          {prompt}
        </button>
      )),
    []
  );

  const isWidget = variant === "widget";

  return (
    <section
      className={
        isWidget
          ? "flex h-full flex-col"
          : "rounded-[32px] bg-white/85 p-6 ring-soft"
      }
    >
      {!isWidget ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">AI spending insights</p>
            <p className="text-xs text-[color:var(--ink-soft)]">
              Ask about cuts, trends, or category spikes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">{promptButtons}</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">{promptButtons}</div>
      )}

      <div
        ref={listRef}
        className={`mt-4 flex-1 space-y-3 overflow-y-auto rounded-3xl bg-white/70 p-4 ring-soft ${
          isWidget ? "min-h-[220px]" : "h-56"
        }`}
      >
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              message.role === "user"
                ? "ml-auto bg-[color:var(--ocean)] text-white"
                : "bg-white text-[color:var(--ink)]"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading ? (
          <div className="max-w-[70%] rounded-2xl bg-white px-4 py-3 text-sm text-[color:var(--ink-soft)]">
            Thinking…
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your spending…"
          className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[color:var(--ink)]"
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!canSend}
          className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </section>
  );
}
