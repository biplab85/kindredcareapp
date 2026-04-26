import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror MessageController.
 * ───────────────────────────────────────────────────────────── */

export interface MessageRedaction {
  kind: string;
  original: string;
  replacement: string;
}

export interface Message {
  id: number;
  sender: { id: number; name: string; role: string };
  body: string;
  redactions: MessageRedaction[] | null;
  redaction_count: number;
  is_hidden: boolean;
  is_mine: boolean;
  read_at: string | null;
  created_at: string | null;
}

export async function listMessages(bookingId: number): Promise<Message[]> {
  const res = await api.get<{ data: Message[] }>(`/api/bookings/${bookingId}/messages`);
  return res.data.data;
}

export async function sendMessage(bookingId: number, body: string): Promise<Message> {
  const res = await api.post<{ data: Message }>(`/api/bookings/${bookingId}/messages`, { body });
  return res.data.data;
}
