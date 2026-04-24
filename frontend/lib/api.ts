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
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export const authApi = withInterceptors(`${API_URL}/auth`);
export const projectApi = withInterceptors(`${API_URL}/projects`);
export const taskApi = withInterceptors(`${API_URL}/tasks`);
export const analyticsApi = withInterceptors(`${API_URL}/analytics`);