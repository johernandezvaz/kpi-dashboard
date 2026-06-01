import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    isAdmin: boolean;
    isGlobal: boolean;
    mustChangePassword: boolean;
    adminPlantId: number | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isAdmin: boolean;
      isGlobal: boolean;
      mustChangePassword: boolean;
      adminPlantId: number | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isAdmin: boolean;
    isGlobal: boolean;
    mustChangePassword: boolean;
    adminPlantId: number | null;
  }
}
