import api from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
 * Types — mirror Admin\AdminAccountController.
 * ───────────────────────────────────────────────────────────── */

export interface AdminAccount {
  id: number;
  name: string;
  email: string;
  role: "admin";
  status: "active" | "suspended" | "deleted";
  two_factor_enabled: boolean;
  created_at: string | null;
}

export async function listAdmins(): Promise<AdminAccount[]> {
  const res = await api.get<{ data: AdminAccount[] }>("/api/admin/admins");
  return res.data.data;
}

export async function createAdmin(payload: { name: string; email: string }): Promise<AdminAccount> {
  const res = await api.post<{ data: AdminAccount }>("/api/admin/admins", payload);
  return res.data.data;
}

export async function updateAdmin(
  id: number,
  payload: { name?: string; email?: string },
): Promise<AdminAccount> {
  const res = await api.patch<{ data: AdminAccount }>(`/api/admin/admins/${id}`, payload);
  return res.data.data;
}

export async function deactivateAdmin(id: number): Promise<AdminAccount> {
  const res = await api.delete<{ data: AdminAccount }>(`/api/admin/admins/${id}`);
  return res.data.data;
}
