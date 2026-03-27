# Design System Specification: High-End Glassmorphism & Editorial Depth

## 1. Overview & Creative North Star
**Creative North Star: "The Luminous Curator"**
This design system moves beyond the standard "frosted glass" trend to create a high-end editorial experience. It is defined by **Luminous Depth**—where the UI doesn't just sit on top of a background but feels chemically bonded to it. We break the "template" look through intentional white space, overlapping translucent layers, and a sophisticated typographic scale that prioritizes breathing room over information density.

The system relies on an animated mesh gradient core, which acts as the "light source" for every component. By utilizing the `24px+ backdrop-blur` and high corner radii, we create a tactile, organic feel that mimics polished physical objects rather than flat digital pixels.

---

## 2. Colors & Surface Logic
The palette is rooted in a soft, ethereal spectrum of pinks, purples, and blues, anchored by a high-contrast slate for legibility.

### Surface Hierarchy & Nesting
Instead of a flat grid, treat the UI as a series of physical layers.
*   **The Foundation:** Use `surface` (#f9f5fc) as the base, but allow the mesh gradient to show through at 100% in hero areas.
*   **The "No-Line" Rule:** Explicitly prohibit 1px solid high-contrast borders for sectioning. Boundaries must be defined by shifts from `surface-container-low` to `surface-container-highest`.
*   **The Glass & Gradient Rule:** For floating panels, use a semi-transparent `surface_container_lowest` (approx 60-70% opacity) combined with a `24px backdrop-blur`. This ensures the background colors bleed through, creating "soul" in the interface.
*   **Signature Textures:** Use a linear gradient from `primary` (#993c50) to `primary_container` (#f48498) for high-impact CTAs to provide a velvet-like depth.

---

## 3. Typography: Editorial Sophistication
We pair the rounded, approachable nature of **Quicksand** with the highly readable, structured **Nunito**.

*   **Display & Headlines (Quicksand):** Used for large-scale storytelling. The rounded terminals of Quicksand mirror the `xl` (3rem) corner radii of our panels. Use `display-lg` (3.5rem) sparingly for high-impact editorial moments.
*   **Body & Labels (Nunito/BeVietnamPro):** While the user requested Nunito, we map it to our `body` tokens to ensure optimal line height (1.5x).
*   **Hierarchy Note:** Always maintain a high contrast between `on_surface` (#2f2e33) and the background. Never use coral pink for long-form body text; reserve it exclusively for interaction cues and accents.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background to create a soft, natural lift.
*   **Ambient Shadows:** For high-priority floating elements, use a "Cloud Shadow": 
    *   *Blur:* 40px - 60px
    *   *Opacity:* 5% - 8%
    *   *Color:* A tinted version of `on_surface` (Slate).
*   **The "Ghost Border":** Per the core requirement, a 1px border is permitted only on glass cards. Use `outline_variant` at 20% opacity. This "Ghost Border" should feel like a catch-light on the edge of a glass pane, not a structural divider.
*   **Glassmorphism Specs:** Any element using the Glass effect must have a minimum `24px` backdrop-blur to prevent content underneath from interfering with text legibility.

---

## 5. Components

### Buttons
*   **Primary:** Uses the Coral Pink (`primary_fixed`) gradient. Corner radius: `1rem` (16px). Height: Min 48px for touch optimization.
*   **Secondary (Glass):** Translucent white with a 1px `outline_variant` (20% opacity) border. 
*   **States:** On press, the element should "sink" (scale 0.98) rather than just change color.

### Cards & Panels
*   **Main Panels:** Use `xl` (3rem) or `lg` (2rem) corner radii. 
*   **Content Separation:** Forbid divider lines. Use `spacing-6` (2rem) of vertical white space or a shift in surface container tier to separate content blocks.

### Input Fields
*   **Styling:** Minimalist glass containers. Labels use `label-md` in `on_surface_variant`.
*   **Error State:** Use `error` (#b31b25) for the border and helper text, but keep the background blur active to maintain the glass aesthetic.

### Chips & Tags
*   **Interactive:** Use `secondary_container` with `on_secondary_container` text.
*   **Static:** Subtle glass pills with `sm` (0.5rem) padding.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** embrace asymmetry. Allow glass cards to overlap or bleed off the edge of the screen to create a sense of scale.
*   **Do** use `24px` spacing as your "standard" gutter to maintain the airy, premium feel.
*   **Do** ensure text on glass cards passes WCAG AA contrast ratios by adjusting the card opacity.

### Don't:
*   **Don't** use pure black (#000000) for text or shadows; it kills the "luminous" effect. Use the Slate `on_surface` token.
*   **Don't** stack more than three layers of glass; the blur effect will become muddy and performance will degrade.
*   **Don't** use 100% opaque borders for dividers or boxes. This breaks the editorial flow.
*   **Don't** shrink touch targets below 44px, even for "tertiary" links.

---

## 7. Spacing & Touch
*   **Standard Gutter:** `6` (2rem) for external margins.
*   **Internal Padding:** `4` (1.4rem) for card interiors.
*   **Touch Targets:** All interactive elements (buttons, chips, icons) must adhere to a minimum `12` (4rem / 44px+) height or width.