# Kilinochchi Marks System — UI/UX Audit

## Scope

The audit covers the complete React interface: 39 page modules, the authenticated application shell, three login portals, public status/election views, shared UI primitives, Material UI theme configuration, responsive navigation, tables, forms, dialogs, cards, feedback states, and loading behavior.

No routes, Firebase collections, authentication rules, permissions, calculations, validation, or academic workflows are changed by the design-system work.

## Application inventory

- Administrative setup: classrooms, subjects, terms, practice exams, school defaults, academic data health.
- Student operations: students, accounts, subject enrollment, lists, class data, and class shuffle.
- Staff operations: teachers, subject assignments, and class-teacher assignments.
- Marks: teacher/admin mark entry, SBA, bulk upload, completion status, and live status.
- Reporting: class reports, mark sheets, report cards, completion, and subject analysis.
- Specialist workflows: promotion, election counting/live results, prefect records, and finance records.
- Shared shell: role-aware desktop drawer, mobile drawer, bottom navigation, page metadata, loading and route guards.

## Findings before the refactor

### Foundations

- Only a light palette existed; dark and high-contrast modes were unavailable.
- Colors, shadows, and radii were frequently repeated at page level: 429 hard-coded colors, 64 one-off shadows, and 187 one-off radius declarations.
- The type scale covered only a subset of headings and did not define a complete hierarchy.
- Motion, focus, reduced-motion, elevation, layout widths, and z-index intent were not formalized as reusable tokens.
- Global CSS duplicated body rules and was not imported by the application entry point.

### Navigation and layout

- Desktop and mobile navigation worked well, but appearance/accessibility controls were missing.
- Keyboard users had no skip-to-content link.
- Active, hover, and surface colors were hard-coded for light mode.
- Page header spacing and action wrapping were functional but visually compressed on larger screens.

### Components

- Shared primitives existed, but only a minority of pages used `SectionCard`, `ActionBar`, or `MobileListRow` consistently.
- Cards used several unrelated radius, border, and shadow recipes.
- Table wrappers did not consistently provide a boundary or sticky headers.
- Dialog spacing and hierarchy depended heavily on page-specific styles.
- Empty states were clear but visually undersized for large workspaces.
- Interactive cards had keyboard handling, but focus treatment was not system-wide.

### Accessibility

- No high-contrast mode or persistent appearance preference.
- Focus-visible styling was inconsistent across native and Material UI controls.
- No global reduced-motion handling.
- Several icon-only controls rely on tooltips; future page-level work should continue adding explicit `aria-label` text wherever it is absent.
- Native destructive confirmations remain understandable but should eventually migrate to an accessible shared confirmation dialog.

### Responsiveness

- The app already had meaningful mobile-specific views and bottom navigation.
- Page gutters, sticky action placement, and horizontal table affordances varied by page.
- Ultra-wide content could reach 1600px without enough breathing room around page headings.
- 339 responsive Grid items used the pre-v7 Material UI API, so their breakpoint widths were ignored after the MUI 7 upgrade. This caused content-width KPI cards and visibly unbalanced desktop rows.

## Implemented design-system decisions

- Semantic light, dark, and high-contrast palettes with persistent user preference.
- Complete responsive typography hierarchy using the existing system font stack; no external font dependency was added.
- Standard 8px spacing foundation with documented radius, elevation, motion, and layout tokens.
- Consistent WCAG-oriented focus rings and reduced-motion behavior.
- Refined global defaults for buttons, icon buttons, inputs, labels, switches, tables, tabs, alerts, dialogs, menus, tooltips, progress, skeletons, accordions, pagination, drawers, and bottom navigation.
- Sticky table headings and consistent scroll boundaries through the shared responsive wrapper.
- Improved shared page headers, section cards, statistic cards, mobile rows, empty states, and sticky action bars.
- Migrated all 339 legacy Grid items across 30 files to the supported MUI 7 responsive `size` API.
- Re-composed the admin dashboard into a compact header, coverage summary, equal KPI row, balanced quick actions, streamlined teacher-entry control, and proportional data/snapshot columns.
- Theme controls added to the authenticated shell and all login portals.
- Skip-to-content navigation added to the authenticated application.
- Compatibility styling keeps older page-level surfaces readable in dark and high-contrast modes while they continue using their existing markup.

## Product principles used

- Borders and whitespace establish most hierarchy; elevation is reserved for interactive or floating surfaces.
- Semantic tokens replace mode-specific assumptions at the shared layer.
- Dense operational tables remain compact, while page and section framing receives more whitespace.
- Motion is brief and functional, with a complete reduced-motion fallback.
- Mobile retains task-focused bottom navigation and larger touch targets.

## Optional future polish

- Replace remaining native `window.confirm` prompts with one accessible confirmation-dialog primitive.
- Gradually replace page-local hard-coded colors with semantic palette references as individual workflows are next touched.
- Add automated visual-regression snapshots for light, dark, high-contrast, tablet, and mobile layouts.
- Run a manual screen-reader pass using NVDA or VoiceOver with real production data.
- Add optional table density and saved-filter preferences for high-volume administrative users.

## Enterprise shell refinement

- Introduced a compact education brand mark and a shared two-panel authentication shell across staff, prefect, and accounts portals.
- Added persistent collapsible desktop navigation, while retaining the mobile drawer and role-specific bottom navigation.
- Added role-aware navigation search with a visible `Ctrl/Cmd + K` shortcut; results only expose pages already available to the signed-in role.
- Added page breadcrumbs, contextual top-bar titles, account actions, and an offline-state banner.
- Added shared skeleton loading, page error, and render-boundary primitives so failures remain contained and understandable.
- Extended the token system with `2xl`, control-height, shell-width, surface, and motion definitions.

The product identity is intentionally calm and institutional: academic blue communicates trust, teal signals progress, warm semantic colors communicate operational status, and neutral surfaces keep data-heavy screens readable. The interface uses a single rounded Material icon language and reserves illustration-like treatment for empty and authentication states.
