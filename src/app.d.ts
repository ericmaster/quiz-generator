// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env?: {
        // TODO(security): Add bindings here for database access/AI in later phases
      };
      context?: {
        waitUntil(promise: Promise<any>): void;
      };
      caches?: CacheStorage;
    }
  }
}

export {};
