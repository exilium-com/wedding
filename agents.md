# Design wedding site shell

## Workflow Preferences

- Start visual-design work with ImageGen concepts and let the user refine/approve before implementation.
- Do not get lost in implementation when the user is still choosing between visual directions.
- When the user supplies production-like assets, treat those assets as the source of truth and tune toward pixel fidelity.
- Ask questions when animation, visual priority, or interaction behavior is unclear.
- Be concise and do not over-explain routine code changes.
- Preserve interaction work the user already likes when changing surrounding visuals.
- If screenshots reveal visible issues, name them plainly and fix them rather than hand-waving.

## Visual Direction

- The site should feel whimsical, handcrafted, tactile, and wedding-stationery inspired.
- Favor pressed paper, parchment, pressed flowers, wax seals, watercolor botanical details, pastel pinks, purples, oranges, sage greens, cream paper, and plum ink.
- The result should feel polished and award-site quality while still being readable and usable for elderly relatives.
- Keep text large, legible, and code-native; avoid baking important names, dates, venue text, nav labels, or UI copy into generated images.
- Avoid generic stock wedding styling, dense tiny text, confetti overload, fake browser chrome, and concepts that invent placeholder couple names.
- If generated concept art is the approved direction, the implementation should visibly match the concept, not merely reference the same assets.

## ImageGen And Assets

- Use ImageGen for visual assets: concept art, watercolor hero art, envelope/card pieces, pressed-flower paper, wax seals, and nav/header icons.
- For transparent icon or sprite assets, generate on a flat chroma-key background, then remove the key locally and keep final transparent PNGs in the repo.
- Copy selected generated files into project assets; do not move/delete originals from the Codex generated-images directory.
- Keep reusable generated site assets flat under `assets/`; avoid nested generated/source folders unless there is a concrete need.
- Resize oversized transparent icons down to sensible web asset dimensions after alpha cleanup.
- If a generated source asset has a chroma-key background, keep the source if useful but reference the transparent processed output from the app.

## Animation And Interaction

- For pixel-sensitive animation, reduce the moving parts before tuning. Prefer a small number of clear transforms over extra flourish.
- If layer assets are designed on a shared canvas, align them with identical boxes and avoid per-layer offsets.
- Use Motion for animation timing/easing when animation polish or controllable scroll duration matters.
- Native smooth scrolling does not expose duration; use Motion or a custom animation when scroll speed needs tuning.
- Keep initial and revealed states explicit so browser scroll restoration or hidden sections do not skip the intended first interaction.

## Tailwind And CSS Preferences

- Prefer Tailwind utility classes directly in the markup for layout and structure.
- Do not introduce `@apply` layout helper classes when the user asks for Tailwind.
- The `.script` helper is allowed and should stay for calligraphic text.
- Keep `styles.css` focused on font-face declarations, tiny global helpers, and animation selectors that are awkward or impossible in inline Tailwind.
- Avoid empty wrappers, unclear wrapper divs, and non-obvious structure. Markup should explain itself.
- Center nav items as a group and within each nav item.
- Preserve a single centered nav if the user has removed a split-nav structure.

## App Setup And Environment

- A real npm/Vite server is acceptable and often better than fighting `file://` module limitations.
- Keep the app simple; Vite plus static HTML/CSS/JS is enough unless the user explicitly asks for React.
- This WSL shell may not have Node on PATH by default. Check Codex history/env and use `PATH="$NVM_BIN:$PATH"` when `NVM_BIN` points at the Linux Node install.
- Bundled Windows Python may have Pillow when Linux Python does not. It can process WSL project files through `\\wsl.localhost\...` paths.
- Running helper scripts directly from the Windows-side `.codex` path may hit permission issues; copy a helper into the workspace temporarily only if needed, then remove it.
- Do not run builds unless the user explicitly reverses this instruction. Prefer code inspection for routine checks.

## Verification Notes

- Use rendered screenshots for visual work; static code inspection is not enough for pixel-sensitive layouts or animation.
- Check key visual states on desktop and mobile.
- Look for alignment drift, unintended section bleed, clipping, viewport whitespace, unreadable text, and mismatches from the approved concept.
- Do not run build checks by default; the user has explicitly asked not to run builds.
