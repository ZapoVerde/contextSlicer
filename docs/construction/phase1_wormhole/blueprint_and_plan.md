# **Blueprint (Core Definition)**

### **1. Core Scope & Changes**

---

#### **File: `packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts`**
*   **Logical Change Summary:**
    *   Implement a pure function to analyze an Abstract Syntax Tree (AST) node.
    *   The logic must determine if a file serves exclusively as a "Barrel" (re-export) file.
    *   It must return `true` if the file contains *only* `ExportNamedDeclaration`, `ExportAllDeclaration`, or `ImportDeclaration` nodes, and contains **zero** variable declarations, function bodies, or other logic statements.
*   **API Delta Ledger:**
    *   **(New File)**
        *   **Symbol:** `isBarrelFile`
        *   **Signature:** `(ast: Node): boolean`

---

#### **File: `packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts`**
*   **Logical Change Summary:**
    *   Implement a pure function to analyze the flow of a specific identifier within a file's AST.
    *   The logic must accept an AST and a `targetIdentifier` string.
    *   It must implement the "Binary Interaction Heuristic":
        *   Return `isMeaningful: true` if the identifier is used in logic, rendered, renamed (aliased), or destructured.
        *   Return `isMeaningful: false` if the identifier is merely received (via props/import) and passed to a child/export unchanged (Pure Passthrough).
    *   It must return the `nextIdentifier` name to support "Scent-Sensitive Tracing" (e.g., tracking `user` to `account` if renamed).
*   **API Delta Ledger:**
    *   **(New File)**
        *   **Symbol:** `analyzeFlow`
        *   **Signature:** `(ast: Node, identifier: string): { isMeaningful: boolean, nextIdentifier: string }`

---

#### **File: `packages/core/src/logic/symbolGraph/augmentedTracer.ts`**
*   **Logical Change Summary:**
    *   Implement the core "Wormhole" Breadth-First Search (BFS) algorithm.
    *   The logic must accept a `SymbolGraph`, a starting node, and configuration options (`maxHops`, `traceMode`).
    *   It must integrate `barrelDetector`: If a file is a barrel, do not increment the hop count.
    *   It must integrate `flowAnalyzer`:
        *   If `traceMode` is "logical" and the file is a "Pipe" (not meaningful), do not increment the hop count.
        *   If the identifier is renamed, update the "scent" for the next step of the trace.
    *   It must enforce a "Physical Circuit Breaker" to prevent infinite loops even if logical hops are zero.
    *   It must return a list of files, each tagged with metadata indicating if it was "Meaningful" or "Passive".
*   **API Delta Ledger:**
    *   **(New File)**
        *   **Symbol:** `traceLogicalPath`
        *   **Signature:** `(graph: SymbolGraph, startId: string, options: TraceOptions): TracedNode[]`

---

#### **File: `packages/core/src/logic/symbolGraph/types.ts`**
*   **Logical Change Summary:**
    *   Define the data structures required for the new tracing modes.
    *   Add types for `TraceMode` ("physical" vs "logical") and `PassiveOutputMode` ("full", "docblock", "meta").
    *   Add a `TracedNode` interface to carry the "Meaningful/Passive" status of a result file.
*   **API Delta Ledger:**
    *   **(New Types)**
        *   `type TraceMode = 'physical' | 'logical'`
        *   `type PassiveOutputMode = 'full' | 'docblock' | 'meta'`
        *   `interface TraceOptions { mode: TraceMode; maxHops: number; ... }`
        *   `interface TracedNode { path: string; status: 'meaningful' | 'passive'; ... }`

---

#### **File: `packages/core/src/logic/symbolGraph/index.ts`**
*   **Logical Change Summary:**
    *   Export the new `traceLogicalPath` function and associated types to make them available to the UI layer.
*   **API Delta Ledger:**
    *   **Symbol:** `traceLogicalPath`
        *   **Before:** (Does not exist)
        *   **After:** `(graph: SymbolGraph, startId: string, options: TraceOptions) => TracedNode[]`
    *   **Symbol:** `TraceOptions`
        *   **Before:** (Does not exist)
        *   **After:** `Re-exported type`

---

#### **File: `packages/core/src/components/hooks/useQueryPanelState.tsx`**
*   **Logical Change Summary:**
    *   Add state variables for the new UI controls: `traceMode` (default: 'logical') and `passiveOutputMode` (default: 'full').
    *   Update the `handleGenerate` function to branch logic:
        *   If `traceMode` is 'logical', invoke `traceLogicalPath` instead of the legacy `traceSymbolGraph`.
        *   When constructing the final file list, filter/transform content based on `passiveOutputMode` (e.g., if 'meta', exclude content; if 'docblock', extract preamble).
