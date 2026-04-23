"use client";

import axios from "axios";
import { getToken, logout } from "@/lib/auth";

const withInterceptors = (baseURL: string) => {
  const instance = axios.create({ baseURL, timeout: 15000 });

  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        logout();
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// These are baked in at build time via Dockerfile ARG BASE_PUBLIC_URL
// Never fall back to localhost — fail loudly so misconfiguration is obvious
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL!;
const PROJECT_URL = process.env.NEXT_PUBLIC_PROJECT_URL!;
const TASK_URL = process.env.NEXT_PUBLIC_TASK_URL!;
const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL!;

export const authApi = withInterceptors(AUTH_URL);
export const projectApi = withInterceptors(PROJECT_URL);
export const taskApi = withInterceptors(TASK_URL);
export const analyticsApi = withInterceptors(ANALYTICS_URL);