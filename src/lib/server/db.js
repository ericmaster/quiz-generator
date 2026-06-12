import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";

/**
 * Get Drizzle DB instance.
 * @param {Record<string, any>} env - Cloudflare platform env object
 * @returns {import("drizzle-orm/d1").DrizzleD1Database<typeof schema>}
 */
export function getDb(env) {
  if (!env || !env.DB) {
    throw new Error("Cloudflare D1 Database binding 'DB' is missing from env");
  }
  return drizzle(env.DB, { schema });
}