*   **API Delta Ledger:**
    *   **Symbol:** `useQueryPanelState` (Return Type)
        *   **Before:** `{ ..., traceDepth: number, setTraceDepth: (v: number) => void }`
        *   **After:** `{ ..., traceDepth: number, setTraceDepth: (v: number) => void, traceMode: TraceMode, setTraceMode: (m: TraceMode) => void, passiveOutputMode: PassiveOutputMode, setPassiveOutputMode: (m: PassiveOutputMode) => void }`

---

#### **File: `packages/core/src/components/ContextQueryPanel.tsx`**
*   **Logical Change Summary:**
    *   Render the new controls in the UI.
    *   Add a Toggle/Switch for "Smart Trace (Bypass Pipes)".
    *   Add a Dropdown or Radio Group for "Passive File Output" (Full / Docblocks / Metadata Only).
    *   Connect these inputs to the new state handlers from `useQueryPanelState`.
*   **API Delta Ledger:**
    *   None. (Internal UI changes only).

---

# Blueprint (Test Assessment)

*   **`packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts`**: **Requires new Unit Test file** (Reason: Pure algorithmic logic fundamental to the feature's accuracy. Must verify detection of valid barrels vs. mixed content files).
*   **`packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts`**: **Requires new Unit Test file** (Reason: Complex heuristic logic. Must verify "Binary Interaction" scoring, aliasing detection, and passive file identification across various AST patterns).
*   **`packages/core/src/logic/symbolGraph/augmentedTracer.ts`**: **Requires new Unit Test file** (Reason: Core graph traversal engine. Must verify BFS logic, "Wormhole" hop counting, cycle detection, and integration with analyzers).
*   **`packages/core/src/logic/symbolGraph/types.ts`**: **No test file required** (Reason: Type definitions only; verified by TypeScript compiler).
*   **`packages/core/src/logic/symbolGraph/index.ts`**: **No test file required** (Reason: Barrel file for exports; covered by consumer tests).
*   **`packages/core/src/components/hooks/useQueryPanelState.tsx`**: **Requires updated Test file** (Reason: State logic modified. Must verify new `traceMode` and `passiveOutputMode` toggles and the branching logic for calling the new tracer).
*   **`packages/core/src/components/ContextQueryPanel.tsx`**: **Requires updated Test file** (Reason: UI Component changes. Must verify the rendering of new controls and their interaction with the hook).
*   **`packages/core/src/logic/symbolGraph/astUtils.ts`**: **Covered by existing tests** (Reason: Minor collateral utility updates; existing regression suite is sufficient).

---

# Blueprint (Finalized)

### 1. File Manifest (Complete Scope)

#### **Source Files**
*   `packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts` (New)
*   `packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts` (New)
*   `packages/core/src/logic/symbolGraph/augmentedTracer.ts` (New)
*   `packages/core/src/logic/symbolGraph/types.ts` (Modified)
*   `packages/core/src/logic/symbolGraph/index.ts` (Modified)
*   `packages/core/src/logic/symbolGraph/astUtils.ts` (Modified)
*   `packages/core/src/components/hooks/useQueryPanelState.tsx` (Modified)
*   `packages/core/src/components/ContextQueryPanel.tsx` (Modified)

#### **Test Files**
*   `packages/core/src/logic/symbolGraph/analyzers/barrelDetector.test.ts` (New)
*   `packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.test.ts` (New)
*   `packages/core/src/logic/symbolGraph/augmentedTracer.test.ts` (New)
*   `packages/core/src/components/hooks/useQueryPanelState.test.tsx` (Update)
*   `packages/core/src/components/ContextQueryPanel.test.tsx` (Update)

### 2. Logical Change Summary (Complete)

#### **Core Changes:**
*   **`packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts`**:
    *   Implement a pure function `isBarrelFile(ast: Node): boolean`.
    *   **Logic:** Analyze the AST. Return `true` strictly if the file contains **only** `ExportNamedDeclaration`, `ExportAllDeclaration`, or `ImportDeclaration` nodes. Any variable declaration, function declaration, or expression statement renders it `false`.

*   **`packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts`**:
    *   Implement `analyzeFlow(ast: Node, targetIdentifier: string): { isMeaningful: boolean, nextIdentifier: string }`.
    *   **Logic (Binary Heuristic):**
        *   **Passive (0 Cost):** The identifier enters via props/imports and leaves via props/exports with **zero** other references or mutations. `nextIdentifier` remains unchanged.
        *   **Meaningful (1 Cost):** The identifier is used in a logical expression, rendered in JSX, destructured, or used as a dependency in a hook.
        *   **Renaming:** If the identifier is aliased (e.g., `const { user: account } = props`), mark as **Meaningful** and update `nextIdentifier` to the new name.

*   **`packages/core/src/logic/symbolGraph/augmentedTracer.ts`**:
    *   Implement `traceLogicalPath(graph: SymbolGraph, startId: string, options: TraceOptions): TracedNode[]`.
    *   **BFS Logic:**
        *   If `options.traceMode` is 'logical':
            *   Check neighbor: Is it a Barrel? -> Cost 0.
            *   Check neighbor: Is it Passive (via `flowAnalyzer`)? -> Cost 0.
            *   Otherwise -> Cost 1.
        *   Update the "Scent" (target identifier) based on `flowAnalyzer` output.
    *   **Circuit Breaker:** Enforce a maximum *physical* depth (e.g., 50 files) to prevent infinite loops in circular "wormholes."

*   **`packages/core/src/logic/symbolGraph/types.ts`**:
    *   Define `TraceMode` ('physical' | 'logical').
    *   Define `PassiveOutputMode` ('full' | 'docblock' | 'meta').
    *   Define `TracedNode` interface `{ path: string; status: 'meaningful' | 'passive'; }`.

*   **`packages/core/src/logic/symbolGraph/index.ts`**:
    *   Export the new analyzer functions and the `augmentedTracer` to the public API.

*   **`packages/core/src/components/hooks/useQueryPanelState.tsx`**:
    *   Add state: `traceMode` (default: 'logical') and `passiveOutputMode` (default: 'full').
    *   Update `handleGenerate`:
        *   Branch to use `traceLogicalPath` when in logical mode.
        *   Post-process the results: If a file is tagged 'passive', apply the `passiveOutputMode` filter (e.g., strip content or extract docblock) before adding to the generated pack.

*   **`packages/core/src/components/ContextQueryPanel.tsx`**:
    *   Add "Smart Trace" toggle (switches `traceMode`).
    *   Add "Passive File Detail" selector (switches `passiveOutputMode`).

#### **Collateral (Fixing) Changes:**
*   **`packages/core/src/logic/symbolGraph/astUtils.ts`**:
    *   Refactor existing internal helpers (e.g., `getIdentifierName`) to be exported. This prevents code duplication in the new `barrelDetector` and `flowAnalyzer` modules.

### 3. API Delta Ledger (Complete)

*   **`packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts`** (New)
    *   `export function isBarrelFile(ast: Node): boolean`

*   **`packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts`** (New)
    *   `export function analyzeFlow(ast: Node, identifier: string): FlowResult`

*   **`packages/core/src/logic/symbolGraph/augmentedTracer.ts`** (New)
    *   `export function traceLogicalPath(graph: SymbolGraph, startId: string, options: TraceOptions): TracedNode[]`

*   **`packages/core/src/logic/symbolGraph/index.ts`**
    *   **Added:** `traceLogicalPath`
    *   **Added:** `isBarrelFile` (optional, if needed for testing/utility)
    *   **Added:** `analyzeFlow` (optional, if needed for testing/utility)

*   **`packages/core/src/logic/symbolGraph/types.ts`**
    *   **Added:** `type TraceMode = 'physical' | 'logical'`
    *   **Added:** `type PassiveOutputMode = 'full' | 'docblock' | 'meta'`
    *   **Added:** `interface TraceOptions { ... }`
    *   **Added:** `interface TracedNode { ... }`

*   **`packages/core/src/components/hooks/useQueryPanelState.tsx`**
    *   **Added to Return Object:**
        *   `traceMode: TraceMode`
        *   `setTraceMode: (mode: TraceMode) => void`
        *   `passiveOutputMode: PassiveOutputMode`
        *   `setPassiveOutputMode: (mode: PassiveOutputMode) => void`

*   **`packages/core/src/logic/symbolGraph/astUtils.ts`**
    *   **Changed:** `getIdentifierName` (Internal -> Exported)

---

# Implementation Plan (Finalized)

### Phase 1: Build Static Analysis Engines & Data Models

#### Task 1.1: `packages/core/src/logic/symbolGraph/types.ts` (Source)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
    *   *Reason:* Defines shared data structures and enums; contains no executable logic.
*   **File Definition:**
    *   **Description:** Canonical type definitions for logical tracing modes, output configurations, and metadata-rich graph nodes.
    *   **Core Principles:** Type safety, single source of truth, architectural consistency.
    *   **Test Target:** N/A

#### Task 1.2: `packages/core/src/logic/symbolGraph/astUtils.ts` (Source)
*   **Validation Tier:** Tier 2
*   **Criticality:** Not Critical
    *   *Reason:* Provides stateless utility helpers for AST traversal and identifier extraction.
*   **File Definition:**
    *   **Description:** Shared AST utility functions for safely extracting names and navigating Babel nodes across logic modules.
    *   **Core Principles:** DRY (Don't Repeat Yourself), stateless purity, defensive programming.
    *   **Test Target:** Covered by regression suite.

#### Task 1.3: `packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #2: Core Business Logic. This heuristic determines the "wormhole" status of architectural files.
*   **File Definition:**
    *   **Description:** Heuristic engine that determines if a source file is a pure re-export "barrel" or contains functional logic.
    *   **Core Principles:** Logical accuracy, high performance, strict AST inspection.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/analyzers/barrelDetector.test.ts`

#### Task 1.4: `packages/core/src/logic/symbolGraph/analyzers/barrelDetector.test.ts` (Verification)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Unit tests verifying barrel detection across various export syntaxes (named, wildcard, re-exports).
    *   **Core Principles:** Edge-case coverage, test isolation.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts`

#### Task 1.5: `packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #2: Core Business Logic. Manages the complex "Scent-Sensitive" scoring and renaming logic.
*   **File Definition:**
    *   **Description:** Analyzer responsible for determining if a tracked identifier interacts meaningfully with a file or simply passes through.
    *   **Core Principles:** Contextual awareness, identifier lifecycle tracking, aliasing resolution.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.test.ts`

#### Task 1.6: `packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.test.ts` (Verification)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Unit tests for identifier flow analysis, verifying renaming detection and meaningful vs. passive classification.
    *   **Core Principles:** Combinatorial testing, identifier scent tracking.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts`

### Phase 2: Build Logical Tracing Engine & Public API

#### Task 2.1: `packages/core/src/logic/symbolGraph/augmentedTracer.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #2: Core Business Logic. This is the primary engine for the logical bypass feature.
*   **File Definition:**
    *   **Description:** Advanced Breadth-First Search (BFS) engine that executes data-flow tracing across the graph using logical hop costs.
    *   **Core Principles:** Efficient graph traversal, resource guarding (circuit breakers), decoupled logic.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/augmentedTracer.test.ts`

#### Task 2.2: `packages/core/src/logic/symbolGraph/augmentedTracer.test.ts` (Verification)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Integration tests for the logical tracer, ensuring hop counts are correctly calculated across pipes and junctions.
    *   **Core Principles:** Scenario-based verification, graph state mocking.
    *   **Test Target:** `packages/core/src/logic/symbolGraph/augmentedTracer.ts`

#### Task 2.3: `packages/core/src/logic/symbolGraph/index.ts` (Source)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
    *   *Reason:* Simple re-export file managing the public API surface.
*   **File Definition:**
    *   **Description:** Entry point for the symbol graph package, exposing the logical tracer and configuration types to the application.
    *   **Core Principles:** Encapsulation, clean interface.
    *   **Test Target:** N/A

### Phase 3: Build UI Logic & Workflow Integration

#### Task 3.1: `packages/core/src/components/hooks/useQueryPanelState.tsx` (Source)
*   **Validation Tier:** Tier 2
*   **Criticality:** Not Critical
    *   *Reason:* Manages UI-specific transient state and workflow orchestration; secondary to core tracer logic.
*   **File Definition:**
    *   **Description:** State hook orchestrating the context query workflow, now integrating logical trace modes and content filtering.
    *   **Core Principles:** State management, workflow orchestration, robust error handling.
    *   **Test Target:** `packages/core/src/components/hooks/useQueryPanelState.test.tsx`

#### Task 3.2: `packages/core/src/components/hooks/useQueryPanelState.test.tsx` (Verification)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Hooks tests ensuring that UI toggles correctly influence trace execution and pack generation.
    *   **Core Principles:** User workflow simulation, state transition verification.
    *   **Test Target:** `packages/core/src/components/hooks/useQueryPanelState.tsx`

### Phase 4: Build Presentation Layer & User Controls

#### Task 4.1: `packages/core/src/components/ContextQueryPanel.tsx` (Source)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
    *   *Reason:* Pure React presentation component; manages user input controls.
*   **File Definition:**
    *   **Description:** The primary UI dashboard for context queries, featuring controls for Smart Tracing and Passive File output modes.
    *   **Core Principles:** Component composition, accessible UI, reactive feedback.
    *   **Test Target:** `packages/core/src/components/ContextQueryPanel.test.tsx`

#### Task 4.2: `packages/core/src/components/ContextQueryPanel.test.tsx` (Verification)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Component tests verifying the presence and functionality of the Smart Trace and Passive File switches.
    *   **Core Principles:** Behavioral testing, DOM inspection.
    *   **Test Target:** `packages/core/src/components/ContextQueryPanel.tsx`