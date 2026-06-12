import { expect, test } from "vitest";
import { load } from "./+layout.server.js";

test("redirects unauthenticated users to /login", () => {
  const locals = { user: null, session: null };
  
  try {
    load({ locals });
    expect.fail("Should have thrown a redirect");
  } catch (error) {
    // Assert that the thrown error is a SvelteKit redirect
    expect(error.status).toBe(303);
    expect(error.location).toBe("/login");
  }
});

test("allows authenticated users through and returns user/session data", () => {
  const mockUser = {
    id: "user-123",
    name: "Alice",
    email: "alice@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const mockSession = {
    id: "sess-123",
    expiresAt: new Date(),
    token: "token-123",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "user-123"
  };
  const locals = { user: mockUser, session: mockSession };
  
  const result = load({ locals });
  expect(result).toEqual({
    user: mockUser,
    session: mockSession,
  });
});
