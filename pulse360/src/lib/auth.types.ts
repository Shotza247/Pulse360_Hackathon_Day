// Extend NextAuth types to include role and department
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role:       string;
    department: string;
  }
  interface Session {
    user: {
      id:         string;
      email:      string;
      name:       string;
      role:       string;
      department: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:         string;
    role:       string;
    department: string;
  }
}
