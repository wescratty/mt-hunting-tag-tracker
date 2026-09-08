# 2026 MT Hunting Tag Tracker

A personal field-reference tool for southwest Montana deer & elk hunting districts — pick a district, pick a tag/opportunity, and see whether it's open right now, based on the tags and licenses you say you hold. Built to answer "wait, can I shoot a cow elk here today?" from a phone in the field, with no cell service required once it's loaded.

Live at: `https://mt-hunting-tag-tracker.wescratty.workers.dev/` (Cloudflare Workers static assets).

This project started as one page inside a larger site and was ported out into its own standalone repo/deploy so it could stand on its own — see the Log at the bottom of this file for that history.

## Development process

This app was built through **AI pair programming**: Claude Code (Anthropic's agentic coding CLI) acted as the implementation partner, writing the HTML/CSS/JS for every feature and fix in `index.html`, while I directed the work as architect and reviewer. My side of that included writing the requirements and feature specs, making the architecture calls — e.g. the `/index.html` vs `/` service-worker alias fix under "Offline support" below, and the decision to port this out of a larger site into its own standalone repo (see the Log) — reviewing every diff, testing each change live in-browser (desktop and mobile) before accepting it, and handling deployment myself. I also did ordinary code review on the AI's output the same way I would on any teammate's: for example, the "filling in one district removes the tag from the others it's valid in" logic documented above was corrected through that review after an early version got it wrong, not written correctly on the first pass.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app — markup, styles, data, and logic in one file. |
| `hunting-tags.webmanifest` | Web app manifest ("Add to Home Screen" support). |
| `hunting-tags-sw.js` | Service worker — precaches the app shell so it works fully offline after the first load. |
| `wrangler.jsonc` | Cloudflare Workers static-assets deploy config (`npx wrangler deploy`). |
| `assets/` | Fonts, app icons, and the FWP identification-guide illustrations + district map (see "Icons" below). |
| `README.md` | This file. |

## How it works

- **Hunter Profile** (top of page): age, PTHFV holder, Bow and Arrow License, and whether they hold a General Deer/Elk License. Saved to `localStorage`, so it's a one-time setup. A `Done ✓` button at the bottom (`onProfileDoneClick()`) collapses the form via the same mechanism as the "Hide profile" toggle up top — a more natural way to dismiss it right after filling it out, rather than making the hunter hunt for a small checkbox elsewhere on the page.
- **District → Tag dropdowns**: pick one of the 13 districts, then one of that district's deer/elk opportunities. Each dropdown option is prefixed with a live status icon (✅ good to hunt now, ⏳ not open, 🔒 need the license/tag, 🏹 need Bow and Arrow License, 🚫 not eligible).
- **District Map button**: opens a reference map (Region 2/3 hunting district boundaries) in a dismissible overlay — for finding a district on the ground, not a legal source. Image lives at `assets/hunting/district-map-region2-3.png`. Solid navy background, white text (`.ht-map-btn`) — it used to be a white/bordered button, which read poorly outdoors on a phone.
- **Detail panel**: shows the season windows, restrictions, issuing method, a "do you have this tag?" checkbox for separately-purchased Deer B/Elk B tags and permits, and a collapsible definitions section for terms like "Antlered Buck" or "Brow-tined" (sourced from the regs' own definitions page). Checking "I have this tag" also turns on that district (and any other district the same B-tag/permit code is valid in) in the Field Card's district filter, so confirming a tag immediately shows its effect on the Field Card instead of leaving the hunter to separately discover and flip on the district filter themselves. Unchecking a tag does *not* remove the district from the filter — a hunter might still hold other tags there.
- **Field Card**: only the tags the hunter holds AND is eligible for AND are open right now (`overallState() === "good"`) — everything else is simply not shown, on purpose, for a clean glance. Shown by default (`fieldCardOpen = true`) and re-rendered live on every profile/tag change, so confirming a tag shows its effect immediately instead of requiring a separate "Show" click; the toggle button still lets the hunter collapse it out of the way. No color coding, just the animal icon with a bold `.ht-fc-label` header bar identifying *which physical tag/license this is* (`tagIdentityLabel()`) — not the animal-type description, which the icon and detail panel already cover. Tap the card to jump to its full detail. If nothing you hold is currently in season, the section says so instead of showing an empty grid — two different messages, not one: no districts picked yet in the filter (`distFilter.length === 0`) prompts the hunter to go pick some, versus districts picked but genuinely nothing "good" in them, which prompts checking licenses/tags instead. Conflating the two used to make an unpicked filter read as "you can't hunt anything," which isn't true. The full option list for a district is still one click away in the Tag / Opportunity dropdown — Field Card is deliberately not the comprehensive view. No dedicated Print button (removed — a screenshot covers the rare case someone wants a copy), but the `@media print` stylesheet is still in place, so a manual browser print/Ctrl+P still produces a clean Field-Card-only sheet if anyone goes looking for it.

  **`tagIdentityLabel()`**: an "included with license" row is just "General Deer" / "General Elk" — the label says what *license* it draws from, since every such row in every district draws from the same one physical tag (see below). A Deer B/Elk B tag or permit shows its code, e.g. "Deer B 260-01". A drawn *permit* (id contains `-deerp-`/`-elkp-`) is issued on top of the general license, not instead of it — real Montana permits work this way even on rows whose transcribed `restriction` text doesn't happen to spell it out — so the label says both: "General Elk & 270-45". A restriction-text check (`/must be used with a general/i`) is a safety net that also upgrades the one B-tag, `250-elkb-250-00`, that requires the general license despite its id.

  **Same-opportunity dedup**: the regs sometimes list one opportunity (e.g. "Either-sex Whitetail Deer") as two rows with different land/phase scope — a "private land, full season" row and a narrower-season "no restriction" row that happens to cover more ground while it's open. Both are real, separately-modeled tags, but when both are simultaneously "good" they render as two visually-identical icons with nothing to tell them apart. `renderFieldCard()` collapses this: only for "included with license" rows (never separately held, so showing one is enough) sharing the same `icon`, it keeps the first and drops the rest. Deer B/Elk B tags and permits are *never* collapsed this way, even if they share an icon — each is a distinct physical tag, and hiding one would hide that the hunter can take an animal under each. The Tag/Opportunity dropdown has the equivalent problem in the same rows and fixes it differently: `renderTagOptions()`/`tagDisambiguator()` appends a short `[private land]`/`[archery]`-style hint, but only to "General License" options with a colliding label — a Deer B/Elk B option's own code already tells it apart, so it's never hinted.

  **Filled**: once a tag is huntable ("good") or its season has closed ("off" — looking back to log it after the fact), the detail panel offers an "I filled this tag" checkbox (`onFilledChange()` / `mt-hunt-filled-v1` in `localStorage`). It's hidden until the hunter actually holds the tag — nothing to have filled otherwise. Checking it dims that tag's Field Card icon and overlays a big green checkmark, a persistent reminder that stays even while the season's still open (so a second animal under the same tag doesn't get taken by accident). Unlike "I have this tag", filling is **never** propagated to the other districts a shared code is valid in — `setFilledTag()` only ever touches the exact `(distId, tagId)` toggled. "Included with license" rows are filled per-tag, but the same-opportunity dedup above means the *other* half of a collapsed pair can be the one marked filled while its duplicate is what's actually shown — `renderFieldCard()` gathers filled-ness across the whole icon group before dropping duplicates, so the surviving card still shows the checkmark correctly.

  **Filling in one district removes the tag from the others it's valid in** — same principle as the general license below, applied to Deer B/Elk B tags and permits. `tagFilledElsewhere()` (used by `tagPossessed()`) checks whether the *same code* has been filled under a different district's tag row; if so, that other row drops to "need" with a "you've already filled your `{code}` tag in a different district this season" message, while the one actually filled keeps showing normally. **Known gap**: a few codes (`260-01`, `262-02`) let a hunter legally buy up to 3 of the same tag, valid in any of several districts — this logic doesn't count that, so filling one hides the others even if more are still unused. Accepted as-is rather than building quantity tracking for two codes out of the whole dataset; the workaround is to uncheck and re-check "I filled this tag" on another of that code's districts to log a second animal.

  **One general license, spent everywhere at once**: `profile.hasDeerLicense`/`hasElkLicense` are single flags, not per-district — there's only one General Deer License and one General Elk License to hold, each good for one animal. Every "included with license" row for that species, in every district, is just a different possible way to fill that same one physical tag. `generalLicenseFilledElsewhere()` (used by `tagPossessed()`) checks whether *any other* General License row for that species has been filled anywhere; if so, every row but the one actually filled drops to "need" — off the Field Card, 🔒 in the dropdown — with the detail panel and license-note explicitly saying it's already filled on a different tag, rather than the generic "license not checked" text. Unfilling reverses it immediately. Deer B/Elk B tags and permits are unaffected — those are separate physical tags, tracked independently.
- **Disclaimer gate**: blocks the whole page until the hunter checks an acknowledgment that this is a personal reference, not the regulations, and they're responsible for double-checking everything. Remembered per browser/device (`localStorage`), so it only shows once. Accepting it also auto-hides the identical on-page disclaimer copy right below (`acceptDisclaimer()` sets `hideDisclaimerCheck` and its `localStorage` key together) — no reason to make the hunter dismiss text they just read and agreed to a second time. `initHideToggle()` takes a `defaultHidden` param for exactly this: a returning hunter whose gate was accepted in an earlier visit, before ever touching "Hide disclaimer" here, gets the section defaulted to hidden too, not just first-time acceptance. Either way, an explicit past choice (the checkbox toggled by hand at some point) always wins over that default — `localStorage.getItem()` returning `null` (never explicitly set) is what triggers the default; `"0"` (explicitly shown) is respected as-is. The toggle up top still brings it back any time.

## Icons

Each tag/opportunity shows a real Montana FWP identification-guide illustration (`tagIconImg()` / `ICON_IMG` in the script) — plain white background, square, no color coding, no text baked into the image itself. The image is still the primary signal: antlers visible = antlered-only, no antlers = antlerless-only, two animals together = either-sex; the `.ht-fc-label` bar above it on the Field Card names the specific tag in text so nobody has to rely on the illustration alone. Files live at `assets/hunting/icons/<iconKey>.png`, one per `tag.icon` value: `wtdBuck`/`wtdEither`/`wtdDoe`/`mdBuck`/`mdEither`/`mdDoe`/`elkBull`/`elkEither`/`elkCow` (the 9 in active use) plus **`elkSpike`, reserved but not wired to any current tag** — trimmed and padded to a consistent 320×320 square. Sourced from official FWP identification-guide screenshots; watch for source screenshots with a non-white (e.g. light gray-blue) background baked in if these ever need reprocessing — a naive "pad with white" pass doesn't clean those, the near-background color has to be detected and replaced first, or the pad shows through as a visible tint.

### `elkSpike` — reserved, not yet used

Montana's elk regs have a third bull category beyond antlered/brow-tined: **Spike Bull** ("antlers that do not branch, or if branched, the branch is less than 4 inches long"). None of this app's 13 districts currently have a Spike Bull-only tag (it shows up in HDs like 339/343, which aren't in the data), so `elkSpike` isn't referenced by `ICON_IMG` lookups from any tag today. **Do not** use it as a stand-in for `elkBull`/`elkEither` on "Brow-tined Bull" tags — a spike, by definition, does *not* satisfy a brow-tine requirement, so that swap would make the icon wrong, not just imprecise. If a future district needs a genuine Spike Bull tag, set that tag's `icon` to `"elkSpike"` directly; the image is already trimmed, resized, and precached, so no other wiring is needed.

In the **detail panel**, a locked tag (not held, not eligible, or missing the Bow and Arrow License for an archery-only window) renders desaturated via a CSS `grayscale` filter on the `<img>`. In the **Field Card**, locked tags don't render at all rather than showing grayed-out (see above) — so the grayscale treatment only ever appears in the detail panel now.

Each Field Card button stays a single square illustration; `.ht-fc-label` is layered on top of it as a semi-opaque banner across the top edge rather than adding a row and growing the card, on purpose — happy to cover a little of an antler tip if it keeps the grid compact. That's also why the caveat warning badge lives bottom-right on the Field Card specifically (`.ht-fc-card .icon-wrap .ht-caveat-corner`) instead of its usual top-right (still top-right in the detail panel, which has no label banner) — otherwise the two would overlap. Same label, on screen and in print alike (no separate print-only element needed).

### Caveat flags (⚠️)

The icon-only design can't show every legal nuance — a "buck" or "bull" image can't distinguish an unrestricted tag from one with a real qualifier the state's own regs care about. `tagCaveats(tag)` in the script flags three cases by pattern-matching the tag's `label`/`restriction` text:

- **Brow-tined bull required** (label contains "Brow-tined") — MT's regs define this as a specific anatomical qualifier (a point ≥4" on the lower half of a main beam), not just "any antlered bull." This is the common case for most Region 2 general elk licenses; Region 3's "Either-sex Elk" wording does *not* carry this restriction, which is exactly why the label text is preserved verbatim from each region's own regs rather than normalized.
- **Antler-point-restricted permit** (restriction matches `/\d+\s*points?\s*(or fewer|or less|maximum|max)/i`) — e.g. HD 270-51's "3 points or fewer on one side."
- **Limited weapon types** (restriction mentions "shotgun" or "traditional handgun") — tags valid for a specific weapon set narrower than a normal season, distinct from the Bow and Arrow License gate.

A flagged tag gets a small ⚠️ badge in the corner of its icon (`caveatCornerHTML()`, both in the Field Card and the detail panel's icon box — carries a `title` tooltip, but that's a desktop-hover bonus only, not load-bearing, since tapping the button already opens the full detail popup). In the detail panel, the same mark also appears inline on whichever specific line triggered it (`caveatInlineHTML()`, no tooltip) — the headline for a label-based flag, the Restrictions line for a restriction-based one. **The actual reason is always plain visible text, never hidden behind hover** — title tooltips don't work on touch, so nothing important can depend on one. For a restriction-based flag the restriction text itself already is the visible reason; for a label-based flag (no nearby explanatory text otherwise) `renderDetail()` adds a dedicated `.ht-caveat-note` callout right under the headline. Adding a new caveat category is one more block in `tagCaveats()` — no changes needed elsewhere.

## Data source & scope

Hand-transcribed from the **2026 Montana Deer, Elk & Antelope regulations** (FWP), covering hunting districts **211, 240, 250, 260, 261, 262, 270** (Bitterroot Valley / Region 2) and **302, 319, 321, 329, 331, 340** (Big Hole / Beaverhead / Region 3). Definitions (Antlered Buck, Antlerless, Brow-tined, Either-sex, etc.) are from page 9 of that same document.

Region 3 districts share several multi-district B-tags (`003-00`, `399-00`, etc., "valid in all Region 3 HDs") — these are entered as the same `code` + `species` on each district they apply to, so the app's existing cross-district propagation (confirm once, it marks everywhere that code is valid) picks them up automatically.

A few entries in the data are flagged inline as "confirm current details" where the source PDF's table layout was genuinely ambiguous (multi-line wrapped cells in a dense table) rather than guessed with false confidence — search the district data for that phrase if auditing.

**This is not an authoritative legal source.** The disclaimer gate and the persistent privacy note both say so, and this README doesn't either — always confirm against [fwp.mt.gov](https://fwp.mt.gov/hunt/regulations).

### Updating for a new season

All season dates live as named constants near the top of the `<script>` block in `index.html` (`P_ARCH`, `P_GEN`, `P_MUZZ`, `P_LATE`, etc.) — one edit to a constant updates every tag that references it. District-specific exceptions (e.g. HD 260's archery-district general season, HD 262's short buck-permit window) have their own named constants for the same reason. The `DISTRICTS` object below that holds each district's tag list, referencing those phase constants plus per-tag `restriction`, `issue`, and optional `eligibility` fields.

When the new year's regs come out:
1. Re-verify every phase constant's dates.
2. Walk each district's tag list for anything that changed (new B-license codes, quota changes, retired permits).
3. Bump `CACHE_NAME` in `hunting-tags-sw.js` (e.g. `mt-hunting-tag-tracker-v1` → `-v2`) — otherwise returning visitors with a signal stay stuck on last year's cached copy.

## Storage / privacy

Everything is `localStorage`, scoped to whichever browser/device it's opened on — nothing is sent to a server. Keys in use:

- `mt-hunt-tags-v1` — confirmed Deer B/Elk B tags and permits, per district.
- `mt-hunt-filled-v1` — tags marked "filled" (an animal already taken under them), per district.
- `mt-hunt-profile-v1` — age, PTHFV, Bow and Arrow License, General Deer/Elk License.
- `mt-hunt-distfilter-v1` — which districts the Field Card shows.
- `mt-hunt-disclaimer-accepted-v1` — whether the gate has been accepted on this browser.

Because it's per-browser, filling it out on a PC does **not** carry over to a phone — the page itself says this in the privacy note, but it's worth remembering when testing.

## Offline support

`hunting-tags-sw.js` precaches an explicit allowlist of same-origin paths (the page itself, the Rye font, the app icons, the district map image, all icon images) on first load, then serves them cache-first so the page works with zero connectivity afterward — closed tab, airplane mode, phone restart, etc.

**The `/index.html` vs `/` alias** (read this before touching the service worker): Cloudflare's static-asset hosting 307-redirects a request for `/index.html` to the clean canonical URL `/`. Chrome refuses to let a service worker satisfy a top-level navigation with a response reached via a followed redirect — this combination produces `net::ERR_FAILED` for any visitor who types/bookmarks/links the `/index.html` form once the service worker is installed. `hunting-tags-sw.js` handles this by treating `/index.html` and `/` as one resource end to end (`canonicalPath()`), so the fix is already in place from this repo's first commit — this cost real debugging time on the site this app was ported from (a sibling `.html` page under a shared domain hit the exact same bug in production), don't reintroduce it by precaching a literal `.html` path here.

Note: service worker registration could not be verified inside automated preview tooling during development (it blocks SW registration entirely) — verify with a real-browser test (phone or desktop) after any deploy: load with a signal, then reload in airplane mode.

## Local development

No build step:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`. A plain `file://` open works for a quick look, but the service worker and manifest only function over `http(s)://`, and the `/index.html` vs `/` redirect behavior described above doesn't exist locally (that's a Cloudflare-specific production behavior) — a bug in that logic won't show up in local testing, only after a real deploy.

## Deployment

Cloudflare Workers static assets, same pattern as this author's other small standalone tools:

```bash
npx wrangler deploy
```

Reads `wrangler.jsonc` (`name: "mt-hunting-tag-tracker"`). First deploy gets a free `mt-hunting-tag-tracker.<account>.workers.dev` subdomain automatically — no domain purchase needed to start. A real custom domain can be pointed at the same Worker later without changing anything else here.

## Log

- 2026-09-07: Ported out of a larger multi-page site into this standalone repo (git history before this point lives in that other repo, not here). Rewrote all asset paths for a flat single-app layout, replaced the shared site's header/nav/footer with a minimal standalone version, replaced localStorage key prefixes (`wtc-hunting-` → `mt-hunt-`), replaced the parent site's shared branding/logo/favicons with a placeholder mountain icon (real logo/icon design still open, see any open issues), pointed the "request a district" link at this repo's GitHub Issues instead of a contact form that no longer applies here, and updated the service worker's precache list and `.html`-alias handling for the new `/` root layout. App logic, data, and UI behavior are otherwise unchanged from the source.
