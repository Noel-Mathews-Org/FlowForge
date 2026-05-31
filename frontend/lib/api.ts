"use client";

import axios from "axios";
import { getToken, tryRefresh, logout } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

const withInterceptors = (baseURL: string) => {
  const instance = axios.create({ baseURL, timeout: 15000 });

  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      if (error?.response?.status === 401 && !original._retry) {
        original._retry = true;
        const newToken = await tryRefresh();
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return instance(original);
        }
        await logout();
      }
      return Promise.reject(error);
    }
  );
  return instance;
};

export const authApi     = withInterceptors(`${API_URL}/auth`);
export const projectApi  = withInterceptors(`${API_URL}/projects`);
export const taskApi     = withInterceptors(`${API_URL}/tasks`);
export const analyticsApi = withInterceptors(`${API_URL}/analytics`);
export const aiApi       = withInterceptors(`${API_URL}/ai`);