import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";

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

        const employee = await prisma.employee.findUnique({
          where:   { email: credentials.email.toLowerCase() },
          include: { department: true },
        });

        if (!employee || !employee.isActive || !employee.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, employee.passwordHash);
        if (!valid) return null;

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
