"use client";

import { jwtDecode } from "jwt-decode";

export type DecodedUser = {
  sub: string;
  email: string;
  full_name: string;
  role: "admin" | "manager" | "member";
  org: string;
  exp: number;
};

const TOKEN_KEY = "ff_token";

export const getToken = (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY));

export const setToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const isTokenExpired = (): boolean => {
  const token = getToken();
  if (!token) return true;
  try {
    const decoded = jwtDecode<DecodedUser>(token);
    return decoded.exp * 1000 < Date.now();
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

export const routeForRole = (role: DecodedUser["role"]) => {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  return "/dashboard";
};

export const logout = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/";
  }
};
