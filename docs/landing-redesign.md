# Landing Page Redesign Plan

## Inspiration Reference
- Target: babylovegrowth.ai (feature presentation style, clarity, and depth)
- Reference screenshots to capture (provide PNGs and store under `docs/screenshots/`):
  - Hero section
  - Feature overview grid
  - Deep dive feature panels
  - How-it-works flow
  - Social proof/testimonials
  - Footer navigation and legal

## Design Patterns & UI Elements to Replicate
- Modern hero with gradient typography, subtle animated background
- Feature grid with icon cards and micro-interactions (hover scale, glow pulses)
- Deep feature tabs (Automation, Planning, Governance) with concise bullets
- How-it-works five-step cards with consistent iconography
- Security & Accessibility highlights using checkmark lists
- Case studies with result badges and brief narratives
- FAQ using accessible `<details>/<summary>`
- Bottom-right help launcher and manual tour trigger for authenticated users

## Wireframes (Textual)

### Hero
- [Logo] [Nav] [CTA]
- Headline: “Operate faster with AI clarity”
- Subhead: “Turn conversations into execution”
- CTA: Get started / View tasks

### Features (Grid)
- 3 columns on desktop, stacked on mobile
- Each card: icon + title + one-sentence benefit

### Deep Feature Tabs
- Tabs: Automation | Planning | Governance
- Panel: headline, short paragraph, 4 bullets with checkmarks

### How It Works
- 5 step cards in a single row (wrap on mobile)
- Each: icon, step label, title, one-sentence description

### Security & Accessibility
- Two side-by-side panels with 4-item lists

### Case Studies
- 3 cards with org name, result badge, short detail

### FAQ
- 2-column accordion using native details/summary

## Responsiveness
-- Mobile-first layout; scale up to md/lg breakpoints
-- Grid columns: 1 → 2 → 3 as screen width increases
-- Typography clamps for readable sizes across devices

## Accessibility
- ARIA roles and labels for dialogs and progress components
- Visible focus states and keyboard navigation for tabs and accordions
- Sufficient color contrast per WCAG AA

## Performance Targets
- CSS-only animations; avoid heavy media
- Code-split routes via `React.lazy` and `Suspense` fallback
- Consider `manualChunks` for vendor splitting if bundle remains large
- Target initial load < 2s on mid-range desktop and Lighthouse ≥ 90

## Loading & Error Handling
- Landing has lightweight shimmer for small dynamic areas; minimal risk of blocking
- Global dialogs use non-blocking state; errors are surfaced via toasts

## Testing Checklist
- Chrome, Firefox, Safari, Edge: verify layout and animations
- Keyboard-only navigation across tabs, accordions, and dialogs
- Screen reader labels for help dialog and onboarding tour
- Performance snapshot (Lighthouse) against production build

## Next Actions
- Capture and add reference screenshots under `docs/screenshots/`
- Optional: instrument `activity_logs` for Landing CTA clicks and section engagement