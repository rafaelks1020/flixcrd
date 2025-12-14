import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "./prisma";

type ExtendedUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  approvalStatus?: string;
};

type ExtendedToken = JWT & {
  id?: string;
  role?: string;
  approvalStatus?: string;
  approvalStatusCheckedAt?: number;
};

type SessionWithExtendedUser = Session & {
  user: Session["user"] & {
    id?: string;
    role?: string;
    approvalStatus?: string;
  };
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  logger: {
    error(code, ...metadata) {
      if (code === "JWT_SESSION_ERROR") {
        // Ignora tokens antigos/invalidos e trata como deslogado sem poluir o console
        return;
      }
      console.error(code, ...metadata);
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<ExtendedUser | null> {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role ?? "USER",
          approvalStatus: user.approvalStatus ?? "PENDING",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      const extendedToken = token as ExtendedToken;
      if (user) {
        const typedUser = user as ExtendedUser;
        extendedToken.id = typedUser.id;
        extendedToken.role = typedUser.role ?? extendedToken.role ?? "USER";
        extendedToken.approvalStatus = typedUser.approvalStatus ?? "PENDING";
      }

      if (extendedToken.id) {
        const currentStatus = extendedToken.approvalStatus ?? "PENDING";
        const lastChecked =
          typeof extendedToken.approvalStatusCheckedAt === "number"
            ? extendedToken.approvalStatusCheckedAt
            : 0;

        if (currentStatus !== "APPROVED" && Date.now() - lastChecked > 15000) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: extendedToken.id },
              select: { approvalStatus: true },
            });
            if (dbUser?.approvalStatus) {
              extendedToken.approvalStatus = dbUser.approvalStatus;
            }
          } catch {
          }
          extendedToken.approvalStatusCheckedAt = Date.now();
        }
      }

      return extendedToken;
    },
    async session({ session, token }) {
      const extendedSession = session as SessionWithExtendedUser;
      const extendedToken = token as ExtendedToken;

      if (extendedSession.user && extendedToken.id) {
        extendedSession.user.id = extendedToken.id;
        extendedSession.user.role = extendedToken.role ?? "USER";
        extendedSession.user.approvalStatus =
          extendedToken.approvalStatus ?? "PENDING";
      }
      return extendedSession;
    },
  },
};
