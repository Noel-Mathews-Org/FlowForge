"use client";

import { jwtDecode } from "jwt-decode";
import { authApi } from "@/lib/api";

export type DecodedUser = {
  sub: string;
  email: string;
  full_name: string;
  role: "platform_admin" | "org_owner" | "manager" | "member";
  org_id: string;
  must_reset_password?: boolean;
  exp: number;
};

const TOKEN_KEY = "ff_token";
const REFRESH_KEY = "ff_refresh";

export const getToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string): void => {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
};

export const getRefreshToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);

export const setRefreshToken = (token: string): void => {
  if (typeof window !== "undefined") localStorage.setItem(REFRESH_KEY, token);
};

export const isTokenExpired = (): boolean => {
  const token = getToken();
  if (!token) return true;
  try {
    const { exp } = jwtDecode<DecodedUser>(token);
    return exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const getUser = (): DecodedUser | null => {
  const token = getToken();
  if (!token) return null;
  try {
    const decoded = jwtDecode<DecodedUser>(token);
    if (decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
};

export const routeForRole = (role: DecodedUser["role"]): string => {
  if (role === "platform_admin") return "/admin";
  if (role === "org_owner") return "/org";
  if (role === "manager") return "/manager";
  return "/dashboard";
};

export const logout = async (): Promise<void> => {
  const rt = getRefreshToken();
  if (rt) {
    try { await authApi.post("/logout", { refresh_token: rt }); } catch { /* ignore */ }
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.location.href = "/login";
  }
};

/** Try to get a new access_token using the stored refresh_token */
export const tryRefresh = async (): Promise<string | null> => {
  const rt = getRefreshToken();
  if (!rt) return null;
  try {
    const { data } = await authApi.post("/refresh", { refresh_token: rt });
    setToken(data.access_token);
    return data.access_token;
  } catch {
    return null;
  }
};


// ─── MSAL (Entra ID) ────────────────────────────────────────────────────────

const ENTRA_CLIENT_ID = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID || "";
const ENTRA_TENANT_ID = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID || "";
const ENTRA_REDIRECT_URI = process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export const isEntraEnabled = Boolean(ENTRA_CLIENT_ID && ENTRA_TENANT_ID);

let msalInstance: any = null;

async function getMsalInstance() {
  if (msalInstance) return msalInstance;
  if (!isEntraEnabled) return null;

  const { PublicClientApplication } = await import("@azure/msal-browser");
  msalInstance = new PublicClientApplication({
    auth: {
      clientId: ENTRA_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`,
      redirectUri: ENTRA_REDIRECT_URI,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  });
  await msalInstance.initialize();
  return msalInstance;
}

/**
 * Sign in with Microsoft Entra ID via popup.
 * Returns the FlowForge JWT access_token on success.
 */
export const loginWithEntra = async (): Promise<string> => {
  const msal = await getMsalInstance();
  if (!msal) throw new Error("Entra ID is not configured");

  const loginResponse = await msal.loginPopup({
    scopes: ["User.Read", "GroupMember.Read.All"],
  });

  const entraToken = loginResponse.accessToken;

  // Send Entra token to FlowForge backend for validation + JIT provisioning
  const { data } = await authApi.post("/login/entra", {
    access_token: entraToken,
  });

  setToken(data.access_token);

  // Get refresh token (non-blocking)
  try {
    const rt = await authApi.post("/token/issue");
    setRefreshToken(rt.data.refresh_token);
  } catch { /* ignore */ }

  return data.access_token;
};
