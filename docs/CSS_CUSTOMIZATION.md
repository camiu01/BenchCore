<!-- @file CSS_CUSTOMIZATION.md @brief Source-level styling and component customization guide. -->

# Customize the interface

BenchCore keeps its engineering-log appearance and its light, dark and OLED
themes. No CSS framework knowledge or new dependencies are required to change
the shared design.

## Start here

Edit `frontend/src/lib/styles/custom.css`, then run `pnpm dev:frontend`.
This file is imported last in the `customization` cascade layer, so shared
selectors can be overridden without copying their specificity or using
`!important`. Leave the layer order in `frontend/src/app.css` intact.

### Change spacing, typography and component shape

```css
:root {
	--sheet-width: 800px;
	--sheet-padding: 32px;
	--sheet-padding-mobile: 24px 16px;
	--record-padding: 24px;
	--record-padding-mobile: 16px;
	--control-radius: 4px;
	--font-size-reading: 18px;
	--shadow-record: none;
}
```

Keep `--control-height` at least `44px` for touch accessibility. Widths are
maximums, not fixed viewport widths. Mobile padding has separate tokens so
changing desktop spacing does not squeeze narrow screens.

### Change a theme

```css
html[data-theme='light'] {
	--accent: #185b48;
	--accent-ink: #ffffff;
	--accent-bg: #e4eee9;
}
```

Set all three accent tokens together. Verify text contrast against both the
page and the filled controls in every theme you change. Use semantic tokens
such as `--ink`, `--muted`, `--sheet-bg`, `--control-border` and `--accent`,
not hardcoded light/dark colors inside component rules.

Changing `--bg` also requires updating the browser theme-color values in
`frontend/src/app.html` and `frontend/src/lib/theme.ts`; their pre-paint values
are deliberately independent of CSS loading.

### Change a shared component

```css
.record {
	border-style: dashed;
}

.record-title {
	text-transform: none;
}
```

To customize one instance, set a token on its container, for example
`.browse-actions { --control-radius: 4px; }`. Tokens inherited by controls
inside that container do not affect other pages.

## Where the styles live

| File under `frontend/src/` | Responsibility |
|---|---|
| `app.css` | Imports and cascade order only |
| `lib/styles/custom.css` | Your shared style overrides |
| `lib/styles/tokens.css` | Theme palettes, font, widths, padding, borders, shadows |
| `lib/styles/shell.css` | Sheet, heading, navigation, theme controls |
| `lib/styles/records.css` | Cards, badges and technical tables |
| `lib/styles/prose.css` | Sanitized Markdown, code, images and article tables |
| `lib/styles/topics.css` | Topic filters and archive cards |
| `lib/styles/graph.css` | Graph canvas and detail panel |
| `lib/styles/engagement.css` | Comments and engagement |
| `lib/styles/responsive.css` | Shared responsive adaptations |
| `lib/styles/motion.css` | Motion and reduced-motion handling |
| `lib/forms.css` | Form fields, buttons and upload controls |
| `lib/usability.css` | Shared readability and control sizing |
| `lib/browse.css` | Archive filters and breadcrumbs |
| `lib/admin-workspace.css` | Admin workspace layouts |
| `lib/accessibility.css` | Control contrast and high-contrast support |
| `lib/components/*.svelte` | Component markup and private scoped styles |

Svelte's scoped styles remain private and unlayered. Edit that component's
`<style>` block for its private layout rather than trying to beat it with
global selectors. Reuse shared tokens there. Keep business logic out of UI.
Existing shared classes remain available; no markup migration is needed.

## Verify your changes

Run `pnpm check`, `pnpm test`, `pnpm lint` and `pnpm build`.
After building, `pnpm test:e2e` exercises the disposable browser fixture.
`pnpm --filter benchcore-frontend exec playwright test styling.spec.ts`
checks custom tokens, cascade overrides, touch sizing and reduced motion.

Check real pages at 320px, 390px, 768px and desktop width, all three themes,
keyboard focus, long titles, article code/tables and disabled controls.
Do not remove focus indicators, reduce touch targets or hide document overflow
to conceal a layout problem.
