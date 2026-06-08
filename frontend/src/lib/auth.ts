import { create } from "zustand";
import api from "./api";

export interface CaregiverProfileSummary {
  onboarding_complete: boolean;
  bio?: string | null;
  address?: string | null;
  postal_code?: string | null;
  hourly_rate?: string | number | null;
  travel_radius_km?: number | null;
  years_of_experience?: number | null;
  languages?: string[] | null;
  interests?: string[] | null;
  personality_tags?: string[] | null;
  certifications?: Array<{ name: string; issuer?: string | null; year?: string | number | null }> | null;
  references?: Array<{
    name: string;
    email?: string | null;
    phone?: string | null;
    relationship?: string | null;
  }> | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  photo_path?: string | null;
  photo_status?: string | null;
  payouts_enabled?: boolean;
  services?: Array<{ id: number; name: string; slug: string }> | null;
}

export interface CareRecipientSummary {
  id: number;
  name: string;
  street_address?: string | null;
  age?: number | null;
  postal_code?: string | null;
  language?: string | null;
  interests?: string[] | null;
  accessibility_notes?: string | null;
}

export interface FamilyProfileSummary {
  onboarding_complete: boolean;
  care_recipients?: CareRecipientSummary[] | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "family" | "caregiver" | "admin";
  phone: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  status: string;
  // Eager-loaded by /api/me (ProfileController::show). The full shape
  // backs /profile; the original onboarding_complete check lives on too
  // for the post-login redirect.
  family_profile?: FamilyProfileSummary | null;
  caregiver_profile?: CaregiverProfileSummary | null;
}

/**
 * Where should this user land after authenticating? Family + caregiver
 * users with no profile (fresh signup) or an incomplete profile get
 * pushed into their respective onboarding flow; everyone else goes to
 * the dashboard.
 */
export function postLoginRoute(user: User): string {
  if (user.role === "family" && !user.family_profile?.onboarding_complete) {
    return "/family-onboarding";
  }
  if (user.role === "caregiver" && !user.caregiver_profile?.onboarding_complete) {
    return "/onboarding";
  }
  return "/dashboard";
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
