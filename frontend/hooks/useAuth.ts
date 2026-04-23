"use client";

import { useEffect, useState } from "react";
import { getUser, logout } from "@/lib/auth";
import type { DecodedUser } from "@/lib/auth";

export const useAuth = () => {
  const [user, setUser] = useState<DecodedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
    setIsLoading(false);
  }, []);

  return { user, isLoading, logout };
};
