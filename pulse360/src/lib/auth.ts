import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import { writeAuditEvent } from "@/lib/audit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase();

        const employee = await prisma.employee.findUnique({
          where:   { email },
          include: { department: true },
        });

        if (!employee || !employee.isActive || !employee.passwordHash) {
          await writeAuditEvent({
            action: "LOGIN_FAILED",
            entityType: "auth",
            metadata: {
              email,
              reason: !employee ? "unknown_email" : !employee.isActive ? "inactive_account" : "missing_password",
            },
          }).catch(() => {});
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, employee.passwordHash);
        if (!valid) {
          await writeAuditEvent({
            actorId: employee.id,
            action: "LOGIN_FAILED",
            entityType: "auth",
            entityId: employee.id,
            metadata: { email: employee.email, reason: "invalid_password", role: employee.role },
          }).catch(() => {});
          return null;
        }

        await writeAuditEvent({
          actorId: employee.id,
          action: "LOGIN_SUCCEEDED",
          entityType: "auth",
          entityId: employee.id,
          metadata: {
            role: employee.role,
            department: employee.department.name,
          },
        }).catch(() => {});

        return {
          id:         String(employee.id),
          email:      employee.email,
          name:       `${employee.firstName} ${employee.lastName}`,
          role:       employee.role,
          department: employee.department.name,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = user.id;
        token.role       = (user as any).role;
        token.department = (user as any).department;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id         = token.id;
        (session.user as any).role       = token.role;
        (session.user as any).department = token.department;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
