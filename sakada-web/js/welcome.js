// Phone welcome screen (index.html). Loaded as a plain script right after
// the photo, so it runs before the first paint.

(function () {
  // If the photo isn't ready yet (slow connection), hide it and fade it in
  // once it has decoded, instead of letting it pop in over the text.
  // A cached photo is already complete and shows straight away.
  const img = document.querySelector(".welcome-photo img");
  if (img && !img.complete) {
    const photo = img.closest(".welcome-photo");
    photo.classList.add("is-loading");
    const show = () => photo.classList.remove("is-loading");
    img.addEventListener("load", () => img.decode().then(show, show), { once: true });
    img.addEventListener("error", show, { once: true });
  }

  // iOS Safari only applies :active to links when the page listens for
  // touches; without this the Get started press feedback never shows.
  document.addEventListener("touchstart", () => {}, { passive: true });
})();
