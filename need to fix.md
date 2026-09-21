# Pre-Deployment QA Audit Report — Sakada Logistics

## 🔴 Critical — Will break the site or expose something sensitive

### 1. Contact form is broken — wrong element ID
| | |
|---|---|
| **File** | `sakada-web/js/contact.js:5` + `sakada-web/pages/contact.html:59` |
| **Issue** | JS references `document.getElementById("contactMessage")` but the HTML element has `id="contactFormMsg"`. `formMsg` is `null`, so every subsequent operation (`.className`, `.textContent`) throws `TypeError: Cannot read properties of null`. |
| **Fix** | Change `contact.js:5` to `document.getElementById("contactFormMsg")` |

### 2. Personal Mapbox API token hardcoded in source
| | |
|---|---|
| **File** | `sakada-web/js/mapbox-client.js:8` |
| **Issue** | Your personal Mapbox token (`qadriancarlo` namespace) is committed in plaintext. Anyone with repo access can extract and abuse it. |
| **Fix** | Revoke the token at mapbox.com, generate a new restricted-scopes token, and inject it via `config.js` or a runtime env var instead of hardcoding. |

### 3. `config.js` is never imported — runtime config overrides do nothing
| | |
|---|---|
| **File** | `sakada-web/js/supabase-client.js` + `sakada-web/js/config.js` |
| **Issue** | `config.js` exports a config object and supports `window.__SAKADA_CONFIG__` overrides, but `supabase-client.js` hardcodes its own Supabase URL and key independently. Any runtime config override you set on `window.__SAKADA_CONFIG__` is silently ignored. |
| **Fix** | Import `config.js` in `supabase-client.js` and use its values, or delete `config.js` entirely. |

### 4. Production domain SSL is broken
| | |
|---|---|
| **File** | `sakada-web/index.html:24,26,31` |
| **Issue** | `og:url`, `og:image`, and `twitter:image` meta tags reference `https://sakadalogistics.ph/`, but that domain returns `tlsv1 alert internal error` — the SSL certificate is misconfigured. Social sharing previews (Facebook, Twitter, Slack) will show broken images. |
| **Fix** | Fix the SSL cert on the production server before going live. |

### 5. Skip-to-content links broken on all 4 dashboard pages
| | |
|---|---|
| **Files** | `dashboard/farmer/index.html:20`, `dashboard/vendor/index.html:20`, `dashboard/driver/index.html:20`, `dashboard/admin/index.html:20` |
| **Issue** | All four have `<a href="#main" class="skip-link">Skip to content</a>`, but `<main class="dash-body">` has no `id="main"`. The skip link does nothing — an accessibility violation. |
| **Fix** | Add `id="main"` to the `<main>` element in each dashboard HTML file. |

---

## 🟡 Warning — Works now but likely to break in production

### 6. Two different Mapbox tokens in use
| | |
|---|---|
| **Files** | `js/config.js:20` vs `js/mapbox-client.js:8` |
| **Issue** | `config.js` has a generic Mapbox demo token; `mapbox-client.js` has a personal token. Neither references the other. If the personal token is revoked (as it should be per #2), map features will break silently. |
| **Fix** | Centralize all Mapbox token usage through `config.js`. |

### 7. `console.warn` left in production code
| | |
|---|---|
| **File** | `sakada-web/js/auth.js:60` |
| **Issue** | `console.warn("updateLastLogin:", error.message)` leaks internal error details to the browser console. |
| **Fix** | Remove or gate behind a `DEBUG` constant. |

### 8. Features page missing from primary navigation
| | |
|---|---|
| **Files** | All 9 pages with `<nav>` (index.html, 404.html, pages/*.html) |
| **Issue** | `pages/features.html` exists and is linked in all 8 footers, but is absent from every primary nav bar. Users won't discover it unless they scroll to the footer. |
| **Fix** | Add a "Features" link to the `<nav>` across all pages. |

### 9. Unused mobile hero image
| | |
|---|---|
| **File** | `sakada-web/assets/hero-mobile.jpg` (204KB) |
| **Issue** | The file exists on disk but is never referenced in any HTML or CSS. This is a dead asset or a missing responsive implementation. |
| **Fix** | Either add a `@media` rule in `css/nav.css` that swaps to this image on small screens, or delete it to reduce repo size. |

### 10. Empty `assets/images/` directory
| | |
|---|---|
| **File** | `sakada-web/assets/images/` |
| **Issue** | Directory exists but contains no files. May confuse future contributors. |
| **Fix** | Delete it if unused. |

---

## 🔵 Info — Cleanup suggestions, not urgent

### 11. `config.js` is an orphan module
| | |
|---|---|
| **File** | `sakada-web/js/config.js` |
| **Issue** | Never imported by any file. Contains duplicated Supabase credentials that duplicate `supabase-client.js`. |
| **Fix** | Either wire it in (see #3) or delete it. |

### 12. 8 pages missing `<meta name="description">`
| | |
|---|---|
| **Files** | `404.html`, `auth/login.html`, `auth/admin-login.html`, `auth/register.html`, `auth/callback.html`, `dashboard/admin/index.html`, `dashboard/farmer/index.html`, `dashboard/driver/index.html`, `dashboard/vendor/index.html` |
| **Issue** | No meta description. Low priority since all these have `<meta name="robots" content="noindex">`. |
| **Fix** | Add descriptions if you ever want them indexed, otherwise fine as-is. |

### 13. `callback.html` loads a narrower Google Fonts subset
| | |
|---|---|
| **File** | `auth/callback.html:10` |
| **Issue** | Loads only `Public+Sans:wght@400;500` while all other pages load `Barlow+Condensed` + `Public+Sans:wght@400;500;600;700`. Minor visual inconsistency during the OAuth redirect flash. |
| **Fix** | Unify to the same fonts URL used everywhere else. |

### 14. Planning docs are unreferenced (intentional)
| | |
|---|---|
| **Files** | `things-to-improve.md`, `things-to-improve-design.md` |
| **Issue** | Repo-level planning docs not linked from any code. Intentional — these are project management files. |
| **Fix** | No action needed. |

---

## ✅ Passed Checks (no issues found)

| Check | Result |
|---|---|
| Broken internal links | ✅ All local href/src/url() paths resolve correctly |
| Missing assets | ✅ All referenced images, CSS, JS, favicon exist |
| External links (CDN) | ✅ Google Fonts, Supabase CDN, DOMPurify CDN all return 200 |
| Mixed content | ✅ Zero `http://` resources found — all HTTPS |
| Hardcoded local paths | ✅ No `C:\`, `/Users/`, `/home/`, `localhost`, `127.0.0.1` in source |
| Forms & endpoints | ✅ All forms handled by JS, all fetch calls target real Mapbox/Supabase APIs |
| Duplicate IDs | ✅ Zero duplicates across all 17 pages |
| Required meta tags | ✅ `lang`, `charset`, `viewport`, `title` present on every page |
| .gitignore coverage | ✅ `.env` files properly excluded, no secrets committed |
| JS imports | ✅ All `import` statements resolve to existing files |
| CSS imports | ✅ All `@import` and stylesheet links resolve correctly |
| Navigation consistency | ✅ All 9 pages with nav have identical link sets |
| Footer consistency | ✅ All 8 pages with footer have identical link sets |

---

**Summary: 5 critical, 5 warnings, 4 info items.**
