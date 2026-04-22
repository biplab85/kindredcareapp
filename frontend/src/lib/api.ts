import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
  withXSRFToken: true,
});

// Sanctum SPA auth: any mutating request from a stateful domain (we are
// listed in SANCTUM_STATEFUL_DOMAINS) must carry an X-XSRF-TOKEN header
// that matches the XSRF-TOKEN cookie set by `/sanctum/csrf-cookie`.
// Fetch it lazily on the first mutating request and cache the promise so
// subsequent requests share the same in-flight call.
let csrfPromise: Promise<unknown> | null = null;

function ensureCsrfCookie(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!csrfPromise) {
    csrfPromise = axios
      .get(`${baseURL}/sanctum/csrf-cookie`, { withCredentials: true })
      .catch((err) => {
        // Let the next mutating call retry rather than permanently caching a failure.
        csrfPromise = null;
        throw err;
      });
  }
  return csrfPromise;
}

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    await ensureCsrfCookie();
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("kindredcare-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
