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

export const authApi = withInterceptors(process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8001");
export const projectApi = withInterceptors(process.env.NEXT_PUBLIC_PROJECT_URL ?? "http://localhost:8002");
export const taskApi = withInterceptors(process.env.NEXT_PUBLIC_TASK_URL ?? "http://localhost:8003");
export const analyticsApi = withInterceptors(process.env.NEXT_PUBLIC_ANALYTICS_URL ?? "http://localhost:8004");
