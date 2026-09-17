# Battle Documentary — Phase 5: QA + Polish

Phase 5 closes the Battle Documentary pass with repeatable checks, responsive QA targets, a bundle budget, and a manual verification matrix.

## Automated QA

Run from the repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:bundle
```

Or run the complete sequence with:

```bash
npm run qa
```

The CI workflow at `.github/workflows/qa.yml` runs the same typecheck, shared tests, production build, and bundle-budget check for pushes to `main` and for pull requests.

## Bundle budget

`tools/check-bundle.mjs` reports the largest generated JavaScript, CSS, and HTML assets and enforces a 4096 KiB aggregate budget by default. Override with `BUNDLE_BUDGET_KB` when the project intentionally changes its budget.

Example:

```bash
BUNDLE_BUDGET_KB=5120 npm run check:bundle
```

## Manual viewport matrix

| Viewport | Verify |
| --- | --- |
| 1917 × 915 | Full battlefield visible, HUD not clipped, Documentary style readable, symbols intact, frontline/influence below entities |
| 1600 × 900 | Same checks at the second desktop target; resize must keep the map centred |
| 390 × 844 | HUD controls remain reachable, Display Settings is usable, recap panel remains inside viewport, timeline is horizontally usable |

## Display settings matrix

Test all combinations that matter to the documentary renderer:

- Documentary / Vintage: map art changes while coordinates, symbols, and pathfinding remain unchanged.
- In-game overlays on/off: influence and frontline disappear and return without affecting simulation.
- Reduced motion on/off: decorative pulsing and animated arrow markers are suppressed when enabled.
- Formations on/off: no regressions to the core map or military symbols.
- Reload: settings persist on the same device.

## Battle Recap matrix

After a completed match:

1. Open `Battle Recap`.
2. Scrub from the beginning to the end.
3. Play at 0.25x, 0.5x, 1x, and 2x.
4. Step backward and forward across an event marker.
5. Confirm both sides' units and buildings reflect the selected recorded frame.
6. Confirm influence/frontline follows the selected frame.
7. Close the recap and confirm the live/post-match battlefield is restored.
8. Confirm live controls do not issue commands while replaying.

## Stress / performance matrix

- Run a 20+ minute match and watch for retained graphics, steadily increasing frame time, or stale units/buildings.
- With `?perf=1`, inspect the influence overlay average timing in DevTools.
- Compare overlay on/off during the same match to verify the overlay is presentation-only.
- Resize the window repeatedly between desktop aspect ratios and confirm only the presentation surface changes.

The influence implementation intentionally updates its control grid at a bounded cadence and smooths presentation values instead of touching simulation state. The Phase 1 performance test remains the regression guard for the computational envelope.

## Screenshot checklist

Capture these four screenshots for the release record:

1. Desktop 1917 × 915, Documentary, overlays on.
2. Desktop 1600 × 900, Documentary, overlays on.
3. Mobile 390 × 844, Display Settings open.
4. Completed battle with Battle Recap open on a mid-battle frame.

## Release note

A passing CI run proves the automated repository checks only. Browser screenshots, a real 20+ minute match, and visual inspection still need a human browser session because the repository does not provide a headless gameplay harness.
