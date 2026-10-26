import { describe, it, expect } from "vitest";
import { isExistingAccount, signupErrorCopy, loginErrorCopy, resetErrorCopy, OFFLINE_MESSAGE } from "../js/signup-result.js";

describe("isExistingAccount", () => {
  it("is true when Supabase returns a user with no identities", () => {
    expect(isExistingAccount({ user: { id: "u1", identities: [] } })).toBe(true);
  });
  it("is false for a brand-new user", () => {
    expect(isExistingAccount({ user: { id: "u1", identities: [{ id: "i1" }] } })).toBe(false);
  });
  it("is false when there is no user or no identities list", () => {
    expect(isExistingAccount(null)).toBe(false);
    expect(isExistingAccount({ user: null })).toBe(false);
    expect(isExistingAccount({ user: { id: "u1" } })).toBe(false);
  });
});

describe("signupErrorCopy", () => {
  it("never passes Supabase's own message through", () => {
    const copy = signupErrorCopy({ message: "Database error saving new user", status: 500 });
    expect(copy.kind).toBe("unknown");
    expect(copy.message).not.toMatch(/database/i);
  });
  it("maps a network failure to the offline message", () => {
    expect(signupErrorCopy({ name: "AuthRetryableFetchError", message: "Failed to fetch" }).message).toBe(OFFLINE_MESSAGE);
    expect(signupErrorCopy(new TypeError("Failed to fetch")).kind).toBe("offline");
  });
  it("maps an existing account to the email field", () => {
    expect(signupErrorCopy({ code: "user_already_exists", message: "User already registered" })).toMatchObject({ kind: "exists", field: "email" });
  });
  it("maps rate limits to plain words", () => {
    expect(signupErrorCopy({ code: "over_email_send_rate_limit", status: 429 }).message).toBe("Too many sign-ups right now. Try again in a few minutes.");
    expect(signupErrorCopy({ status: 429, message: "x" }).kind).toBe("rate");
  });
  it("puts a weak password on the password field", () => {
    expect(signupErrorCopy({ code: "weak_password" }).field).toBe("password");
  });
  it("puts an invalid email on the email field", () => {
    expect(signupErrorCopy({ code: "email_address_invalid", message: 'Email address "a@b.c" is invalid' }).field).toBe("email");
  });
});

describe("loginErrorCopy", () => {
  it("says the email and password don't match, without saying which", () => {
    expect(loginErrorCopy({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(
      "That email and password don't match. Check both and try again.",
    );
  });
  it("asks an unconfirmed user to tap the email link", () => {
    expect(loginErrorCopy({ code: "email_not_confirmed", message: "Email not confirmed" })).toMatch(/^Confirm your email first/);
  });
  it("maps network failures and rate limits", () => {
    expect(loginErrorCopy(new TypeError("Failed to fetch"))).toBe(OFFLINE_MESSAGE);
    expect(loginErrorCopy({ status: 429, message: "x" })).toMatch(/^Too many tries/);
  });
  it("never passes Supabase's own message through", () => {
    expect(loginErrorCopy({ message: "Database error querying schema", status: 500 })).toBe(
      "We couldn't log you in. Try again in a minute.",
    );
  });
});

describe("resetErrorCopy", () => {
  it("maps network failures and the email rate limit", () => {
    expect(resetErrorCopy(new TypeError("Failed to fetch"))).toBe(OFFLINE_MESSAGE);
    expect(resetErrorCopy({ code: "over_email_send_rate_limit", status: 429 })).toMatch(/^Too many emails/);
  });
  it("explains a reused or weak new password", () => {
    expect(resetErrorCopy({ code: "same_password", status: 422 })).toBe("That's your current password. Pick a new one.");
    expect(resetErrorCopy({ code: "weak_password", status: 422 })).toMatch(/^Pick a stronger password/);
  });
  it("never passes Supabase's own message through", () => {
    expect(resetErrorCopy({ message: "Error sending recovery email", status: 500 })).toBe("It didn't go through. Try again in a minute.");
  });
});
