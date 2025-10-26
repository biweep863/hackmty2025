"use client";

import React, { useEffect } from "react";
import Loading from "~/app/_components/Loading";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // paths that should be accessible without login
  const publicPrefixes = React.useMemo(
    () => ["/_next", "/api", "/favicon.ico", "/static", "/public"],
    [],
  );
  const publicExact = React.useMemo(
    () => [
      "/inicio",
      "/user/link-banorte",
      "/user/banorte-simulate",
      "/user/verify-banorte",
      "/user/token-entry",
      "/register",
      "/",
    ],
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    // wait for session status to resolve
    if (status === "loading") return;

    const isPublic =
      publicExact.includes(pathname) ||
      publicPrefixes.some((p) => pathname.startsWith(p));

    // if (status === "unauthenticated") {
    //   // if route is not public, send to login
    //   if (!isPublic) router.push("/inicio");
    //   return;
    // }

    // authenticated -> check Banorte-linked flag (demo/local)
    const linked = localStorage.getItem("demo_banorte_linked") === "true";
    if (!linked) {
      // allow the demo linking page but send to it otherwise
      // if (pathname !== "/user/link-banorte") {
      //   router.push("/user/link-banorte");
      // }
    }
  }, [status, pathname, router, publicExact, publicPrefixes]);

  // while determining session, render children (or a small placeholder)
  if (status === "loading") return <Loading />;
  return <>{children}</>;
}
