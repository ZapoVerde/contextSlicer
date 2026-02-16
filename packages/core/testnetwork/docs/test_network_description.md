# **Test Protocol: The Hardened Prism Network (v2.0)**

**Document-Type:** Test Specification & Architectural Validation
**Target System:** Context Slicer Dependency Engine

---

## **1. Executive Summary**
The **Hardened Prism Network (v2.0)** is a high-fidelity synthetic project designed to stress-test the core heuristics of the Context Slicer. Unlike simple test beds, this network incorporates "Architectural Friction"—real-world code patterns that typically break simple dependency tracers, such as circular references, renaming chains, and barrels with side effects.

---

## **2. Zone Map & Test Objectives**

### **Zone A: The Feature Core (`packages/web`)**
*   **The Möbius Loop (`userService.ts` ↔ `validator.ts`):** 
    *   *Purpose:* Validates BFS termination logic. 
    *   *Success:* The tracer must not infinite loop; it must de-duplicate these nodes in the final pack.
*   **The Identity Scent Chain:** 
    *   *Purpose:* Tests the `flowAnalyzer`'s ability to track an identifier as it is aliased: `user` → `account` → `profile` → `member`.
    *   *Success:* A trace for the symbol `user` must reach `ScentChainD.ts` and identify the usage of `member`.
*   **The Async Loader:**
    *   *Purpose:* Verifies that the AST parser recognizes dynamic `import()` statements as dependency edges.

### **Zone B: Transit & Pipe Zone (`packages/ui-kit`)**
*   **The Initializer Barrel (`index.ts`):**
    *   *Purpose:* **Crucial Test for the Two-Part Pipe Rule.** This file contains re-exports but also a `console.log` and a conditional check.
    *   *Success:* The system must classify this as **Logic (Cost 1)**, not a Pipe, because it contains activity.
*   **The Type Narrowing Trap (`button/index.ts`):**
    *   *Purpose:* Tests if the detector catches "Type Logic" (defining a new type based on an import) as activity.
    *   *Success:* Classified as **Logic (Cost 1)**.
*   **The Ambiguous Barrel:**
    *   *Purpose:* Tests the parser’s robustness against mixed export syntaxes (wildcard, named, default, and type-only).

### **Zone C: The Inheritance Tower (`packages/shared-types`)**
*   **The Inheritance Tower:**
    *   *Purpose:* A 5-level interface chain.
    *   *Success:* Validates the **Boundary Library (Layer 1.5)**. If a component imports `SuperAdmin`, the extractor must decide whether to pull in the entire 5-level chain or respect a depth limit.
*   **The Generic Labyrinth:**
    *   *Purpose:* Tests extraction fidelity for complex TypeScript utility types and generics.

### **Zone D: The Boundary Paradox (`packages/legacy`)**
*   **The Paradox:**
    *   *Purpose:* This package should be added to the "Exclusion Wildcards" (Step 3) in the UI. 
    *   *Success:* Even though the directory is excluded from the *pack*, if `adapter.ts` imports a type from it, the **Boundary Library** must still be able to extract that specific definition.

---

## **3. Validation Scenarios**

### **Scenario 1: The 1:2 Logical Trace**
*   **Seed:** `packages/web/App.tsx`
*   **Settings:** 1 Hop Full / 2 Hops Summary | Mode: Logical.
*   **Expected Outcome:**
    1.  `App.tsx` (Seed) = **Full**
    2.  `ScentChainA.ts` (Logic, 1 hop) = **Full**
    3.  `ScentChainB.ts` (Logic, 2 hops) = **Summary**
    4.  `ui-kit/index.ts` (Logic, 1 hop due to side effect) = **Full**
    5.  `ui-kit/components.ts` (Logic, 2 hops) = **Summary**

### **Scenario 2: The Scent Tracking**
*   **Seed:** `packages/web/App.tsx#user`
*   **Expected Outcome:** The trace should successfully navigate through the renaming logic in `ScentChainB` and `C` to include `ScentChainD` in the discovery list.

### **Scenario 3: The Boundary Scan**
*   **Seed:** `packages/web/adapter.ts`
*   **Expected Outcome:** The pack should contain `adapter.ts` as Full Code, and the **Boundary Library** section should contain the code for `interface LegacyUser` from the (otherwise excluded) legacy package.

---

## **4. Usage Instructions**

1.  **Generate the Network:**
    ```bash
    node packages/core/testnetwork/setup-network.cjs
    ```
2.  **Load the Source:** Open Context Slicer and load the `packages/core/testnetwork` directory.
3.  **Configure Exclusions:** Add `packages/legacy/**` to the **Step 3: Exclusion Patterns**.
4.  **Execute Trace:** Set Step 2 to **1 Hop Full / 2 Hops Summary** and ensure **Smart Trace** is ON.
5.  **Audit Logs:** Open the Browser Console to view the `[Tracer]` logs to verify the `Cost` and `Reason` for each file.

---
**END OF DOCUMENT**