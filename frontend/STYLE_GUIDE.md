# Bedriftsgrafen Frontend Style Guide

This guide outlines the coding standards and UI/UX patterns used in the Bedriftsgrafen frontend to ensure a consistent, premium, and performant user experience.

## 🎨 Styling Standards (Tailwind CSS)

We use **Tailwind CSS v4** for styling. Adhere to these patterns to avoid common layout issues.

### 1. Flexbox Truncation & Grid Stability
When using `truncate` or `line-clamp` inside a flex or grid container, the parent container **must** have `min-w-0` (or `min-h-0` for vertical) to allow the child to shrink and truncate properly. This is critical in side-by-side comparison views.

**❌ Incorrect:**
```tsx
<div className="grid grid-cols-2">
  <div className="group">
    <span className="truncate">Very long industry name...</span>
  </div>
</div>
```

**✅ Correct:**
```tsx
<div className="grid grid-cols-2 min-w-0">
  <div className="group min-w-0">
    <span className="truncate">This text will now truncate correctly</span>
  </div>
</div>
```

### 2. Line Clamp vs Truncation
- Use `truncate` for single-line text (e.g., Company Names in bars).
- Use `line-clamp-2` for slightly longer text (e.g., NACE Industry descriptions) to provide more context while maintaining layout height stability.
- Ensure `leading-snug` or `leading-relaxed` is used with `line-clamp` for better readability.

### 3. Clean UI Pattern (Hide vs Gray-out)
Adopt a "Clean UI" approach for optional or empty data.
- **DO NOT** show "Ikke registrert" or grayed-out "false" states for non-essential info (e.g., MVA-register, Antall ansatte if null).
- **DO** hide the entire row or section if the information is missing or the flag is false.
- **EXCEPTION**: Key legal dates (like Stiftelsesdato) should remain visible but marked as missing if they are critical to the company's identity.

---

## 🏗️ Component Architecture

### 1. Memoization
Wrap functional components in `memo()` when they are part of large lists (like `CompanyCard`) or receive complex objects as props to prevent unnecessary re-renders.

### 2. Strict Typing for Icons
When a component accepts an icon as a prop, use `React.ComponentType<LucideProps>` to allow for wrapped components (e.g., icons with `aria-hidden` applied).

```tsx
import { LucideProps } from 'lucide-react'

interface Props {
  icon: React.ComponentType<LucideProps>
}
```

### 3. Iconography
We use **Lucide React**.
- Standard icon size for UI elements: `h-4 w-4` or `h-5 w-5`.
- **CRITICAL**: Always set `aria-hidden="true"` for purely decorative icons.
- For Battle Mode/Comparison winners, use the `Crown` icon with `amber-500` and `fill-amber-500`.

---

## ⚔️ Battle Mode & Comparisons

### 1. Relative Metrics
- Use `Math.abs` for calculating relative bar widths to handle negative results gracefully.
- Metric bars should have a subtle background (`bg-slate-100`) and use primary colors (`bg-blue-500`, `bg-emerald-500`) for the "winner".

### 2. Visual Consistency
- Align labels and icons to the top (`items-start`) when text might wrap to multiple lines.
- VS badges should be centered between columns and visible only when appropriate breakpoints are met.

---

## 📊 Performance & Data

### 1. TanStack Query
- Always use the custom hooks in `src/hooks/queries/` instead of calling `useQuery` directly in components.
- Keep query keys centralized in `src/lib/queryKeys.ts`.

### 2. Skeleton States
Provide high-quality skeleton loaders for all data-driven components using the components in `src/components/skeletons/`.

---

## 🧪 Quality Assurance
- **TypeScript**: No `any`, no `!`, no `as`. Define interfaces for all props.
- **Validation**: Run `npm run validate` before every push.
- **Testing**: New utility functions MUST have unit tests in a `__tests__` directory.
