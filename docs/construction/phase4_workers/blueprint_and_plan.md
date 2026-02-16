# Blueprint (Core Definition)

### 1. Core Scope & Changes

---

#### **File: `packages/core/src/logic/worker/types.ts`** (New File)
*   **Logical Change Summary:**
    *   Defines the shared type definitions for the Web Worker messaging protocol.
    *   Establishes the `WorkerTask` (input) and `WorkerResult` (output) interfaces to ensure strict typing across the thread boundary.
    *   Defines the `DistilledMetadata` structure (symbols, re-exports, logic activity flags) to replace full AST serialization.
*   **API Delta Ledger:**
    *   **New File:** Exports `WorkerTask`, `WorkerResult`, `TaskType`, `DistilledMetadata`.

---

#### **File: `packages/core/src/logic/worker/worker.ts`** (New File)
*   **Logical Change Summary:**
    *   Serves as the entry point for the Web Worker thread.
    *   Imports the Babel parser and core analyzers (`barrelDetector`, `flowAnalyzer`, `summaryGenerator`).
    *   Implements a stateless message listener that accepts a `WorkerTask`, executes the requested analysis logic (Parse -> Analyze -> Distill), and posts a `WorkerResult` back to the main thread.
    *   Enforces the "Zero-AST" return policy.
*   **API Delta Ledger:**
    *   **New File:** No exports (Side-effect entry point).

---

#### **File: `packages/core/src/logic/worker/WorkerPool.ts`** (New File)
*   **Logical Change Summary:**
    *   Implements the `WorkerPool` class to manage the lifecycle of the "Warm Sidecar" engine.
    *   Spawns `navigator.hardwareConcurrency - 1` workers upon initialization.
    *   Maintains a Priority Queue for tasks (User Actions > Initial Scan > Background Sync).
    *   Exposes a Promise-based `execute(task)` method to the main thread.
*   **API Delta Ledger:**
    *   **New File:** Exports `WorkerPool` class.

---

#### **File: `packages/core/src/types/fileSource.ts`**
*   **Logical Change Summary:**
    *   Updates the `FileSource` interface to support the "Push" architecture via an optional event subscription method.
    *   Allows the application to register a callback that triggers when the source detects a filesystem change.
*   **API Delta Ledger:**
    *   **Symbol:** `FileSource` (Interface)
    *   **Before:** `{ getConfig, saveConfig, getFileList, getFileContent, getFileBuffer }`
    *   **After:** `{ ..., onWatcherEvent?: (callback: (event: FileEvent) => void) => void }`

---

#### **File: `packages/core/src/state/slicer-graph-manager.ts`**
*   **Logical Change Summary:**
    *   Initializes the `WorkerPool` singleton when the graph slice is created.
    *   Refactors `ensureSymbolGraph` to perform an asynchronous, parallelized build using `WorkerPool.execute` instead of the synchronous main-thread parser.
    *   Adds a new action `patchGraphNode(path: string, content: string)` to handle differential updates triggered by the watcher.
*   **API Delta Ledger:**
    *   **Symbol:** `GraphSlice` (Interface)
    *   **Before:** `{ ..., ensureSymbolGraph: () => Promise<void> }`
    *   **After:** `{ ..., ensureSymbolGraph: () => Promise<void>, patchGraphNode: (path: string) => Promise<void> }`

---

#### **File: `packages/core/src/logic/symbolGraph/index.ts`**
*   **Logical Change Summary:**
    *   Refactors `buildSymbolGraph` to accept the `WorkerPool` instance as a dependency.
    *   Replaces the call to `runASTParser` (which used `1_buildAstCache`) with a logic flow that dispatches "Parse & Analyze" tasks to the worker pool.
    *   Aggregates the "Distilled Metadata" returned by workers to construct the `SymbolGraph` in the main thread.
*   **API Delta Ledger:**
    *   **Symbol:** `buildSymbolGraph`
    *   **Before:** `(fileIndex: Map<string, FileEntry>, aliasMap: Record<string, string>, errors: string[]) => Promise<SymbolGraph>`
    *   **After:** `(fileIndex: Map<string, FileEntry>, aliasMap: Record<string, string>, errors: string[], workerPool: WorkerPool) => Promise<SymbolGraph>`

