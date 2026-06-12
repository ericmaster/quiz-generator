import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/server/schema.js",
  out: "./migrations",
  dialect: "sqlite",
});
