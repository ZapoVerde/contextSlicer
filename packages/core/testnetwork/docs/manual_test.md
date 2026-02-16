This verification table is designed to stress-test the **Hardened Prism Network v2.1**. It specifically targets the "Smart Trace" (Two-Part Pipe Rule) and the "Resolution Gradient" (Full vs. Summary) to ensure they reconcile correctly in the UI.

### **Legend**
*   **F** = Full Code (`[SEED - Full Implementation]`)
*   **S** = Summary Brief (`[SUMMARY - Dependency Brief]`)
*   **P** = Passive/Meta (`// Filepath (Passive)`)

---

### **Manual Verification Table: Context Discovery Engine**

| ID | Selection (Seed) | Config (F:S \| Smart) | Expected Files in Pack | Critical Logic Verification |
|:---|:---|:---|:---|:---|
| **1.1** | `packages/web/App.tsx` | **0 : 0** | `App.tsx` (F) | **Isolation:** Only the seed is extracted. |
| **1.2** | `packages/web/App.tsx` | **0 : 1** (Smart: ON) | `App.tsx` (F) <br> `userService.ts` (S) <br> `ComplexBarrel.ts` (S/P) | **Immediate Summary:** Neighbors are found but distilled into briefs. |
| **1.3** | `packages/web/App.tsx` | **1 : 1** (Smart: ON) | `App.tsx` (F) <br> `userService.ts` (F) <br> `ScentChainA.ts` (F) | **Logical Adjacency:** Direct logic neighbors receive full implementation. |
| **1.4** | `packages/web/App.tsx` | **1 : 2** (Smart: ON) | `App.tsx` (F) <br> `userService.ts` (F) <br> `validator.ts` (S) <br> `Button.tsx` (S) | **The Wormhole:** `Button.tsx` is included as a Summary even though it is 5 physical hops away (it is only 1 logical hop). |
| **1.5** | `packages/web/App.tsx` | **1 : 3** (Smart: ON) | `App.tsx` (F) <br> `ScentChainA` (F) <br> `ScentChainB` (S) <br> `ScentChainC` (S) | **Scent Tracking:** Transformation files like `ChainB` are correctly identified as Logic (Cost 1). |
| **2.1** | `packages/web/*.ts` | **0 : 0** | `userService.ts` (F) <br> `validator.ts` (F) <br> `ScentChainA-D.ts` (F) | **Colocated Wildcard:** All matching files in directory receive Full resolution. |
| **2.2** | `packages/web/*.ts` <br> (Excl: `**/*.spec.ts`) | **0 : 1** (Smart: ON) | `userService.ts` (F) <br> `validator.ts` (S) <br> ... | **Trace-Through:** `validator.ts` is found via `userService.spec.ts` even though the spec file is excluded from the pack. |
| **3.1** | `packages/web/App.tsx`, <br> `packages/shared-types/config.ts` | **1 : 2** (Smart: ON) | `App.tsx` (F) <br> `config.ts` (F) | **Separated Multi-Seed:** Both seeds are prioritized as Full implementation. |
| **3.2** | `packages/web/App.tsx`, <br> `packages/shared-types/config.ts` | **1 : 2** (Smart: ON) | `inheritance.ts` (S) | **Conflict Reconciliation:** `config.ts` is found via Trace (Summary) but was manually selected (Full). **Full must win.** |
| **4.1** | `packages/web/App.tsx` | **0 : 1** (Smart: OFF) | `App.tsx` (F) <br> `ComplexBarrel.ts` (S) | **Physical Mode:** Tracer stops at the first barrel. `Button.tsx` is NOT found because it's too many physical hops away. |
| **4.2** | `packages/web/FalsePipe.tsx` | **0 : 1** (Smart: ON) | `FalsePipe.tsx` (F) <br> `Dashboard.tsx` (S) | **Hook Detection:** `FalsePipe` is treated as Logic (Cost 1) because it contains a `useEffect`. |
| **4.3** | `packages/web/PropDriller.tsx` | **0 : 1** (Smart: ON) | `PropDriller.tsx` (F) <br> `Dashboard.tsx` (S) | **React Composition:** `PropDriller` is treated as Logic (Cost 1) because it renders JSX, even though it just passes props. |

---

### **How to verify these results in the Targeted Pack Generator:**

1.  **Check Headers:**
    *   Full implementation files must have `[SEED - Full Implementation]`.
    *   Summarized files must have `[SUMMARY - Dependency Brief]`.
2.  **Check Layer 1.5:**
    *   Verify the `BOUNDARY LIBRARY` exists at the top. 
    *   Check for `interface SuperAdmin` if you only selected `App.tsx` at low depth.
3.  **Verify Hops in Console:**
    *   Open Browser DevTools.
    *   The `[Tracer]` log group will show the **Logical Depth** vs **Physical Depth** for every added file.
4.  **Verify Passive Rendering:**
    *   Switch "Passive File Detail" to **Meta**. 
    *   Verify `ComplexBarrel.ts` and `core/index.ts` appear only as single-line comments: `// path/to/file (Passive)`.