---

#### **File: `packages/desktop/server/index.ts`**
*   **Logical Change Summary:**
    *   Integrates `chokidar` to watch the `repoRoot` defined in the config.
    *   Integrates `ws` (WebSocket) to establish a real-time notification channel with the client.
    *   Reads `liveDevelopment.watchDebounceMs` and `sanitation.denyPatterns` from the config to throttle and filter filesystem events.
    *   Broadcasts a "File Changed" event containing the relative path to connected clients.
*   **API Delta Ledger:**
    *   **Network API:** New WebSocket endpoint established on the same HTTP server instance.

---

#### **File: `packages/desktop/client/logic/adapters/apiFileSource.ts`**
*   **Logical Change Summary:**
    *   Establishes a WebSocket connection to the server upon initialization.
    *   Implements the new `onWatcherEvent` interface method.
    *   When a WebSocket message is received, it triggers the registered callback (which will eventually drive the `patchGraphNode` action in the store).
*   **API Delta Ledger:**
    *   **Symbol:** `ApiFileSource` (Class)
    *   **Delta:** Implements `onWatcherEvent`.
    ---

    # Blueprint (Test Assessment)

### **Core Logic & Infrastructure**
*   **`packages/core/src/logic/worker/WorkerPool.ts`**: **Requires new test suite (`WorkerPool.spec.ts`)**.
    *   **Reason:** **Critical**. This is the new "Core Business Logic Orchestration" engine. It manages concurrency, task queueing, and system stability. A failure here crashes the analysis engine.
    *   **Rubric:** High Fan-Out, Core Business Logic.
*   **`packages/core/src/logic/worker/types.ts`**: **No test required**.
    *   **Reason:** Pure Type Definitions.
*   **`packages/core/src/logic/worker/worker.ts`**: **No test required**.
    *   **Reason:** Implementation Detail/Entry Point. The internal logic (analyzers) is tested separately. Testing the worker wrapper requires a browser-like environment (E2E) rather than unit tests.

### **State Management**
*   **`packages/core/src/state/slicer-graph-manager.ts`**: **Requires updated test suite**.
    *   **Reason:** **Critical**. "State Store Ownership". Must verify the new async `ensureSymbolGraph` flow and the differential `patchGraphNode` logic.
*   **`packages/core/src/state/slicer-loader.ts`**: **Requires updated test suite**.
    *   **Reason:** **Critical**. "State Store Ownership". Must verify that the new `onWatcherEvent` subscription is correctly wired to the graph manager.
*   **`packages/core/src/state/slicer-state.ts`**: **No test required**.
    *   **Reason:** Pure Type Definitions.

### **Data Adapters (I/O)**
*   **`packages/desktop/client/logic/adapters/apiFileSource.ts`**: **Requires new/updated test suite**.
    *   **Reason:** **Critical**. "I/O & Concurrency Management". Must verify WebSocket connection establishment and correct event emission upon server messages.
*   **`packages/core/src/logic/adapters/zipFileSource.ts`**: **Requires updated test suite**.
    *   **Reason:** **Critical**. Must satisfy the updated `FileSource` interface (implementing the no-op or mock `onWatcherEvent`).
*   **`packages/core/src/types/fileSource.ts`**: **No test required**.
    *   **Reason:** Pure Interface Definition.

### **Graph Generation Logic**
*   **`packages/core/src/logic/symbolGraph/index.ts`**: **Requires updated test suite**.
    *   **Reason:** **Critical**. "Core Business Logic Orchestration". Must mock the `WorkerPool` dependency to verify the orchestration logic without spawning real threads.
*   **`packages/core/src/logic/symbolGraph/astParser.ts`**: **No test required (Deprecated/Refactored)**.
    *   **Reason:** This logic is being superseded by the Worker/Dispatcher flow.
*   **`packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts`**: **Requires updated test suite**.
    *   **Reason:** **Critical**. "Core Domain Model Definition". Ensures the pure AST generation logic remains correct for consumption by the worker.
*   **`packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts`**: **Requires updated test suite**.
    *   **Reason:** **Critical**. Ensures the symbol discovery logic is pure and worker-safe.

