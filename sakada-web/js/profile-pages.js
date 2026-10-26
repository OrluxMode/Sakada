// The pages inside the Profile tab: Edit profile (photo, name, password) and
// Saved addresses with its add/edit sheet. Figma 334:1579–334:1736 and
// 335:1698–335:1957. The dashboard owns routing, sheets and the pin map;
// this module owns what's on these pages.

import { t } from "./i18n.js";
import { supabase } from "./supabase-client.js";
import { checkName, checkPassword, checkNewPassword, checkAddress } from "./validators.js";
import { validateFields, clearWhenFixed, clearFieldErrors, showFieldError } from "./field-errors.js";
import { paintAvatar, squarePhoto, uploadAvatar, removeAvatarFile } from "./avatar.js";
import { geocodeAddress, suggestPlaces } from "./mapbox-client.js";
import { attachPlaceSuggest } from "./place-suggest.js";
import { toastSuccess } from "./toast.js";
import { sendPasswordReset } from "./auth.js";
import { resetErrorCopy } from "./signup-result.js";
import {
  SAVED_LIMIT, listSaved, addSaved, updateSaved, deleteSaved, checkSavedLabel, savedErrorCopy,
} from "./saved-addresses.js";

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * @param {object} o
 * @param {object} o.profile           the signed-in profile (full_name and avatar_url change in place)
 * @param {(d: HTMLDialogElement) => void} o.openSheet
 * @param {(d: HTMLDialogElement) => Promise<void>} o.closeSheet
 * @param {() => string} o.initials    initials for the current name
 * @param {() => void} o.onProfileChange  name or photo saved: repaint the rest of the page
 * @param {() => void} o.onSavedChange    saved addresses changed (Book's list, the count)
 * @param {(which: "saved") => void} o.pinOnMap
 * @param {() => boolean} o.isOffline
 */
export function createProfilePages({ profile, openSheet, closeSheet, initials, onProfileChange, onSavedChange, pinOnMap, isOffline }) {
  const $ = (id) => document.getElementById(id);
  let user = null;

  // ---------- Edit profile ----------
  const form = $("profileForm");
  const nameInput = $("editName");
  const saveBtn = $("saveProfile");
  const photoNote = $("photoNote");
  const editAvatar = $("editAvatar");
  let pendingPhoto = null; // a Blob ready to upload
  let previewUrl = "";
  let dropPhoto = false;
  let savedTimer = 0;

  const dirty = () => Boolean(pendingPhoto) || dropPhoto || nameInput.value.trim() !== profile.full_name;
  const syncSave = () => {
    if (saveBtn.hasAttribute("data-saved") && dirty()) clearSaved();
    saveBtn.disabled = !dirty() || saveBtn.getAttribute("aria-busy") === "true";
  };
  function clearSaved() {
    clearTimeout(savedTimer);
    saveBtn.removeAttribute("data-saved");
  }
  clearWhenFixed([[nameInput, checkName]]);
  nameInput.addEventListener("input", syncSave);

  /** The photo in the editor: the new one being tried, nothing, or the saved one. */
  function paintEditor({ fade = false } = {}) {
    const url = dropPhoto ? "" : previewUrl || profile.avatar_url;
    paintAvatar(editAvatar, { url, initials: initials() });
    $("removePhoto").hidden = !url;
    if (fade && !reduceMotion()) editAvatar.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT });
  }
  function forgetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    pendingPhoto = null;
  }

  $("changePhoto").addEventListener("click", () => $("photoInput").click());
  $("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same photo again still counts
    if (!file) return;
    photoNote.classList.remove("is-bad");
    photoNote.textContent = t("Getting your photo ready…");
    try {
      const blob = await squarePhoto(file);
      forgetPreview();
      pendingPhoto = blob;
      previewUrl = URL.createObjectURL(blob);
      dropPhoto = false;
      photoNote.textContent = t("New photo. Save changes to use it.");
      paintEditor({ fade: true });
    } catch (err) {
      photoNote.classList.add("is-bad");
      photoNote.textContent = err.message === "not-image"
        ? t("That file isn't a photo. Pick a JPG or PNG.")
        : t("Couldn't open that photo. Try another one.");
    }
    syncSave();
  });
  $("removePhoto").addEventListener("click", () => {
    const had = Boolean(previewUrl || profile.avatar_url);
    forgetPreview();
    dropPhoto = Boolean(profile.avatar_url);
    photoNote.classList.remove("is-bad");
    photoNote.textContent = had && dropPhoto ? t("Photo removed. Save changes to confirm.") : "";
    paintEditor({ fade: true });
    syncSave();
    $("changePhoto").focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!dirty() || saveBtn.getAttribute("aria-busy") === "true") return;
    $("profileSaveError").hidden = true;
    if (!validateFields([[nameInput, checkName]])) return;
    const name = nameInput.value.trim();
    const oldUrl = profile.avatar_url || null;
    saveBtn.setAttribute("aria-busy", "true");
    saveBtn.disabled = true;
    saveBtn.querySelector(".rq-save-face").textContent = t("Saving…");
    let newUrl = oldUrl;
    let error = null;
    try {
      if (pendingPhoto) newUrl = await uploadAvatar(user?.id || profile.id, pendingPhoto);
      else if (dropPhoto) newUrl = null;
    } catch (err) {
      error = { photo: true, err };
    }
    if (!error) {
      const { error: dbError } = await supabase.from("profiles").update({ full_name: name, avatar_url: newUrl }).eq("id", profile.id);
      if (dbError) {
        error = { err: dbError };
        if (newUrl && newUrl !== oldUrl) removeAvatarFile(profile.id, newUrl); // don't leave the upload behind
      }
    }
    saveBtn.removeAttribute("aria-busy");
    saveBtn.querySelector(".rq-save-face").textContent = "Save changes";
    if (error) {
      const notReady = /bucket/i.test(String(error.err?.message || ""));
      $("profileSaveError").textContent = error.photo
        ? t(notReady ? "Photos can't be saved yet. Save your name for now, or try again later." : "The photo didn't upload. Check your signal and try again.")
        : t("It didn't save. Check your signal and try again.");
      $("profileSaveError").hidden = false;
      syncSave();
      return;
    }
    profile.full_name = name;
    profile.avatar_url = newUrl;
    if (oldUrl && oldUrl !== newUrl) removeAvatarFile(profile.id, oldUrl);
    forgetPreview();
    dropPhoto = false;
    photoNote.textContent = "";
    paintEditor();
    onProfileChange();
    // "Saved" for 2 seconds, then back to Save changes (off until the next change).
    saveBtn.setAttribute("data-saved", "");
    $("saveStatus").textContent = t("Profile saved");
    savedTimer = setTimeout(clearSaved, 2000);
    syncSave();
  });

  // ---------- Password ----------
  const pwForm = $("passwordForm");
  const pwToggle = $("passwordToggle");
  const current = $("currentPassword");
  const fresh = $("newPassword");
  const differs = (v) => checkNewPassword(v) || (v && v === current.value ? t("Use a password that's different from your current one.") : "");
  clearWhenFixed([[current, checkPassword], [fresh, differs]]);

  /** Open or close the password form in place: height and fade, 200ms in, 150ms out. */
  let pwClosing = null; // reopening mid-close cancels it, so the close can't hide the reopened form
  function setPasswordOpen(open) {
    pwToggle.setAttribute("aria-expanded", String(open));
    pwClosing?.cancel();
    pwClosing = null;
    $("passwordHeading").textContent = t(open ? "Change password" : "Password");
    $("passwordSub").hidden = open;
    if (open) {
      pwForm.hidden = false;
      if (!reduceMotion()) {
        pwForm.animate([{ height: "0px", opacity: 0 }, { height: `${pwForm.scrollHeight}px`, opacity: 1 }], { duration: 200, easing: EASE_OUT });
      }
      current.focus();
      return;
    }
    const done = () => {
      if (pwToggle.getAttribute("aria-expanded") === "true") return;
      pwForm.hidden = true;
      pwForm.reset();
      pwForm.querySelectorAll("[data-show-for]").forEach((b) => setShown(b, false));
      clearFieldErrors([current, fresh]);
      $("passwordError").hidden = true;
      $("resetNote").hidden = true;
      $("forgotCurrent").hidden = false;
    };
    if (reduceMotion()) return done();
    pwClosing = pwForm.animate([{ height: `${pwForm.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 150, easing: EASE_OUT });
    pwClosing.finished.then(done, done);
  }
  pwToggle.addEventListener("click", () => setPasswordOpen(pwToggle.getAttribute("aria-expanded") !== "true"));
  $("cancelPassword").addEventListener("click", () => {
    setPasswordOpen(false);
    pwToggle.focus();
  });
  function setShown(btn, on) {
    $(btn.dataset.showFor).type = on ? "text" : "password";
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = t(on ? "Hide" : "Show");
  }
  pwForm.querySelectorAll("[data-show-for]").forEach((b) => {
    b.addEventListener("click", () => setShown(b, b.getAttribute("aria-pressed") !== "true"));
  });
  // Forgot the current one: email a reset link to the account (Figma 338:2937).
  $("forgotCurrent").addEventListener("click", async () => {
    const btn = $("forgotCurrent");
    if (btn.disabled || !user?.email) return;
    btn.disabled = true;
    btn.textContent = t("Sending a reset link…");
    $("passwordError").hidden = true;
    let error;
    try {
      ({ error } = await sendPasswordReset(user.email));
    } catch (err) {
      error = err;
    }
    btn.disabled = false;
    btn.textContent = t("Forgot your current password?");
    if (error) {
      $("passwordError").textContent = resetErrorCopy(error);
      $("passwordError").hidden = false;
      return;
    }
    btn.hidden = true;
    $("resetNoteText").textContent = `Check ${user.email} and open the link on this phone to set a new password.`;
    $("resetNote").hidden = false;
  });

  pwForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("updatePassword");
    if (btn.disabled) return;
    $("passwordError").hidden = true;
    if (!validateFields([[current, checkPassword], [fresh, differs]])) return;
    btn.disabled = true;
    btn.textContent = t("Checking…");
    const fail = (msg) => {
      btn.disabled = false;
      btn.textContent = t("Update password");
      if (msg) {
        $("passwordError").textContent = msg;
        $("passwordError").hidden = false;
      }
    };
    try {
      // Supabase doesn't ask for the old password, so check it by signing in with it.
      const { error: wrong } = await supabase.auth.signInWithPassword({ email: user?.email || "", password: current.value });
      if (wrong) {
        fail("");
        if (wrong.status === 400 || /invalid/i.test(wrong.message || "")) {
          showFieldError(current, t("That's not your current password."));
          current.focus();
          return;
        }
        return fail(t("Couldn't check your password. Check your signal and try again."));
      }
      btn.textContent = t("Updating…");
      const { error } = await supabase.auth.updateUser({ password: fresh.value });
      if (error) {
        if (error.code === "same_password") {
          fail("");
          showFieldError(fresh, t("That's your current password. Pick a new one."));
          return fresh.focus();
        }
        if (error.code === "weak_password") {
          fail("");
          showFieldError(fresh, t("Pick a stronger password: longer, with numbers or symbols."));
          return fresh.focus();
        }
        if (error.code === "reauthentication_needed") return fail(t("For your safety, log out and log back in, then change your password."));
        return fail(t("Your password didn't change. Check your signal and try again."));
      }
    } catch {
      return fail(t("Your password didn't change. Check your signal and try again."));
    }
    fail("");
    setPasswordOpen(false);
    pwToggle.focus();
    toastSuccess(t("Password changed."));
  });

  // ---------- Saved addresses ----------
  let rows = [];
  let state = "loading"; // loading | ready | error
  const box = $("savedBox");
  const BOOKMARK = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1z"/></svg>';
  const PLUS = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const CHEV = '<svg class="rq-row-chev" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6.5 5.5 5.5-5.5 5.5"/></svg>';

  async function loadSaved() {
    state = "loading";
    renderSaved();
    try {
      rows = await listSaved();
      state = "ready";
    } catch {
      rows = [];
      state = "error";
    }
    renderSaved();
    onSavedChange();
  }

  function renderSaved({ arrived = null } = {}) {
    $("savedCount").textContent = state === "ready" && rows.length ? String(rows.length) : "";
    $("savedIntro").hidden = state === "ready" && !rows.length;
    if (state === "loading") {
      box.innerHTML = '<p class="rq-muted rq-saved-note">Loading your saved addresses…</p>';
      return;
    }
    if (state === "error") {
      box.innerHTML = `<div class="rq-banner rq-banner--bad" role="alert"><p>${t("Couldn't load your saved addresses. Check your signal and try again.")} <button type="button" class="rq-link" data-saved-reload>${t("Try again")}</button></p></div>`;
      return;
    }
    if (!rows.length) {
      box.innerHTML = `
        <div class="rq-saved-empty">
          <span class="rq-saved-mark">${BOOKMARK}</span>
          <h2>No saved addresses yet</h2>
          <p>Save your farm, stall or warehouse once. Next time you book, pick it in one tap.</p>
          <button type="button" class="rq-btn rq-bbtn" data-saved-add>${PLUS}Add an address</button>
        </div>`;
      return;
    }
    const full = rows.length >= SAVED_LIMIT;
    box.innerHTML = `
      <ul class="rq-saved-list">
        ${rows.map((r) => `
          <li data-saved-row="${esc(r.id)}"${r.id === arrived ? ' class="is-new"' : ""}>
            <button type="button" class="rq-saved-item" data-saved-edit="${esc(r.id)}" aria-haspopup="dialog">
              <span class="rq-saved-mark">${BOOKMARK}</span>
              <span class="rq-saved-words"><strong>${esc(r.label)}</strong><span>${esc(r.address)}</span></span>
              ${CHEV}
            </button>
          </li>`).join("")}
      </ul>
      ${full ? "" : `<button type="button" class="rq-btn rq-bbtn rq-btn--ghost rq-saved-add" data-saved-add>${PLUS}${t("Add an address")}</button>`}
      <p class="rq-saved-note">${full ? t("That's {n}, the most you can save. Delete one to add another.", { n: SAVED_LIMIT }) : t("You can save up to {n}.", { n: SAVED_LIMIT })}</p>`;
  }

  box.addEventListener("click", (e) => {
    if (e.target.closest("[data-saved-reload]")) return loadSaved();
    if (e.target.closest("[data-saved-add]")) return openSavedSheet();
    const edit = e.target.closest("[data-saved-edit]");
    if (edit) openSavedSheet({ row: rows.find((r) => r.id === edit.dataset.savedEdit) });
  });

  // ---------- Add / edit sheet ----------
  const sheet = $("savedSheet");
  const sForm = $("savedForm");
  const label = $("savedLabel");
  const address = $("savedAddress");
  const delBtn = $("savedDelete");
  let editing = null; // the row being edited, or null when adding
  let picked = null; // { address, geo } the address field still says
  let armTimer = 0;

  const labelCheck = (v) => checkSavedLabel(v, rows, editing?.id ?? null);
  const addressCheck = (v) => (v.trim() ? checkAddress(v, "") : t("Enter the address."));
  clearWhenFixed([[label, labelCheck], [address, addressCheck]]);

  function syncQuick() {
    const v = label.value.trim().toLowerCase();
    sheet.querySelectorAll("[data-name]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.name.toLowerCase() === v)));
  }
  label.addEventListener("input", syncQuick);
  $("savedQuick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-name]");
    if (!b) return;
    label.value = b.dataset.name;
    label.dispatchEvent(new Event("input", { bubbles: true }));
    if (!address.value.trim()) address.focus();
  });

  function setPicked(place) {
    address.value = place.address.slice(0, address.maxLength);
    picked = { address: address.value.trim(), geo: place.geo };
    address.dispatchEvent(new Event("input", { bubbles: true }));
  }
  address.addEventListener("input", () => {
    if (picked && picked.address !== address.value.trim()) picked = null;
  });
  attachPlaceSuggest({
    input: address,
    row: sheet.querySelector(".rq-saved-row"),
    host: sheet.querySelector(".rq-saved-address"),
    search: suggestPlaces,
    canSearch: () => !isOffline(),
    onPick: setPicked,
    emptyAction: { label: t("Pin it on the map instead"), run: () => pinOnMap("saved") },
  });
  sheet.querySelector("[data-pin-saved]").addEventListener("click", () => pinOnMap("saved"));

  function disarmDelete() {
    clearTimeout(armTimer);
    delete delBtn.dataset.armed;
    delBtn.textContent = t("Delete address");
  }

  /** Add (empty, or filled from a place picked on Book) or edit a saved address. */
  function openSavedSheet({ row = null, prefill = null } = {}) {
    if (!row && rows.length >= SAVED_LIMIT) {
      toastSuccess(t("You can save up to {n} addresses. Delete one to add another.", { n: SAVED_LIMIT }));
      return;
    }
    editing = row;
    sForm.reset();
    clearFieldErrors([label, address]);
    $("savedError").hidden = true;
    disarmDelete();
    $("savedTitle").textContent = t(row ? "Edit address" : "Add an address");
    delBtn.hidden = !row;
    const start = row
      ? { address: row.address, geo: { lat: Number(row.lat), lng: Number(row.lng), placeName: row.address, city: row.city || "" } }
      : prefill;
    label.value = row?.label || "";
    address.value = start?.address || "";
    picked = start ? { address: address.value.trim(), geo: start.geo } : null;
    syncQuick();
    openSheet(sheet);
  }

  sForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("savedSave");
    if (btn.disabled) return;
    $("savedError").hidden = true;
    if (!validateFields([[label, labelCheck], [address, addressCheck]])) return;
    btn.disabled = true;
    btn.textContent = t("Saving…");
    const done = () => {
      btn.disabled = false;
      btn.textContent = t("Save address");
    };
    const text = address.value.trim();
    let geo = picked?.address === text ? picked.geo : null;
    if (!geo) {
      try {
        geo = await geocodeAddress(text);
      } catch {
        done();
        showFieldError(address, t("Couldn't find that address. Pick one from the list or pin it on the map."));
        return address.focus();
      }
    }
    const row = { label: label.value.trim(), address: text, lat: geo.lat, lng: geo.lng, city: geo.city || null };
    let saved;
    try {
      saved = editing ? await updateSaved(editing.id, row) : await addSaved(row);
    } catch (err) {
      done();
      $("savedError").textContent = savedErrorCopy(err);
      $("savedError").hidden = false;
      return;
    }
    done();
    rows = editing ? rows.map((r) => (r.id === saved.id ? saved : r)) : [...rows, saved];
    state = "ready";
    await closeSheet(sheet);
    renderSaved({ arrived: editing ? null : saved.id });
    onSavedChange();
    toastSuccess(t(editing ? "Saved changes to “{name}”." : "Saved “{name}”.", { name: saved.label }));
  });

  // Delete asks for a second tap within 4 seconds, so a slip doesn't lose it.
  delBtn.addEventListener("click", async () => {
    if (!editing) return;
    if (!("armed" in delBtn.dataset)) {
      delBtn.dataset.armed = "";
      delBtn.textContent = t("Tap again to delete “{name}”", { name: editing.label });
      armTimer = setTimeout(disarmDelete, 4000);
      return;
    }
    disarmDelete();
    delBtn.disabled = true;
    const gone = editing;
    try {
      await deleteSaved(gone.id);
    } catch (err) {
      delBtn.disabled = false;
      $("savedError").textContent = savedErrorCopy(err);
      $("savedError").hidden = false;
      return;
    }
    delBtn.disabled = false;
    await closeSheet(sheet);
    const li = box.querySelector(`[data-saved-row="${CSS.escape(gone.id)}"]`);
    if (li && !reduceMotion()) {
      // The row folds away so the list doesn't jump.
      await li.animate([{ opacity: 1, height: `${li.offsetHeight}px` }, { opacity: 0, height: "0px" }], { duration: 200, easing: EASE_OUT }).finished.catch(() => {});
    }
    rows = rows.filter((r) => r.id !== gone.id);
    renderSaved();
    onSavedChange();
    toastSuccess(`Deleted “${gone.label}”.`);
  });
  sheet.addEventListener("close", disarmDelete);

  return {
    /** The account (email, sign-in kind) once it's loaded. */
    setUser(u) {
      user = u;
      $("editEmail").textContent = u?.email || "";
      const providers = u?.app_metadata?.providers || [u?.app_metadata?.provider].filter(Boolean);
      const googleOnly = providers.length > 0 && !providers.includes("email");
      pwToggle.hidden = googleOnly;
      $("googleNote").hidden = !googleOnly;
      if (googleOnly) pwForm.hidden = true;
    },
    /** Opening Edit profile: start from what's saved. */
    openEdit() {
      forgetPreview();
      dropPhoto = false;
      clearSaved();
      nameInput.value = profile.full_name;
      clearFieldErrors([nameInput]);
      $("profileSaveError").hidden = true;
      photoNote.textContent = "";
      paintEditor();
      syncSave();
    },
    loadSaved,
    saved: () => (state === "ready" ? rows : []),
    canSave: () => state === "ready" && rows.length < SAVED_LIMIT,
    openSavedSheet,
    /** The point and address the add/edit sheet holds (for where the map starts). */
    savedPicked: () => (sheet.open && picked ? picked : null),
    /** A spot pinned on the map for the add/edit sheet. */
    setSavedSpot(spot) {
      setPicked(spot);
      $("savedSave").focus();
    },
  };
}
