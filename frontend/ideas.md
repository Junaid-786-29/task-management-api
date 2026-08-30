# Keystone Task Management Dashboard — Design Direction

## Three stylistic approaches

### Theme Name: Paper Ledger
Very light editorial workspace with warm paper tones, ink typography, and red annotation accents. It should feel calm, considered, and built for people who think in systems.
**Probability:** 0.03

### Theme Name: Signal Room
Dark operations console with electric cyan indicators and dense data panels. It emphasizes urgency, monitoring, and rapid triage.
**Probability:** 0.07

### Theme Name: Soft Utility
Airy SaaS workspace with pale blue surfaces, friendly rounded cards, and approachable illustrations. It prioritizes ease and low cognitive load.
**Probability:** 0.05

## Chosen approach: Paper Ledger

### Design Movement
Swiss editorial design translated into a digital workbench: asymmetrical composition, visible typographic hierarchy, precise rules, and tactile paper-like surfaces.

### Core Principles
1. **Clarity over decoration:** every accent marks a decision, status, or next action.
2. **Editorial rhythm:** oversized headings, small metadata labels, and hairline rules create hierarchy without visual noise.
3. **Warm precision:** ink navy and bone-white establish trust; coral red is reserved for action and attention.
4. **Visible structure:** the sidebar, progress bars, and list groupings make the system legible at a glance.

### Color Philosophy
Warm ivory (#F5F1E8) is the canvas: human, calm, and less sterile than pure white. Ink navy (#18212B) provides authority and contrast. Coral red (#E75B4B) is the ownable action color, used sparingly for creation, urgency, and selected states. Faded sage and sand support secondary status without turning the interface into a rainbow.

### Layout Paradigm
A persistent left rail anchors navigation while the main workspace uses an asymmetrical two-column editorial layout: a wide task stream and a narrower “at a glance” rail. Content aligns to an 8px rhythm but avoids a repetitive card grid through varied panel heights, rules, and inset sections.

### Signature Elements
- A coral “registration mark” motif: tiny crosshair details and offset bars on headers.
- Thin ink rules and small uppercase metadata labels, like a well-designed printed report.
- Paper texture and lightly offset shadows that make panels feel placed, not floated.

### Interaction Philosophy
Interactions should feel like marking up a working document: buttons press with a small physical shift, filters reveal themselves cleanly, and destructive actions require deliberate confirmation. No fake success states; API failures remain visible and actionable.

### Animation
Use 160–220ms ease-out transitions for hover, focus, drawer, and toast states. Stagger list entrances by 40ms when content loads. Avoid decorative looping motion. Respect `prefers-reduced-motion` and keep keyboard actions instant.

### Typography System
Use **DM Sans** for interface text and **Space Grotesk** for display headings. Headings are tight and slightly oversized; labels are 10–11px uppercase with tracking; body copy stays at 14–16px with relaxed line height. Never use Inter.

### Brand Essence
**Keystone is a focused task command center for small teams that need momentum without noise.** Personality: grounded, exacting, quietly confident.

### Brand Voice
Headlines are direct and observational; CTAs are verbs; microcopy is useful rather than chirpy.
- “Make room for the work that moves the week.”
- “Nothing urgent is hiding in the margins.”

### Wordmark & Logo
The mark is an abstract interlocking keystone: two offset slabs create a K-like negative space, suggesting dependencies becoming structure. The symbol is used without text in the rail and favicon; the wordmark is set in Space Grotesk with custom tracking.

### Signature Brand Color
**Keystone Coral — #E75B4B.** It owns action without shouting and looks intentional against warm paper and ink navy.

## Implementation constraints

The visual build uses the managed static frontend project for preview and delivery, while keeping the requested frontend scope only: client-side UI, centralized API contracts, and fetch-ready integration seams. No backend, database, Django, or server logic will be added or changed.
