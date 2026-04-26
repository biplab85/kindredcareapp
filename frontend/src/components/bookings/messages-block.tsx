"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listMessages, type Message, sendMessage } from "@/lib/messages";
import { cn } from "@/lib/utils";

const POLL_MS = 8_000;

interface Props {
  bookingId: number;
}

/**
 * Booking-scoped chat. Polls every 8s while mounted; pauses when the
 * tab is hidden so we don't burn cycles in the background. Optimistic
 * append on send — if the request fails, the placeholder is replaced
 * with a retry-able error stub.
 */
export function MessagesBlock({ bookingId }: Props) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const listEndRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await listMessages(bookingId);
      setMessages(next);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [bookingId]);

  // Mount fetch + polling, paused when the tab is hidden.
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const next = await listMessages(bookingId);
        if (!alive) return;
        setMessages(next);
      } catch {
        if (!alive) return;
        setLoadError(true);
      }
    })();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, POLL_MS);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [bookingId, load]);

  // Auto-scroll to newest after every list change.
  useEffect(() => {
    if (!messages) return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function onSend() {
    const trimmed = body.trim();
    if (trimmed.length === 0 || sending) return;

    setSending(true);
    try {
      const created = await sendMessage(bookingId, trimmed);
      setMessages((prev) => (prev ? [...prev, created] : [created]));
      setBody("");
      // Surface any catches so the sender knows their phone/email/etc.
      // didn't go through verbatim — not surprising them is the point.
      if (created.redaction_count > 0) {
        const kinds = (created.redactions ?? []).map((r) => r.kind.replace(/_/g, " ")).join(", ");
        toast.message("Some details were redacted before sending", {
          description: kinds,
        });
      }
    } catch {
      toast.error("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div className="flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-8 bg-foreground/30" />
          Messages
          <span className="text-foreground/30">— § 12</span>
        </div>
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Polling every 8s
        </p>
      </header>

      <div className="max-h-[420px] min-h-[180px] overflow-y-auto px-5 py-4">
        {loadError && messages === null && <ErrorState onRetry={() => void load()} />}
        {!loadError && messages === null && <LoadingState />}
        {messages !== null && messages.length === 0 && <EmptyState />}
        {messages !== null && messages.length > 0 && (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id}>
                <MessageBubble message={m} />
              </li>
            ))}
            <div ref={listEndRef} />
          </ul>
        )}
      </div>

      <div className="border-t border-border/60 px-5 py-3.5">
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Send a message…"
            maxLength={2000}
            rows={2}
            className="min-h-[44px] flex-1 resize-y rounded-xl border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
          />
          <Button onClick={onSend} disabled={sending || body.trim().length === 0} size="sm">
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="size-3.5" strokeWidth={2} />
            )}
            Send
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          <ShieldAlert className="size-3" strokeWidth={2.25} />
          Phone, email, postal codes, and off-platform chat names are redacted.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Bubble
 * ───────────────────────────────────────────────────────────── */

function MessageBubble({ message }: { message: Message }) {
  const isMine = message.is_mine;
  const ts = message.created_at ? new Date(message.created_at) : null;

  return (
    <div className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          isMine
            ? "bg-primary text-primary-foreground"
            : "border border-border/60 bg-background text-foreground",
          message.is_hidden && "italic opacity-70",
        )}
      >
        {message.body}
      </div>

      <div
        className={cn(
          "flex items-center gap-2 font-mono text-[10px] tracking-[0.05em] text-muted-foreground tabular-nums",
          isMine ? "flex-row-reverse" : "flex-row",
        )}
      >
        <span>
          {message.sender.name}
          {ts && ` · ${ts.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`}
        </span>
        {message.redaction_count > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-foreground/5 px-1.5 py-0.5 text-foreground/60"
            title={isMine ? "Items removed before sending" : "Recipient note: redactions applied"}
          >
            <ShieldAlert className="size-2.5" strokeWidth={2.25} />
            {message.redaction_count} redacted
          </span>
        )}
        {isMine && message.read_at && <span className="text-foreground/50">read</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * States
 * ───────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="grid place-items-center px-4 py-10 text-center">
      <p className="text-sm font-semibold tracking-tight">
        No messages <span className="font-normal italic text-muted-foreground">yet.</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Coordinate arrival, parking, or the recipient&apos;s preferences here.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <ul className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className={cn(
            "h-12 w-3/5 animate-pulse rounded-2xl bg-muted/60",
            i % 2 === 1 && "ml-auto",
          )}
        />
      ))}
    </ul>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-accent/40 bg-accent/[0.04] p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium tracking-tight">Couldn&apos;t load the thread.</p>
          <Button onClick={onRetry} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