### **Infrastructure & Config**
*   **`packages/desktop/server/index.ts`**: **No unit test required**.
    *   **Reason:** "Humble Object". Wires Express/WebSocket. Best verified via manual integration testing or E2E.
*   **`packages/core/test/harness/network-harness.ts`**: **No test required**.
    *   **Reason:** Test Infrastructure.
*   **`packages/desktop/package.json`**: **No test required**.
    *   **Reason:** Configuration.

---

# Blueprint (Finalized)

### 1. File Manifest (Complete Scope)

#### **Core Infrastructure (New)**
*   `packages/core/src/logic/worker/types.ts`
*   `packages/core/src/logic/worker/worker.ts`
*   `packages/core/src/logic/worker/WorkerPool.ts`
*   `packages/core/src/logic/worker/WorkerPool.spec.ts` (New Test)

#### **State & Logic (Modified)**
*   `packages/core/src/types/fileSource.ts`
*   `packages/core/src/state/slicer-graph-manager.ts`
*   `packages/core/src/state/slicer-loader.ts`
*   `packages/core/src/logic/symbolGraph/index.ts`
*   `packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts`
*   `packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts`

#### **Data Adapters & Server (Modified)**
*   `packages/core/src/logic/adapters/zipFileSource.ts`
*   `packages/desktop/client/logic/adapters/apiFileSource.ts`
*   `packages/desktop/server/index.ts`
*   `packages/desktop/package.json`

#### **Test Infrastructure**
*   `packages/core/test/harness/network-harness.ts`

### 2. Logical Change Summary (Complete)

#### **Core Changes:**
*   **`packages/core/src/logic/worker/types.ts`**: Defines the `WorkerTask` (input) and `WorkerResult` (output) interfaces, including the `DistilledMetadata` structure to replace AST serialization.
*   **`packages/core/src/logic/worker/worker.ts`**: Implements the worker entry point. Imports core analyzers, listens for messages, executes the "Parse -> Analyze -> Distill" pipeline, and returns metadata without ASTs.
*   **`packages/core/src/logic/worker/WorkerPool.ts`**: Implements the `WorkerPool` class. Manages `hardwareConcurrency - 1` workers, maintains a priority queue (User > Scan > Bg), and exposes `execute(task)`.
*   **`packages/core/src/types/fileSource.ts`**: Updates the `FileSource` interface to include an optional `onWatcherEvent` method for subscription to push notifications.

#### **Collateral (Fixing) Changes:**
*   **`packages/core/src/state/slicer-graph-manager.ts`**:
    *   Initializes the `WorkerPool` singleton.
    *   Refactors `ensureSymbolGraph` to build the graph asynchronously using `WorkerPool.execute` for parallel parsing/analysis.
    *   Adds `patchGraphNode(path)` action to handle single-file updates triggered by the watcher, performing a surgical update on the `SymbolGraph`.
*   **`packages/core/src/state/slicer-loader.ts`**:
    *   Updates `setFileSource` to subscribe to `source.onWatcherEvent` (if available).
    *   Wires the watcher event to trigger the `graph.patchGraphNode` action.
*   **`packages/core/src/logic/symbolGraph/index.ts`**:
    *   Refactors `buildSymbolGraph` to accept `WorkerPool`.
    *   Orchestrates the build process by creating tasks for all files and aggregating the `DistilledMetadata` results from the pool.
*   **`packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts`**:
    *   Refactors logic to ensure it serves as a pure library function importable by the worker, rather than a main-thread orchestrator.
*   **`packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts`**:
    *   Refactors logic to ensure purity and worker compatibility.
*   **`packages/core/src/logic/adapters/zipFileSource.ts`**:
    *   Implements `onWatcherEvent` as a no-op (Zip sources are static).
*   **`packages/desktop/client/logic/adapters/apiFileSource.ts`**:
    *   Initializes a WebSocket connection to the local server.
    *   Implements `onWatcherEvent` to listen for "File Changed" messages from the server and invoke the subscriber callback.
*   **`packages/desktop/server/index.ts`**:
    *   Adds a WebSocket server (`ws`) attached to the HTTP server.
    *   Initializes `chokidar` to watch `config.repoRoot`.
    *   Uses `config.liveDevelopment.watchDebounceMs` to debounce events.
    *   Broadcasts changed file paths to connected clients.
