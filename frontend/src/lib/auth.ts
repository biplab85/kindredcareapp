import { create } from "zustand";
import api from "./api";

interface User {
  id: number;
  name: string;
  email: string;
  role: "family" | "caregiver" | "admin";
  phone: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  status: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  fetchUser: () => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: string;
    phone: string;
  }) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("kindredcare-token") : null,
  isLoading: false,

  setAuth: (user, token) => {
    localStorage.setItem("kindredcare-token", token);
    set({ user, token });
  },

  clearAuth: () => {
    localStorage.removeItem("kindredcare-token");
    set({ user: null, token: null });
  },

  fetchUser: async () => {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true });
    try {
      const res = await api.get("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ user: res.data.user, isLoading: false });
    } catch {
      get().clearAuth();
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    const res = await api.post("/api/auth/register", data);
    get().setAuth(res.data.user, res.data.token);
  },

  login: async (data) => {
    const res = await api.post("/api/auth/login", data);
    get().setAuth(res.data.user, res.data.token);
  },

  logout: async () => {
    const { token } = get();
    try {
      await api.post("/api/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Even if API fails, clear local state
    }
    get().clearAuth();
  },
}));
