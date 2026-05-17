---
name: Vibrant Savings System
colors:
  surface: '#fdf8f5'
  surface-dim: '#ded9d6'
  surface-bright: '#fdf8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3f0'
  surface-container: '#f2edea'
  surface-container-high: '#ece7e4'
  surface-container-highest: '#e6e2df'
  on-surface: '#1c1b1a'
  on-surface-variant: '#5a4136'
  inverse-surface: '#32302e'
  inverse-on-surface: '#f5f0ed'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#74593f'
  on-secondary: '#ffffff'
  secondary-container: '#fed9b8'
  on-secondary-container: '#795d43'
  tertiary: '#665d55'
  on-tertiary: '#ffffff'
  tertiary-container: '#a3978e'
  on-tertiary-container: '#383029'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#ffdcbe'
  secondary-fixed-dim: '#e3c0a0'
  on-secondary-fixed: '#2a1704'
  on-secondary-fixed-variant: '#5a422a'
  tertiary-fixed: '#eee0d6'
  tertiary-fixed-dim: '#d1c4ba'
  on-tertiary-fixed: '#211a14'
  on-tertiary-fixed-variant: '#4e453e'
  background: '#fdf8f5'
  on-background: '#1c1b1a'
  surface-variant: '#e6e2df'
typography:
  headline-lg:
    fontFamily: Azeret Mono
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Azeret Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Azeret Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Noto Sans Thai
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Noto Sans Thai
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Azeret Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Azeret Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.0'
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 120px
---

## Brand & Style

The design system is centered on a high-energy, optimistic personality designed to make the act of saving feel rewarding and momentum-driven. Moving away from traditional, conservative financial aesthetics, this system utilizes a **Tactile Minimalism** approach. It combines clean layouts and ample whitespace with physical-inspired depth to create a premium, "touchable" interface. 

The target audience is growth-oriented individuals who value both modern efficiency and a friendly, supportive atmosphere. The emotional response should be one of "warm security"—the energy of the orange suggests growth and action, while the soft peach tones and tactile shadows provide a sense of comfort and stability.

## Colors

This design system uses a warm, monochromatic-adjacent palette to maintain brand cohesion while ensuring a soft, premium background experience.

*   **Primary (#FF6B00):** A vibrant "Electric Orange" used for primary actions, progress indicators, and key brand moments. It represents energy and financial momentum.
*   **Secondary/Surface (#FFDAB9):** A "Soft Peach" used for secondary containers, subtle highlights, and card backgrounds to reduce visual fatigue.
*   **Tertiary/Accents (#70665E):** A "Warm Grey" with a slight brown undertone, used for secondary text and decorative elements to ground the vibrant orange.
*   **Background (#FDF8F5):** A "Cream Shell" neutral used for the global application background, providing a softer alternative to pure white.
*   **Semantic Colors:** Success states utilize a warm leaf green, while warnings utilize a deep amber to stay within the warm spectrum.

## Typography

The typography pairing creates a balance between technical precision and global accessibility. **Azeret Mono** is used for headlines, data points, and labels to evoke a sense of digital craftsmanship and financial accuracy. **Noto Sans Thai** handles all body copy and multi-line text, ensuring a smooth, legible reading experience that feels approachable and human.

Numeric data should always be rendered in Azeret Mono to emphasize the "calculative" nature of a savings app. High-level headings use tight letter spacing and heavier weights to command attention, while labels utilize uppercase styling for a disciplined, architectural feel.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous margins to reinforce the premium, "breathing" feel of the interface. 

*   **Mobile:** 4-column grid with 20px outside margins. 
*   **Desktop:** 12-column centered grid with a maximum content width of 1200px.
*   **Rhythm:** Spacing follows an 8px linear scale. Vertical rhythm is driven by the `md` (24px) unit for standard component grouping and `lg` (40px) for section separation. 

Use expansive whitespace around key financial figures to increase their perceived importance. Components should generally span the full width of their containers on mobile to maximize touch targets.

## Elevation & Depth

This design system uses **Ambient Shadows** to create a tactile, layered effect that suggests physical objects resting on a soft surface.

*   **Depth Levels:** Surfaces use three distinct levels of elevation. Low elevation for standard cards, medium for interactive elements (buttons), and high for floating overlays or modals.
*   **Shadow Quality:** Shadows are never pure black. They use a tinted "Warm Grey" (#70665E) at very low opacities (8-12%) with large blur radii (20px+) to ensure they feel soft and natural rather than sharp or "dirty."
*   **Interaction:** On hover or press, elements should visually "sink" or "lift" using subtle transitions in shadow spread and scale, reinforcing the tactile nature of the app.

## Shapes

The design system adopts a **Pill-shaped (rounded-full)** language. This maximum roundness removes visual tension and creates an exceptionally friendly, welcoming environment. 

*   **Buttons & Inputs:** Use fully rounded ends (capsule shape).
*   **Cards:** Use a `rounded-xl` (3rem/48px) setting to maintain the organic, soft feel while allowing for structured content inside.
*   **Progress Bars:** Should always feature fully rounded caps to visualize savings "flow" more naturally.

## Components

*   **Primary Buttons:** Capsule-shaped with a #FF6B00 background and white Azeret Mono text. Apply a soft, orange-tinted glow shadow to make the button feel "energized."
*   **Savings Cards:** Soft Peach (#FFDAB9) backgrounds with a subtle 1px inner border in a slightly darker peach shade. Headlines inside cards use Azeret Mono Medium.
*   **Input Fields:** Ghost-style with a thick 2px Warm Grey border or a soft peach fill. Focus states transition the border to Primary Orange with a subtle outer glow.
*   **Chips/Labels:** Small, fully rounded capsules with a Primary Orange tint (10% opacity) and Primary Orange text for categorization.
*   **Lists:** Transaction items should be separated by whitespace rather than dividers, using the Warm Grey for timestamps and metadata.
*   **Progress Rings:** Thick, vibrant orange strokes for the "filled" portion, set against a very pale peach track to visualize savings goals.