*   **`packages/desktop/package.json`**:
    *   Adds `ws` and `@types/ws` dependencies.
*   **`packages/core/test/harness/network-harness.ts`**:
    *   Implements a Mock Worker Pool to satisfy the dependency of `buildSymbolGraph` during testing, allowing tests to run in the Node.js environment without browser workers.

### 3. API Delta Ledger (Complete)

#### **New Exports**
*   `packages/core/src/logic/worker/types.ts`: `WorkerTask`, `WorkerResult`, `DistilledMetadata`.
*   `packages/core/src/logic/worker/WorkerPool.ts`: `WorkerPool` class.

#### **Modified Interfaces**
*   **`FileSource` (Interface)**
    *   **Before:** `{ getConfig, saveConfig, getFileList, getFileContent, getFileBuffer }`
    *   **After:** `{ ..., onWatcherEvent?: (cb: (e: FileEvent) => void) => void }`
*   **`GraphSlice` (Interface)**
    *   **Before:** `{ ..., ensureSymbolGraph: () => Promise<void> }`
    *   **After:** `{ ..., ensureSymbolGraph: () => Promise<void>, patchGraphNode: (path: string) => Promise<void> }`

#### **Modified Functions**
*   **`buildSymbolGraph`**
    *   **Before:** `(index, aliasMap, errors) => Promise<SymbolGraph>`
    *   **After:** `(index, aliasMap, errors, workerPool) => Promise<SymbolGraph>`

#### **New Network Endpoints**
*   **WebSocket:** `ws://localhost:[PORT]/` (Desktop Server)

---

# Implementation Plan (Finalized)

### Phase 1: Establish Worker Infrastructure

#### Task 1.1: `packages/core/src/logic/worker/types.ts` (Source)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Defines the shared `WorkerTask` and `WorkerResult` interfaces and the `DistilledMetadata` structure to ensure type safety across the thread boundary.
    *   **Core Principles:** IS the single source of truth for the messaging protocol; MUST use transferrable or cloneable types only (no complex objects like ASTs).
    *   **Test Target:** N/A

#### Task 1.2: `packages/core/src/logic/worker/worker.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #2: Core Business Logic Orchestration (Orchestrates the analysis pipeline inside the thread).
*   **File Definition:**
    *   **Description:** The entry point for the Web Worker thread that imports analyzers, listens for tasks, and executes the "Parse -> Analyze -> Distill" pipeline.
    *   **Core Principles:** ENFORCES the "Zero-AST Return" policy; MUST remain stateless between messages; OWNS the error handling within the worker context.
    *   **Test Target:** N/A (Tested via E2E or Integration)

#### Task 1.3: `packages/core/src/logic/worker/WorkerPool.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #5: I/O & Concurrency Management (Manages thread lifecycle and message queues).
*   **File Definition:**
    *   **Description:** Manages the lifecycle of the worker threads, implements the priority queue for tasks, and handles the Promise-based request/response correlation.
    *   **Core Principles:** OWNS the concurrency limit strategy; ENFORCES task prioritization (User > System); MUST handle worker termination or errors gracefully.
    *   **Test Target:** `packages/core/src/logic/worker/WorkerPool.spec.ts`

#### Task 1.4: `packages/core/src/logic/worker/WorkerPool.spec.ts` (Verification)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Unit tests for the WorkerPool class verification of queuing, execution, and concurrency logic.
    *   **Core Principles:** Test Isolation; Mocking of the `Worker` native interface.
    *   **Test Target:** `packages/core/src/logic/worker/WorkerPool.ts`

### Phase 2: Refactor Analysis Logic for Thread Portability

#### Task 2.1: `packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #4: Core Domain Model Definition (Generates the AST).
*   **File Definition:**
    *   **Description:** Refactors the AST generation logic to be a pure, standalone function importable by the worker without main-thread dependencies.
    *   **Core Principles:** PURITY (Must not access DOM/Window); ISOLATION (Must not depend on State Store).
    *   **Test Target:** Existing Graph Tests.

