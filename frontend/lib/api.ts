"use client";

import axios from "axios";
import { getToken, logout } from "@/lib/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000";

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

export const authApi = withInterceptors(process.env.NEXT_PUBLIC_AUTH_URL ?? `${GATEWAY_URL}/api/auth`);
export const projectApi = withInterceptors(process.env.NEXT_PUBLIC_PROJECT_URL ?? `${GATEWAY_URL}/api/projects`);
export const taskApi = withInterceptors(process.env.NEXT_PUBLIC_TASK_URL ?? `${GATEWAY_URL}/api/tasks`);
export const analyticsApi = withInterceptors(process.env.NEXT_PUBLIC_ANALYTICS_URL ?? `${GATEWAY_URL}/api/analytics`);
