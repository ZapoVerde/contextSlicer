# Blueprint (Core Definition)

### 1. Core Scope & Changes

---

#### **File: `packages/core/src/logic/symbolGraph/types.ts`**
*   **Logical Change Summary:**
    *   Extend `TraceOptions` to include `summaryHops` (the outer boundary for context).
    *   Extend `TracedNode` to include a `resolution` property ('full' | 'summary') to indicate how the file should be rendered in the final pack.
*   **API Delta Ledger:**
    *   **Interface:** `TraceOptions`
        *   **Before:** `{ mode: TraceMode; direction: TraceDirection; maxHops: number; initialScent?: string; }`
        *   **After:** `{ mode: TraceMode; direction: TraceDirection; maxHops: number; summaryHops: number; initialScent?: string; }`
    *   **Interface:** `TracedNode`
        *   **Before:** `{ path: string; status: 'meaningful' | 'passive'; scent: string; depth: number; }`
        *   **After:** `{ path: string; status: 'meaningful' | 'passive'; resolution: 'full' | 'summary'; scent: string; depth: number; }`

---

#### **File: `packages/core/src/logic/symbolGraph/summaryGenerator.ts` (NEW)**
*   **Logical Change Summary:**
    *   Implement the `generateSummary` function.
    *   Logic: Analyze a file's AST and SymbolGraph node to categorize it into one of four patterns: Transform, Consume, Generate, or Passthrough.
    *   Output: A formatted string containing the pattern tag (`[TRANSFORM]`, etc.), Input symbols (Internal imports), Output symbols (Exports), and Local Types.
*   **API Delta Ledger:**
    *   **New Export:** `export function generateSummary(filePath: string, ast: any, graph: SymbolGraph): string`

---

#### **File: `packages/core/src/logic/symbolGraph/augmentedTracer.ts`**
*   **Logical Change Summary:**
    *   Update `traceLogicalPath` to accept the new `summaryHops` option.
    *   Logic Update: Continue traversal beyond `maxHops` (Full Text limit) up to `summaryHops`.
    *   Resolution Logic:
        *   If Node is "Passthrough/Wormhole" -> Mark `resolution: 'summary'` (Autosummarize rule).
        *   If Depth <= `maxHops` -> Mark `resolution: 'full'`.
        *   If Depth > `maxHops` AND <= `summaryHops` -> Mark `resolution: 'summary'`.
*   **API Delta Ledger:**
    *   **Function:** `traceLogicalPath`
        *   Signature changed via updated `TraceOptions` type.

---

#### **File: `packages/core/src/components/hooks/useQueryPanelState.tsx`**
*   **Logical Change Summary:**
    *   Add state management for `summaryTraceDepth` (the outer ticker).
    *   Update `handleGenerate` to pass the `summaryTraceDepth` to the tracer.
    *   Update logic to append the resolution status to the file paths (e.g., using a suffix convention like `path/to/file.ts:summary`) when committing to the global input state.
*   **API Delta Ledger:**
    *   **Hook Return:** Added `summaryTraceDepth` (number) and `setSummaryTraceDepth` (setter).

---

#### **File: `packages/core/src/components/ContextQueryPanel.tsx`**
*   **Logical Change Summary:**
    *   UI Update: Add a second slider or dual-handle slider to control `summaryTraceDepth`.
    *   Visuals: Indicate "Full Text Zone" vs "Summary Zone".
*   **API Delta Ledger:**
    *   None.

---

#### **File: `packages/core/src/components/hooks/useTargetedPackManager.ts`**
*   **Logical Change Summary:**
    *   Update `getFormattedTextContent` to parse the file list for resolution flags (e.g., check for `:summary` suffix).
    *   Logic: If a file is marked for summary, use `generateSummary` (requires fetching AST on demand or from cache) instead of raw text content.
    *   Fallback: If parsing fails or AST is unavailable, fallback to full text with a warning.
*   **API Delta Ledger:**
    *   None.

    ---

    # Blueprint (Test Assessment)