#### Task 2.2: `packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #4: Core Domain Model Definition (Generates Symbol Nodes).
*   **File Definition:**
    *   **Description:** Refactors symbol discovery to ensure it can operate on a single AST in isolation and return metadata structures.
    *   **Core Principles:** PURITY (Stateless execution); COMPLIANCE (Must return data fitting `DistilledMetadata`).
    *   **Test Target:** Existing Graph Tests.

#### Task 2.3: `packages/core/src/logic/symbolGraph/index.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #2: Core Business Logic Orchestration.
*   **File Definition:**
    *   **Description:** Updates `buildSymbolGraph` to accept the `WorkerPool` and orchestrate the parallelized build process instead of the synchronous loop.
    *   **Core Principles:** ASYNC ORCHESTRATION; AGGREGATION (Must correctly reassemble worker results into the main Graph).
    *   **Test Target:** `packages/core/test/harness/network-harness.ts` (Integration).

### Phase 3: Establish Distributed Notification Layer

#### Task 3.1: `packages/core/src/types/fileSource.ts` (Source)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Adds the `onWatcherEvent` method signature to the `FileSource` interface.
    *   **Core Principles:** Interface Segregation.
    *   **Test Target:** N/A

#### Task 3.2: `packages/desktop/package.json` (Config)
*   **Validation Tier:** Tier 1
*   **Criticality:** Not Critical
*   **File Definition:**
    *   **Description:** Adds `ws` dependencies.
    *   **Core Principles:** Dependency Management.
    *   **Test Target:** N/A

#### Task 3.3: `packages/desktop/server/index.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #5: I/O & Concurrency (WebSocket Server & File Watching).
*   **File Definition:**
    *   **Description:** Implements the `chokidar` file watcher and the WebSocket server to broadcast change events to the client.
    *   **Core Principles:** RESOURCE EFFICIENCY (Must use config-defined debounce); SECURITY (Must filter via denyPatterns).
    *   **Test Target:** Manual / E2E.

#### Task 3.4: `packages/desktop/client/logic/adapters/apiFileSource.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #5: I/O & Concurrency (Client-side WebSocket handling).
*   **File Definition:**
    *   **Description:** Connects to the WebSocket and bridges events to the `onWatcherEvent` callback.
    *   **Core Principles:** ROBUSTNESS (Auto-reconnection logic is ideal, but basic connection required); ADAPTER PATTERN.
    *   **Test Target:** N/A

### Phase 4: Integrate Engine into State Layer

#### Task 4.1: `packages/core/src/state/slicer-graph-manager.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #1: State Store Ownership.
*   **File Definition:**
    *   **Description:** Integrates `WorkerPool`, implements async `ensureSymbolGraph`, and adds the surgical `patchGraphNode` action.
    *   **Core Principles:** STATE INTEGRITY (Graph must remain consistent during patches); PERFORMANCE (Do not block main thread).
    *   **Test Target:** Existing Store Tests.

#### Task 4.2: `packages/core/src/state/slicer-loader.ts` (Source)
*   **Validation Tier:** Tier 3
*   **Criticality:** Critical
    *   *Reason:* Matches Rubric #1: State Store Ownership.
*   **File Definition:**
    *   **Description:** Subscribes to the `FileSource` events and triggers graph patches.
    *   **Core Principles:** EVENT DRIVEN; REACTIVE.
    *   **Test Target:** Existing Store Tests.

### Phase 5: System Parity and Harness Updates

#### Task 5.1: `packages/core/src/logic/adapters/zipFileSource.ts` (Source)
*   **Validation Tier:** Tier 2
*   **Criticality:** Not Critical (Standard Logic)
*   **File Definition:**
    *   **Description:** Implements the `onWatcherEvent` no-op to satisfy the interface.
    *   **Core Principles:** COMPATIBILITY.
    *   **Test Target:** N/A

#### Task 5.2: `packages/core/test/harness/network-harness.ts` (Source)
*   **Validation Tier:** Tier 2
*   **Criticality:** Not Critical (Test Infra)
*   **File Definition:**
    *   **Description:** Implements a Mock Worker Pool to allow `buildSymbolGraph` to function in the Node.js test environment.
    *   **Core Principles:** TESTABILITY; MOCKING.
    *   **Test Target:** N/A