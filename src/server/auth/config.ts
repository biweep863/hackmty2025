// src/server/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
  type Session,
} from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Google from "next-auth/providers/google";

import { env } from "~/env"; // ajusta si tu env vive en otro path
import { db } from "~/server/db";

/**
 * Augment: add id/role/teamId to Session, and (optionally) to User.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Type params explicitly (fixes “implicitly has ‘any’ type”)
    session: ({ session, user }: { session: Session; user: AdapterUser }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        role: (user as any).role,
        teamId: (user as any).teamId ?? null,
      },
    }),
  },
  debug: process.env.NODE_ENV === "development",
};

/**
 * Helper for Server Components / SSR (v4)
 */
/**
 * Helper for Server Components / SSR (v4)
 *
 * Accepts optional `headers` so callers (like tRPC RSC helpers) can pass the
 * incoming request headers/cookies and allow NextAuth to read the session.
 */
export const getServerAuthSession = (
  headers?:
    | Headers
    | Record<string, string>
    | { getHeader?: (name: string) => string | undefined },
) => {
  if (headers) {
    // Normalize several possible header shapes we may receive from different
    // runtimes (Headers, plain object, or a Node-like object with getHeader).
    let headersObj: Record<string, string> = {};
    let getHeaderFn: (name: string) => string | undefined;

    // Node-like object (already provides getHeader)
    if (typeof (headers as any).getHeader === "function") {
      const h = headers as any;
      getHeaderFn = (name: string) =>
        h.getHeader(name) ?? h.getHeader(name.toLowerCase());
      headersObj = h.headers ?? {};
    }
    // Web `Headers` instance
    else if (typeof (headers as any).get === "function") {
      const h = headers as Headers;
      headersObj = Object.fromEntries(h.entries());
      getHeaderFn = (name: string) =>
        h.get(name) ?? h.get(name.toLowerCase()) ?? undefined;
    }
    // Plain object map
    else if (typeof headers === "object") {
      const h = headers as Record<string, string>;
      // copy and normalize keys to lower-case for easier lookup
      headersObj = Object.fromEntries(
        Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]),
      );
      getHeaderFn = (name: string) => headersObj[name.toLowerCase()];
    } else {
      return getServerSession(authOptions);
    }

    const reqShim: any = {
      headers: headersObj,
      getHeader: getHeaderFn,
      url: "/",
      method: "GET",
    };

    return getServerSession(
      reqShim as any,
      undefined as any,
      authOptions as any,
    );
  }

  return getServerSession(authOptions);
};
