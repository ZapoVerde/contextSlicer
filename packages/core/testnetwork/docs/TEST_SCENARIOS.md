# Prism Network Test Scenarios

## Scenario 1: The Logical Pipe Test
*   **Seed:** `packages/web/App.tsx`
*   **Settings:** 1 Hop Full / 2 Hops Summary (Logical Mode)
*   **Target:** `packages/ui-kit/components/buttons/core/Button.tsx`
*   **Expected:** 
    *   The tracer should skip the intermediate barrels in `ui-kit`.
    *   Physical Hops: 4 (App -> Barrel -> Barrel -> Barrel -> Button)
    *   Logical Hops: 1 (App -> Button)

## Scenario 2: The False Pipe (Prop Driller)
*   **Seed:** `packages/web/PropDriller.tsx`
*   **Expected:** 
    *   File should be classified as **LOGIC (Cost 1)**, not PIPE.
    *   Reason: It performs component composition/prop passing, not just re-exporting.

## Scenario 3: The Boundary Paradox
*   **Seed:** `packages/web/adapter.ts`
*   **Settings:** Exclude `packages/legacy/**`
*   **Expected:**
    *   `adapter.ts` is Full Code.
    *   `packages/legacy/oldTypes.ts` is EXCLUDED from main pack.
    *   BUT `LegacyUser` interface is extracted into the **Boundary Library**.

## Scenario 4: Path Aliases & Monorepo Resolving
*   **Seed:** `packages/web/App.tsx`
*   **Expected:** 
    *   Imports using `@prism/shared-types` should resolve identical to relative imports.