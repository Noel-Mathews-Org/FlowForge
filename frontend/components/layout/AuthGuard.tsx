"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, routeForRole } from "@/lib/auth";
import type { Role } from "@/types";

export const AuthGuard = ({ children, role }: { children: React.ReactNode; role?: Role | Role[] }) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role) {
      const accepted = Array.isArray(role) ? role : [role];
      if (!accepted.includes(user.role)) {
        router.replace(routeForRole(user.role));
      }
    }
    setMounted(true);
  }, [router, role]);

  if (!mounted) return null;

  return <>{children}</>;
};
