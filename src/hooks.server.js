import { building } from "$app/environment";
import { createAuth } from "$lib/server/auth.js";
import { svelteKitHandler } from "better-auth/svelte-kit";

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // During build, prerender, or when platform bindings are not ready, bypass auth
  if (building || !event.platform || !event.platform.env || !event.platform.env.DB) {
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }

  try {
    const auth = createAuth(event.platform.env, event.url.origin);

    // Retrieve session using headers from the current request
    const session = await auth.api.getSession({
      headers: event.request.headers,
    });

    if (session) {
      event.locals.session = session.session;
      event.locals.user = session.user;
    } else {
      event.locals.session = null;
      event.locals.user = null;
    }

    return svelteKitHandler({ event, resolve, auth, building });
  } catch (error) {
    console.error("Error in auth hook:", error);
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }
}
