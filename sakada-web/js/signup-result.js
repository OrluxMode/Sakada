// Turns a Supabase sign-up result into what the sign-up page shows.
// Never show Supabase's own error.message: it's developer English.

/**
 * With email confirmation on, Supabase does NOT return an error for an
 * email that already has an account (so nobody can probe which emails
 * exist). It returns a user with an empty `identities` list instead.
 */
export function isExistingAccount(data) {
  const identities = data?.user?.identities;
  return Array.isArray(identities) && identities.length === 0;
}

export const OFFLINE_MESSAGE =
  "No connection. Check your signal and try again. Your details are still here.";

/**
 * Plain copy for a sign-up (or Google) error.
 * `field` says which input the message belongs on; null = the form message.
 */
export function signupErrorCopy(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const status = error?.status;

  if (
    error?.name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|load failed/i.test(message)
  ) {
    return { kind: "offline", field: null, message: OFFLINE_MESSAGE };
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered/i.test(message)
  ) {
    return { kind: "exists", field: "email", message: "This email already has an account." };
  }
  if (code.startsWith("over_") || status === 429) {
    return {
      kind: "rate",
      field: null,
      message: "Too many sign-ups right now. Try again in a few minutes.",
    };
  }
  if (code === "weak_password") {
    return {
      kind: "password",
      field: "password",
      message: "Pick a harder password: at least 8 characters that aren't easy to guess.",
    };
  }
  if (code === "email_address_invalid" || /email address .* is invalid/i.test(message)) {
    return {
      kind: "email",
      field: "email",
      message: "This email address doesn't look right. Check it and try again.",
    };
  }
  return {
    kind: "unknown",
    field: null,
    message: "We couldn't create your account. Try again in a minute.",
  };
}