*   **`packages/core/src/logic/symbolGraph/types.ts`**: **No test file required** (Reason: Pure type definitions; no runtime logic to verify).
*   **`packages/core/src/logic/symbolGraph/summaryGenerator.ts`**: **Requires NEW test file** (`packages/core/src/logic/symbolGraph/summaryGenerator.spec.ts`) (Reason: Introduces complex new heuristics for identifying architectural patterns (Transform/Consume/Generate) which requires rigorous unit testing).
*   **`packages/core/src/logic/symbolGraph/augmentedTracer.ts`**: **Requires UPDATED test file** (`packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts`) (Reason: Core traversal logic is changing to support "dual-hop" resolution; existing tests must be expanded to verify "full" vs "summary" classification).
*   **`packages/core/src/components/hooks/useQueryPanelState.tsx`**: **Manual Verification** (Reason: Orchestrates UI state; core logic is delegated to the tester-covered `augmentedTracer`).
*   **`packages/core/src/components/ContextQueryPanel.tsx`**: **Manual Verification** (Reason: Presentational component; verify via UI interaction).
*   **`packages/core/src/components/hooks/useTargetedPackManager.ts`**: **Manual Verification** (Reason: Integration logic for final output generation; relies on `summaryGenerator` which is unit tested).
*   **`packages/core/src/logic/symbolGraph/index.ts`**: **No test file required** (Reason: Barrel file; re-exports only).
*   **`packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts`**: **Update Required** (Reason: Must accommodate new `summaryHops` parameter and verify resolution flags).
*   **`packages/core/src/logic/symbolGraph/summaryGenerator.spec.ts`**: **Create Required** (Reason: New test suite for the new logic module).

---

# Blueprint (Finalized)

### 1. File Manifest (Complete Scope)
*   `packages/core/src/logic/symbolGraph/types.ts`
*   `packages/core/src/logic/symbolGraph/summaryGenerator.ts` (NEW)
*   `packages/core/src/logic/symbolGraph/augmentedTracer.ts`
*   `packages/core/src/logic/symbolGraph/index.ts`
*   `packages/core/src/components/hooks/useQueryPanelState.tsx`
*   `packages/core/src/components/ContextQueryPanel.tsx`
*   `packages/core/src/components/hooks/useTargetedPackManager.ts`
*   `packages/core/src/logic/symbolGraph/summaryGenerator.spec.ts` (NEW TEST)
*   `packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts` (TEST UPDATE)

### 2. Logical Change Summary (Complete)

#### **Core Changes:**
*   **`packages/core/src/logic/symbolGraph/types.ts`**:
    *   Extend `TraceOptions` to include `summaryHops` (outer boundary).
    *   Extend `TracedNode` to include `resolution` ('full' | 'summary').
*   **`packages/core/src/logic/symbolGraph/summaryGenerator.ts` (NEW)**:
    *   Implement `generateSummary(filePath, ast, graph)`.
    *   Logic: Analyze AST to categorize file into [TRANSFORM], [CONSUME], [GENERATE], or [PASSTHROUGH].
    *   Output: Formatted string with Inputs, Outputs, and Local Types.
*   **`packages/core/src/logic/symbolGraph/augmentedTracer.ts`**:
    *   Update `traceLogicalPath` to handle `summaryHops`.
    *   Logic:
        *   Depth <= `maxHops` -> `resolution: 'full'`.
        *   Depth > `maxHops` AND <= `summaryHops` -> `resolution: 'summary'`.
        *   **Autosummarize Rule:** If `isBarrelFile` or `isPassthrough` (via `analyzeFlow`), force `resolution: 'summary'` even if within `maxHops`.
*   **`packages/core/src/components/hooks/useQueryPanelState.tsx`**:
    *   Add state for `summaryTraceDepth` (outer ticker).
    *   Pass `summaryHops` to the tracer in `handleGenerate`.
    *   Append resolution flags (e.g., `:summary`) to file paths in the global input string to persist the user's intent.
*   **`packages/core/src/components/ContextQueryPanel.tsx`**:
    *   Add a dual-handle slider (or second slider) for "Summary Depth".
    *   Visualize the "Full Text" vs "Summary" zones.
*   **`packages/core/src/components/hooks/useTargetedPackManager.ts`**:
    *   Parse file paths for resolution flags (`:summary`).
    *   If summary flag is present, invoke `generateSummary` (fetching AST on demand) instead of reading raw file text.

#### **Collateral (Fixing) Changes:**
*   **`packages/core/src/logic/symbolGraph/index.ts`**:
    *   Export `generateSummary` to make it available to the UI hooks.
*   **`packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts`**:
    *   Update test cases to provide `summaryHops` in options.
    *   Add assertions to verify that nodes at distinct depths receive the correct `resolution` ('full' vs 'summary').
    *   Verify the "Autosummarize" rule for barrel files within the full-text depth.
*   **`packages/core/src/logic/symbolGraph/summaryGenerator.spec.ts`**:
    *   Create unit tests with mock ASTs to verify correct classification of the 4 patterns (Transform, Consume, Generate, Passthrough).

