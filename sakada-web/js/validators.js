
// Input checks shared by every form on the site. Each check takes the raw
// value and returns an error message ("" when the value is fine), so every
// page words its errors the same way. Pure functions: no DOM, easy to test.

// ---------- Email ----------

// One "@", a domain made of dot-separated labels, and an ending of 2+ letters.
const EMAIL_FORMAT =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

// Big providers and every domain that is really theirs. Their name on any
// other ending (gmail.co, yahoo.con) is a typo, never a real inbox.
const PROVIDERS = {
  gmail: ["gmail.com"],
  googlemail: ["googlemail.com"],
  yahoo: ["yahoo.com", "yahoo.com.ph", "yahoo.co.uk"],
  ymail: ["ymail.com"],
  hotmail: ["hotmail.com", "hotmail.co.uk"],
  outlook: ["outlook.com"],
  live: ["live.com", "live.co.uk"],
  icloud: ["icloud.com"],
  protonmail: ["protonmail.com"],
};

// Real domains that look like a misspelt provider (mail.com vs gmail.com).
const NOT_TYPOS = new Set([
  "mail.com", "email.com", "gmx.com", "aol.com", "me.com", "mac.com",
  "msn.com", "proton.me", "pm.me", "zoho.com", "yandex.com",
]);

// Endings that don't exist; people type them when they mean ".com".
const BAD_ENDINGS = new Set(["con", "cmo", "cpm", "vom", "xom", "comm", "coom", "clm", "ocm"]);

// Damerau-Levenshtein distance (optimal string alignment).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Looks for a likely typo in a well-formed email.
 * Returns null, or { fix, sure }:
 * - sure: true  → certainly wrong (gmail.co, name@site.con); block it.
 * - sure: false → probably wrong (gmial.com); warn once, allow on retry.
 */
export function emailTypo(email) {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  const dot = domain.indexOf(".");
  const name = domain.slice(0, dot);
  const ending = domain.slice(dot + 1);

  // 1. A provider's name on the wrong ending: gmail.co, yahoo.cm
  if (PROVIDERS[name]) {
    if (PROVIDERS[name].includes(domain)) return null;
    return { fix: `${local}@${PROVIDERS[name][0]}`, sure: true };
  }

  // 2. An ending that doesn't exist: name@site.con
  if (BAD_ENDINGS.has(ending)) {
    return { fix: `${local}@${name}.com`, sure: true };
  }

  // 3. A misspelt provider name on a normal ending: gmial.com, yaho.com.ph
  if (!NOT_TYPOS.has(domain) && ["com", "com.ph", "co", "ph", "net"].includes(ending)) {
    for (const [provider, domains] of Object.entries(PROVIDERS)) {
      const limit = provider.length >= 6 ? 2 : 1;
      if (distance(name, provider) <= limit) {
        return { fix: `${local}@${domains[0]}`, sure: false };
      }
    }
  }
  return null;
}

/**
 * Checks an email. `allowed` is a value the user already re-sent after a
 * "probably wrong" warning, so it's accepted as typed.
 * Returns { message, fix }: message "" means OK; fix is a suggested email.
 */
export function checkEmail(value, allowed = "") {
  const v = value.trim();
  if (!v) return { message: "Enter your email.", fix: "" };
  if (v.length > 254 || !EMAIL_FORMAT.test(v)) {
    return { message: "That email doesn't look right. Check it, like name@email.com.", fix: "" };
  }
  const typo = emailTypo(v);
  if (!typo || (!typo.sure && v === allowed)) return { message: "", fix: "" };
  return {
    message: typo.sure
      ? `Did you mean ${typo.fix}?`
      : `Did you mean ${typo.fix}? If ${v} is correct, just submit again.`,
    fix: typo.fix,
  };
}

/**
 * A stateful email check for one form: a "probably wrong" warning shows
 * once, and the same value is accepted if the user submits it again.
 */
export function emailChecker() {
  let warned = "";
  return (value) => {
    const result = checkEmail(value, warned);
    const typo = result.fix ? emailTypo(value.trim()) : null;
    warned = typo && !typo.sure ? value.trim() : "";
    return result;
  };
}

// ---------- People ----------

export function checkName(value) {
  const v = value.trim();
  if (!v) return "Enter your name.";
  if (v.length < 2) return "Enter your full name.";
  if (v.length > 120) return "Keep your name under 120 characters.";
  if (!/\p{L}/u.test(v)) return "Your name needs at least one letter.";
  if (/[<>{}[\]\\/@#$%^*=+|~_]/.test(v)) return "Use letters, spaces, dots, dashes, or apostrophes only.";
  return "";
}

export function checkNewPassword(value) {
  if (!value) return "Create a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (value.length > 72) return "Keep your password under 72 characters.";
  if (!value.trim()) return "Your password can't be only spaces.";
  return "";
}

export function checkPassword(value) {
  return value ? "" : "Enter your password.";
}

// ---------- Bookings ----------

export function checkAddress(value, which) {
  const v = value.trim();
  if (!v) return `Enter the ${which} address.`;
  if (v.length < 5) return "Add more detail, like the barangay and town or city.";
  if (v.length > 200) return "Keep the address under 200 characters.";
  if (!/\p{L}/u.test(v)) return "Write the address with the place name, not only numbers.";
  return "";
}

export function checkGoods(value) {
  const v = value.trim();
  if (!v) return "Say what you're sending, like tomatoes or mangoes.";
  if (v.length < 2) return "Say what you're sending, like tomatoes or mangoes.";
  if (v.length > 120) return "Keep this under 120 characters.";
  return "";
}

export function checkKg(value) {
  const v = String(value).trim();
  if (!v) return "Enter the weight in kg.";
  if (!/^\d+$/.test(v)) return "Use a whole number of kilograms, like 800.";
  const kg = Number(v);
  if (kg < 1) return "The weight must be at least 1 kg.";
  if (kg > 100000) return "That's over 100 tonnes. Check the number.";
  return "";
}

/** Local YYYY-MM-DD for `date` (what an <input type="date"> uses). */
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function checkPickupDate(value, today = new Date()) {
  if (!value) return "Pick a pickup date.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Pick a pickup date from the calendar.";
  if (value < localDateString(today)) return "Pick today or a later date.";
  return "";
}

export function checkNotes(value) {
  return value.trim().length > 500 ? "Keep notes under 500 characters." : "";
}

// ---------- Driver vehicle ----------

export function checkVehicleType(value) {
  return value.trim().length > 40 ? "Keep this under 40 characters." : "";
}

export function checkPlate(value) {
  const v = value.trim();
  if (!v) return "";
  if (v.length > 15) return "Keep the plate under 15 characters.";
  if (!/^[A-Za-z0-9 -]+$/.test(v)) return "Use letters, numbers, spaces, or dashes only.";
  if (!/\d/.test(v)) return "A plate number has at least one digit.";
  return "";
}

// ---------- Contact ----------

export function checkMessage(value) {
  const v = value.trim();
  if (!v) return "Write your message.";
  if (v.length > 4900) return "Keep your message under 4,900 characters.";
  return "";
}

export function checkBookingCode(value) {
  const v = value.trim();
  if (!v) return "";
  return /^SK-?\d{3,8}$/i.test(v) ? "" : "Booking codes look like SK-00142.";
}
