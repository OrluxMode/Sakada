document.addEventListener("DOMContentLoaded", () => {
  // Top nav: slides away while the page scrolls, comes back once scrolling stops
  const nav = document.querySelector("header > .nav");
  if (nav) {
    let stopTimer;
    const show = () => nav.classList.remove("is-hidden");
    window.addEventListener(
      "scroll",
      () => {
        clearTimeout(stopTimer);
        const busy = nav.querySelector(".nav-links.open, :focus-visible");
        if (window.scrollY > nav.offsetHeight && !busy) nav.classList.add("is-hidden");
        stopTimer = setTimeout(show, 250);
      },
      { passive: true },
    );
    nav.addEventListener("focusin", show);
  }

  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  if (!toggle || !menu) return;

  if (menu.id) toggle.setAttribute("aria-controls", menu.id);

  const setOpen = (open) => {
    menu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (isOpen() && !menu.contains(e.target) && !toggle.contains(e.target)) {
      setOpen(false);
    }
  });

  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
});
