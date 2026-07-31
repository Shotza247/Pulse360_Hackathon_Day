// next-auth type extensions for Pulse360
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:         string;
      email:      string;
      name:       string;
      role:       string;
      department: string;
      image?:     string | null;
    };
  }
  interface User {
    role:       string;
    department: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:         string;
    role:       string;
    department: string;
  }
}