### 3. API Delta Ledger (Complete)
*   **`types.ts`**: `TraceOptions` adds `summaryHops: number`. `TracedNode` adds `resolution: 'full' | 'summary'`.
*   **`summaryGenerator.ts`**: New export `generateSummary`.
*   **`augmentedTracer.ts`**: `traceLogicalPath` signature changed via `TraceOptions`.
*   **`useQueryPanelState.tsx`**: Hook returns new `summaryTraceDepth` state and setter.
*   **`index.ts`**: Re-exports `generateSummary`.

---

# Implementation Plan (Finalized)

### Phase 1: Core Domain & Logical Engine

#### Task 1.1: `packages/core/src/logic/symbolGraph/types.ts` (Source)
*   **Validation Tier:** Tier 3: Critical
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #3 & #4: High Fan-Out and Core Domain Model. It defines the structural contract for the entire context resolution subsystem.
*   **File Definition:**
    *   **Description:** Defines canonical interfaces and types for dual-resolution logical tracing.
    *   **Core Principles:** Platform Agnosticism, Contract-First Design.
    *   **Test Target:** N/A

#### Task 1.2: `packages/core/src/logic/symbolGraph/summaryGenerator.ts` (Source)
*   **Validation Tier:** Tier 3: Critical
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #2: Core Business Logic. Contains the primary heuristic engine for architectural pattern classification.
*   **File Definition:**
    *   **Description:** Transforms Abstract Syntax Trees into semantic architectural summaries based on flow patterns.
    *   **Core Principles:** Purity (Stateless), Single Responsibility.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/summaryGenerator.spec.ts`

#### Task 1.3: `packages/core/src/logic/symbolGraph/summaryGenerator.spec.ts` (Verification)
*   **Validation Tier:** Tier 1: Basic
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Unit tests to verify the accuracy of the Transform, Consume, Generate, and Passthrough patterns.
    *   **Core Principles:** Behavior-Driven Testing, Boundary Testing.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/summaryGenerator.ts`

---

### Phase 2: Graph Traversal & Resolution Logic

#### Task 2.1: `packages/core/src/logic/symbolGraph/augmentedTracer.ts` (Source)
*   **Validation Tier:** Tier 3: Critical
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #2: Core Business Logic. Implements the complex multi-threshold BFS traversal logic.
*   **File Definition:**
    *   **Description:** Performs logical graph traversal, applying the resolution gradient (Full vs Summary) and the autosummarize policy.
    *   **Core Principles:** Resource Efficiency (Circuit-breaking), Logic-Aware Traversal.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts`

#### Task 2.2: `packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts` (Verification)
*   **Validation Tier:** Tier 1: Basic
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Integration tests verifying that the tracer correctly tags nodes with 'full' or 'summary' status across logical depths.
    *   **Core Principles:** Deterministic Test States, Comprehensive Path Coverage.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/augmentedTracer.ts`

#### Task 2.3: `packages/core/src/logic/symbolGraph/index.ts` (Source)
*   **Validation Tier:** Tier 1: Basic
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Barrel file exposing the summary generation and tracing logic to the rest of the core package.
    *   **Core Principles:** Encapsulation, Interface Minimalism.
    *   **Test Target:** N/A

---

### Phase 3: UI Orchestration & Ticker State

#### Task 3.1: `packages/core/src/components/hooks/useQueryPanelState.tsx` (Source)
*   **Validation Tier:** Tier 2: Standard
*   **Criticality:** Not Critical
    *   *Reasoning:* Manages feature-specific UI state and orchestration of tracer calls.
*   **File Definition:**
    *   **Description:** Manages the dual-ticker state and coordinates the dependency trace workflow.
    *   **Core Principles:** Hook-based State Encapsulation, Separation of Concerns.
    *   **Test Target:** N/A (Manual Verification)

#### Task 3.2: `packages/core/src/components/ContextQueryPanel.tsx` (Source)
*   **Validation Tier:** Tier 1: Basic
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** React component providing the dual-slider interface for defining the context resolution gradient.
    *   **Core Principles:** Declarative UI, Direct Manipulation.
    *   **Test Target:** N/A (Manual Verification)

---

### Phase 4: Pack Generation & Output Formatting

#### Task 4.1: `packages/core/src/components/hooks/useTargetedPackManager.ts` (Source)
*   **Validation Tier:** Tier 3: Critical
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #5: I/O & Concurrency. Orchestrates the high-volume parallel assembly of the final context pack.
*   **File Definition:**
    *   **Description:** Orchestrates the fetching of file contents and triggers summary generation for peripheral files.
    *   **Core Principles:** Asynchronous Parallelism, I/O Optimization.
    *   **Test Target:** N/A (Manual Verification)