// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        image?: string | null;
      } | null;
      session: {
        id: string;
        expiresAt: Date;
        token: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        ipAddress?: string | null;
        userAgent?: string | null;
      } | null;
    }
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: {
        DB: D1Database;
        BETTER_AUTH_SECRET: string;
        BETTER_AUTH_URL: string;
        GITHUB_CLIENT_ID?: string;
        GITHUB_CLIENT_SECRET?: string;
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
      };
      context?: {
        waitUntil(promise: Promise<any>): void;
      };
      caches?: CacheStorage;
    }
  }
}

export {};
