"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, routeForRole } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    const user = getUser();
    router.replace(user ? routeForRole(user.role) : "/login");
  }, [router]);
  return null;
}
