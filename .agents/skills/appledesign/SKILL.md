---
name: appledesign
description: UI/UX design guidelines, fluid motion, and style presets for building interfaces that follow Apple's Human Interface Guidelines (HIG).
---

# Apple Design Style Guide

You are an expert UI/UX developer specializing in Apple's design language. When writing or refactoring frontend code, strictly adhere to the following principles based on the Apple Human Interface Guidelines:

## 1. The Core Philosophy
* **Clarity:** Text must be readable at any size, icons precise, and visual adornments kept to an absolute minimum. Focus purely on functionality.
* **Deference:** The interface should never compete with the content. Use subtle motion and clear layering so user content (photos, text, workspaces) stays front and center.
* **Depth:** Use visual layers and realistic motion to impart a sense of depth. Floating elements should have soft, diffuse shadows to indicate their elevation.

## 2. Typography & Layout
* **Font Family:** Use Apple's system fonts (`-apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", sans-serif`).
* **Hierarchy:** Rely on font weight and size for hierarchy rather than color. Use bold for titles and regular/medium for body text.
* **Spacing:** Use ample, consistent padding (typically multiples of 4px or 8px) to let the interface breathe. Do not crowd elements.

## 3. Materials & Color
* **Translucency:** Use `backdrop-filter: blur(20px)` with a semi-transparent background color (e.g., `rgba(255, 255, 255, 0.7)` in light mode) for sticky headers, navigation bars, and sheets.
* **No Stacking Glass:** Never stack a light translucent surface on top of another translucent surface—it destroys legibility.
* **Accent Colors:** Use a single, clear accent color (like Apple's system blue `#007AFF`) for primary interactive elements. Use system red (`#FF3B30`) strictly for destructive actions.
* **Borders:** Instead of hard, dark borders, use incredibly subtle borders (`rgba(0,0,0,0.1)`) or rely purely on shadows and spacing to separate elements.

## 4. Fluid Motion & Springs
* **Interruptible:** Animations must be interruptible. Never lock the UI while a transition is happening.
* **Spring Physics:** Avoid linear or standard easing curves for spatial transitions. Use spring animations. Default to "critically damped" (no bounce). Only add bounce if the user's gesture carried momentum (like flicking a card away).
* **Instant Feedback:** Respond to interactions on `pointer-down` (press), not just `pointer-up` (release). Highlight buttons or scale them down slightly (e.g., `transform: scale(0.98)`) the instant they are touched.

## 5. Accessibility
* Provide proper `aria-labels` for all icon-only buttons.
* Ensure all text meets contrast guidelines.
* Respect `prefers-reduced-motion` by swapping sliding/spring animations for quick opacity crossfades.
