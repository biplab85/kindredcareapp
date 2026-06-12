"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, MessageCircle, Send, ShieldAlert } from "lucide-react";
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

  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-scroll to newest after every list change. Scroll the thread's own
  // container (not scrollIntoView, which would scroll the whole page/shell and
  // make things jump) and do it instantly so polling can't cause a visible
  // jitter every cycle.
  useEffect(() => {
    if (!messages) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Messages</h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>
      </header>

      <div ref={scrollRef} className="h-80 overflow-y-auto px-5 py-4">
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
          </ul>
        )}
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 shadow-xs transition-shadow focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Send a message…"
            maxLength={2000}
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
          />
          <Button
            onClick={onSend}
            disabled={sending || body.trim().length === 0}
            aria-label="Send message"
            className="size-10 shrink-0 rounded-xl p-0 shadow-sm"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="size-4" strokeWidth={2} />
            )}
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
          "flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums",
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
    <div className="grid h-full place-items-center px-4 py-10 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <MessageCircle className="size-6" strokeWidth={1.75} />
        </div>
        <p className="mt-4 text-sm font-semibold tracking-tight text-foreground">No messages yet</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          Coordinate arrival, parking, or the recipient&apos;s preferences here.
        </p>
      </div>
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
