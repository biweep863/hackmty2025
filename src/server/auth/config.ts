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
export const getServerAuthSession = () => getServerSession(authOptions);
