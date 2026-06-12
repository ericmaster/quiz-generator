import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";

/**
 * Factory to create Better Auth instance based on the request's env.
 * @param {Record<string, any>} env
 * @param {string} [requestOrigin] Origin of the current request, used as a
 *   fallback baseURL so auth routing works regardless of the dev port
 *   (vite dev :5173 vs wrangler dev). A fixed `BETTER_AUTH_URL` always wins.
 */
export function createAuth(env, requestOrigin) {
  if (!env || !env.DB) {
    throw new Error("Cloudflare D1 Database binding 'DB' is missing from env");
  }

  const db = drizzle(env.DB, { schema });

  /** @type {Record<string, any>} */
  const socialProviders = {};

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || requestOrigin,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders,
    plugins: [
      sveltekitCookies(getRequestEvent),
    ],
  });
}
