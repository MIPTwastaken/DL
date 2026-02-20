# CLAUDE.md

## Project Overview

**Deadlift Biomechanics Simulator** — a 2D sagittal-plane quasi-static biomechanics analysis tool for the deadlift exercise. It simulates different body morphologies and lifting styles (conventional and sumo) to analyze joint torques, range of motion, and biomechanical demands. Entirely client-side with no backend.

## Tech Stack

- **Language:** JavaScript (ES2020+), JSX
- **UI Framework:** React 19 (functional components with hooks only)
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 4 (utility classes, dark theme)
- **Rendering:** HTML5 Canvas API for 2D visualization
- **Linter:** ESLint 9 (flat config)
- **Module System:** ES modules (`"type": "module"` in package.json)

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run ESLint on all `.js`/`.jsx` files |
| `npm run preview` | Preview production build locally |

There is no test suite configured.

## Repository Structure

```
src/
├── main.jsx            # React entry point (StrictMode, root render)
├── App.jsx             # Main app component: state, presets, sliders, layout
├── solver.js           # Pure math: pose solver, torque computation, ROM estimation
├── CanvasRenderer.jsx  # Canvas-based 2D visualization of the body model
└── index.css           # Tailwind import + dark theme base styles
public/
└── vite.svg
index.html              # HTML shell, title, mount point
package.json            # Dependencies & scripts
vite.config.js          # Vite + React + Tailwind plugins
eslint.config.js        # ESLint flat config
```

## Architecture

### Data Flow

1. **App.jsx** manages all UI state (body params, lifting mode, presets)
2. **solver.js** `solve(params)` computes the body pose via two-pass grid search optimization
3. **solver.js** `computeTorques(pose, params)` calculates hip, knee, and lumbar joint demands
4. **solver.js** `computeROM(params)` estimates range of motion
5. **CanvasRenderer.jsx** renders the solved pose, moment arms, and annotations onto a canvas
6. All derived data is memoized with `useMemo`; event handlers use `useCallback`

### Key Modules

**`solver.js`** (~405 lines) — Pure functions, no React dependencies:
- `solve(params)`: Two-pass optimization (coarse 1° then refined 0.2° step) over tibia and knee angles. Enforces geometric constraints and applies soft penalties for balance, hip angle, and torso angle. Returns a `pose` object with joint positions and angles.
- `computeTorques(pose, params)`: Calculates joint torques (force x moment arm) at hip, knee, and L5 lumbar. Models barbell weight per side plus torso mass (45% of body mass).
- `computeROM(params)`: Bar start height 22.5 cm, lockout = hip standing - 3 cm.
- Helper functions: `u()`, `rotate2d()`, `dist()`, `normalize()`, `angleBetweenVectors()`.

**`App.jsx`** (~345 lines) — Main component:
- 5 presets: default, ideal puller, Lamar Gant, average, T-Rex
- 8 adjustable sliders: femur, tibia, torso, arm length, load, body mass, stance width, bar clearance
- Comparison mode: metrics vs "ideal puller" reference
- Inline sub-components: `MetricRow`, `CompareRow`

**`CanvasRenderer.jsx`** (~283 lines) — Canvas rendering:
- ResizeObserver for responsive sizing
- Device pixel ratio scaling for crisp rendering
- World-to-screen coordinate transform with auto-fit
- Draws: grid (10 cm), floor, body segments (color-coded), joints, barbell with plates, angle annotations, moment arms, balance warnings

## Code Conventions

### Naming
- **PascalCase** for React components (`App`, `CanvasRenderer`)
- **camelCase** for functions and variables (`computeTorques`, `stanceWidth`)
- **UPPER_CASE** for constants and config objects (`COLORS`, `PRESETS`, `SLIDERS`)

### React Patterns
- Functional components with hooks exclusively (no class components)
- `useMemo` for all expensive derived computations (solver, torques, ROM)
- `useCallback` for event handlers passed to children
- `useRef` for DOM/canvas references
- Local `useState` only — no external state management (no Redux, Context, or Zustand)
- Props drilling for passing pose/torque data to CanvasRenderer

### Units & Math
- All internal computations use **SI units**: meters, radians
- Conversion at UI boundaries: cm ↔ m, degrees ↔ radians
- Angles measured from vertical, clockwise positive
- Quasi-static analysis (no acceleration or dynamic forces)

### Styling
- Tailwind CSS utility classes throughout
- Dark theme: `bg-gray-800`, `bg-gray-900`, `text-gray-300` palette
- Responsive layout with `lg:` breakpoint (mobile-first)
- Semantic color-coding: green = good, red = warning

### ESLint Rules
- Extends `@eslint/js` recommended, `react-hooks`, `react-refresh`
- Unused variables allowed if name starts with uppercase or `_` (component convention)
- Target: ES2020 with browser globals

## Development Guidelines

- **Read before modifying.** Always read the relevant source files before making changes.
- **Keep solver pure.** `solver.js` contains no React or DOM code — keep it that way. All functions are pure and testable.
- **Memoize derived state.** Any computation derived from params should go through `useMemo` to avoid unnecessary recalculations on re-render.
- **Canvas coordinate system.** The canvas uses a custom world-to-screen transform. All body positions are in world coordinates (meters); rendering code converts to screen pixels.
- **Sumo mode.** Sumo deadlift uses an effective femur length calculated via abduction angle projection. It is a simplified 2D projection of the 3D stance geometry.
- **No TypeScript.** The project uses plain JavaScript with JSX. Type information is conveyed through naming and structure.
- **No tests yet.** There is no test framework. If adding tests, Vitest is the natural choice given the Vite toolchain.
