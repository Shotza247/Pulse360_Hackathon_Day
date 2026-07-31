import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const employee = await prisma.employee.findUnique({
          where: { email: String(credentials.email).toLowerCase() },
          include: { department: true },
        });

        if (!employee || !employee.isActive || !employee.passwordHash) return null;

        const valid = await bcrypt.compare(
          String(credentials.password),
          employee.passwordHash,
        );
        if (!valid) return null;

        return {
          id:         String(employee.id),
          email:      employee.email,
          name:       `${employee.firstName} ${employee.lastName}`,
          role:       employee.role,
          department: employee.department.name,
        };
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
      if (token) {
        session.user.id         = token.id as string;
        session.user.role       = token.role as string;
        session.user.department = token.department as string;
      }
      return session;
    },
  },
});
