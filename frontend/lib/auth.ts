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
