# Bedriftsgrafen Frontend Style Guide

This guide outlines the coding standards and UI/UX patterns used in the Bedriftsgrafen frontend to ensure a consistent, premium, and performant user experience.

## 🎨 Styling Standards (Tailwind CSS)

We use **Tailwind CSS v4** for styling. Adhere to these patterns to avoid common layout issues.

### 1. Flexbox Truncation Pattern
When using `truncate` or `line-clamp` inside a flex or grid container, the parent container **must** have `min-w-0` (or `min-h-0` for vertical) to allow the child to shrink and truncate properly.

**❌ Incorrect:**
```tsx
<div className="flex">
  <span className="truncate">This very long text will overflow the container</span>
</div>
```

**✅ Correct:**
```tsx
<div className="flex min-w-0">
  <span className="truncate">This text will now truncate correctly</span>
</div>
```

### 2. Text Normalization
Legacy data from Brreg often contains inconsistent whitespace and "weird" line breaks. Always use the `normalizeText` utility from `src/utils/formatters.ts` for long-form register data (e.g., "Vedtektsfestet formål").

```tsx
import { normalizeText } from '../utils/formatters'

// ...
<p>{normalizeText(company.vedtektsfestet_formaal)}</p>
```

### 3. Responsive Design
- Prefer mobile-first design (`className="w-full md:w-1/2"`).
- Use the standardized grid for card layouts: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.

---

## 🏗️ Component Architecture

### 1. Memoization
Wrap functional components in `memo()` when they are part of large lists (like `CompanyCard`) or receive complex objects as props to prevent unnecessary re-renders.

### 2. Props Naming
- Use `Boolean` flags for UI states (e.g., `isLoading`, `isOpen`, `isCompact`).
- Event handlers should follow the `on[Action]` pattern (e.g., `onSelect`, `onClick`).

### 3. Iconography
We use **Lucide React**.
- Standard icon size for UI elements: `h-4 w-4` or `h-5 w-5`.
- Always set `aria-hidden="true"` for purely decorative icons.
- Use consistent colors: `text-blue-600` for primary actions, `text-gray-400` for subtle indicators.

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
