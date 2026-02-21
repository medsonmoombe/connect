# Institutional Design System v4.0 - "Sage & Slate"

## 1. Design Philosophy
"Sage & Slate" is an evolution of the institutional look that balances "Premium Stability" with "Modern Approachability." It moves away from the pure white or midnight black and into a sophisticated off-white/light-grey base with deep green accents. It uses textures and subtle gradients to provide a layered, high-quality feel.

## 2. Color Palette (Sage & Slate)

| Token | Role | Hex Value | Tailwind Class | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Primary (Deep Sage)** | Brand Core | `#166534` | `bg-green-800` | The primary brand color. Used for headings, main CTAs. |
| **Primary Light** | Success/Accent | `#22c55e` | `text-green-500` | Bright green for highlights and success states. |
| **Background Base** | Page Base | `#f8fafc` | `bg-slate-50` | A very light greyish-white for the main background. |
| **Background Muted** | Section Base | `#f1f5f9` | `bg-slate-100` | Slightly darker grey for alternating sections. |
| **Surface (Card)** | Components | `#ffffff` | `bg-white` | Pure white cards to pop against the slate-50 background. |
| **Text Primary** | Main Text | `#0f172a` | `text-slate-900` | Deep slate for high readability. |
| **Text Muted** | Secondary | `#64748b` | `text-slate-500` | Muted slate for secondary info. |
| **Border** | Dividers | `#e2e8f0` | `border-slate-200` | Light borders for clean separation. |

## 3. Typography (Modern & Consistent)
- **Unified Font:** **Inter** (via `next/font/google`) - Used everywhere (headlines, body, UI).
- **Weighting:** 
  - Headlines: `SemiBold (600)` or `Bold (700)` with slight tracking reduction.
  - Body: `Regular (400)`.
  - UI Labels: `Medium (500)`.

## 4. Visual Elements
- **Shadows:** Soft, expansive shadows. `0 10px 40px -10px rgba(0, 0, 0, 0.08)`.
- **Gradients:** Subtle "mesh" gradients for depth in heros and CTAs.
- **Textures:** Subtle "noise" or "grain" patterns to give sections a physical, high-end paper feel.
- **Border Radius:** `20px` for a modern, approachable feel.

## 5. Component Styles

### Buttons
- **Primary:** Deep Sage background, white text, subtle shadow.
- **Outline:** Transparent, slate-200 border, slate-900 text.
- **Ghost:** Minimalist, slate-500 text, slate-100 hover.

### Cards
- Background: `bg-white`
- Shadow: `shadow-xl shadow-slate-200/50`
- Border: `border border-slate-100`

## 6. Design Enforcement Checklist
- [ ] Ensure **Inter** is the only font used.
- [ ] Use `bg-slate-50` for page backgrounds, never `#FFFFFF`.
- [ ] Use `bg-white` for cards to create "lift" with soft shadows.
- [ ] All gradients should be subtle (e.g., green-800 to green-900).
