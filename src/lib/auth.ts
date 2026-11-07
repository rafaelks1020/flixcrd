import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "./prisma";
import { rateLimit } from "./rate-limit-store";

const ACCESS_REFRESH_MS = 5 * 60 * 1000;
const loginAttemptLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

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
  accessCheckedAt?: number;
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

        const rawEmail = credentials.email.trim();
        const attempt = loginAttemptLimit(`login:${rawEmail.toLowerCase()}`);
        if (!attempt.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: rawEmail },
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
        extendedToken.accessCheckedAt = Date.now();
      }

      // Relê role e aprovação no banco a cada 5 minutos.
      // Usuário apagado invalida a sessão (o cookie é limpo no fluxo de sessão).
      if (extendedToken.id) {
        const lastChecked =
          typeof extendedToken.accessCheckedAt === "number"
            ? extendedToken.accessCheckedAt
            : 0;

        if (Date.now() - lastChecked >= ACCESS_REFRESH_MS) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: extendedToken.id },
              select: { role: true, approvalStatus: true },
            });
            if (!dbUser) {
              throw new Error("USER_GONE");
            }
            extendedToken.role = dbUser.role ?? "USER";
            extendedToken.approvalStatus = dbUser.approvalStatus ?? "PENDING";
            extendedToken.accessCheckedAt = Date.now();
          } catch (error) {
            if (error instanceof Error && error.message === "USER_GONE") {
              throw error;
            }
          }
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
