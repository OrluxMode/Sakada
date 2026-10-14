
import { describe, it, expect, beforeEach } from "vitest";
import {
  checkEmail,
  emailChecker,
  checkName,
  checkNewPassword,
  checkPassword,
  checkAddress,
  checkGoods,
  checkKg,
  checkPickupDate,
  checkNotes,
  checkPlate,
  checkVehicleType,
  checkMessage,
  checkBookingCode,
} from "../js/validators.js";
import { validateFields, showFieldError } from "../js/field-errors.js";

describe("checkEmail", () => {
  it.each([
    "name@gmail.com",
    "maria.dela.cruz+sakada@gmail.com",
    "name@yahoo.com.ph",
    "name@mail.com",
    "juan@company.com.ph",
    "juan@mail.company.com",
    "juan@tip.edu.ph",
    "ana@proton.me",
  ])("accepts %s", (email) => {
    expect(checkEmail(email).message).toBe("");
  });

  it.each([
    ["name@gmail.co", "name@gmail.com"],
    ["name@gmail.con", "name@gmail.com"],
    ["name@yahoo.co", "name@yahoo.com"],
    ["ana@icloud.co", "ana@icloud.com"],
    ["ana@gmail.com.ph", "ana@gmail.com"],
    ["juan@site.con", "juan@site.com"],
  ])("blocks the typo %s and suggests %s", (email, fix) => {
    const r = checkEmail(email);
    expect(r.message).toBe(`Did you mean ${fix}?`);
    expect(r.fix).toBe(fix);
  });

  it.each(["juan@gmail", "juan@@gmail.com", "juan@.com", "juan.@gmail.com", "juan gmail.com"])(
    "rejects the badly formed %s",
    (email) => {
      expect(checkEmail(email).message).toMatch(/doesn't look right/);
    },
  );

  it("asks for an empty email", () => {
    expect(checkEmail("  ").message).toBe("Enter your email.");
  });

  it("warns once about a likely misspelling, then accepts it", () => {
    const check = emailChecker();
    expect(check("ana@gmial.com").fix).toBe("ana@gmail.com");
    expect(check("ana@gmial.com").message).toBe("");
  });

  it("never lets a certain typo through, even when re-sent", () => {
    const check = emailChecker();
    expect(check("ana@gmail.co").message).not.toBe("");
    expect(check("ana@gmail.co").message).not.toBe("");
  });
});

describe("people", () => {
  it("names", () => {
    expect(checkName("Ma. Dela Cruz-O'Neil")).toBe("");
    expect(checkName("José Rizal")).toBe("");
    expect(checkName("")).toBe("Enter your name.");
    expect(checkName("J")).toBe("Enter your full name.");
    expect(checkName("1234")).not.toBe("");
    expect(checkName("Juan <b>")).not.toBe("");
  });
  it("passwords", () => {
    expect(checkNewPassword("abcdefgh")).toBe("");
    expect(checkNewPassword("short")).toBe("Use at least 8 characters.");
    expect(checkNewPassword("        ")).not.toBe("");
    expect(checkNewPassword("a".repeat(73))).not.toBe("");
    expect(checkPassword("")).toBe("Enter your password.");
  });
});

describe("bookings", () => {
  const today = new Date(2026, 9, 14);
  it("addresses and goods", () => {
    expect(checkAddress("Marikina Public Market, Marikina City", "pickup")).toBe("");
    expect(checkAddress("", "pickup")).toBe("Enter the pickup address.");
    expect(checkAddress("12345", "drop-off")).not.toBe("");
    expect(checkGoods("Onions")).toBe("");
    expect(checkGoods("")).not.toBe("");
  });
  it("weight", () => {
    expect(checkKg("800")).toBe("");
    expect(checkKg("8.5")).not.toBe("");
    expect(checkKg("0")).not.toBe("");
    expect(checkKg("-3")).not.toBe("");
    expect(checkKg("")).toBe("Enter the weight in kg.");
  });
  it("pickup date", () => {
    expect(checkPickupDate("2026-10-14", today)).toBe("");
    expect(checkPickupDate("2026-12-01", today)).toBe("");
    expect(checkPickupDate("2026-10-13", today)).toBe("Pick today or a later date.");
    expect(checkPickupDate("", today)).toBe("Pick a pickup date.");
  });
  it("notes", () => {
    expect(checkNotes("Gate code 1234")).toBe("");
    expect(checkNotes("x".repeat(501))).not.toBe("");
  });
});

describe("vehicle and contact", () => {
  it("plates and vehicle type", () => {
    expect(checkPlate("NBC 1234")).toBe("");
    expect(checkPlate("123-ABC")).toBe("");
    expect(checkPlate("")).toBe("");
    expect(checkPlate("NB$123")).not.toBe("");
    expect(checkPlate("ABC")).not.toBe("");
    expect(checkVehicleType("x".repeat(41))).not.toBe("");
  });
  it("message and booking code", () => {
    expect(checkMessage("")).toBe("Write your message.");
    expect(checkBookingCode("sk-00142")).toBe("");
    expect(checkBookingCode("")).toBe("");
    expect(checkBookingCode("12345")).toBe("Booking codes look like SK-00142.");
  });
});

describe("field errors", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form><div class="field"><input id="email" /></div>
      <div class="field"><input id="name" /></div></form>`;
  });

  it("shows errors under the fields, links them, and focuses the first", () => {
    const email = document.getElementById("email");
    const name = document.getElementById("name");
    const ok = validateFields([
      [email, (v) => checkEmail(v)],
      [name, checkName],
    ]);
    expect(ok).toBe(false);
    expect(document.getElementById("emailError").textContent).toBe("Enter your email.");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")).toBe("emailError");
    expect(document.activeElement).toBe(email);
  });

  it("offers a one-tap fix that applies the suggestion", () => {
    const email = document.getElementById("email");
    email.value = "ana@gmail.co";
    validateFields([[email, (v) => checkEmail(v)]]);
    document.querySelector(".field-error-fix").click();
    expect(email.value).toBe("ana@gmail.com");
    expect(email.hasAttribute("aria-invalid")).toBe(false);
    expect(document.getElementById("emailError").hidden).toBe(true);
  });

  it("clears the error when shown with an empty message", () => {
    const name = document.getElementById("name");
    showFieldError(name, "Enter your name.");
    showFieldError(name, "");
    expect(document.getElementById("nameError").hidden).toBe(true);
    expect(name.hasAttribute("aria-invalid")).toBe(false);
  });
});
