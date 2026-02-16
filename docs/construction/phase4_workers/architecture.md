# **Architectural Report**

### **1. High-Level Goal & Rationale**
The objective is to re-architect the application's core analysis engine from a synchronous, main-thread process into a distributed, multi-threaded "Logic Engine" using a persistent Web Worker pool. This transition aims to eliminate UI blocking on large repositories and leverages the client browser's superior processing power ("Smart Browser") to handle heavy computation, decoupling performance from potentially resource-constrained cloud servers ("Dumb Server").

### **1.1 Detailed Description**
The system will implement a **Distributed Analysis Architecture**. In the Desktop environment, the local server acts strictly as a "Dumb Watcher," monitoring the filesystem and serving raw file content based on timings defined in the configuration file. The Client Browser acts as the "Orchestrator," managing a persistent pool of generic, stateless Web Workers.

These workers serve as a "Warm Sidecar" engine. They are pre-loaded with the necessary parsing and analysis logic but maintain no project state between tasks. The Main Thread dispatches raw file content to the pool, and the workers return "Distilled Metadata" (symbol lists, re-export signatures, and architectural summaries). This ensures that complex Abstract Syntax Trees (ASTs) never cross the thread boundary, eliminating serialization overhead. The Main Thread then performs "Differential Patching" to update the dependency graph surgically, processing only files that have changed rather than rebuilding the entire graph.

### **2. Core Principles & Constraints**

**Governing Principles (From Project Docs):**
*   **Separation of Concerns:** UI rendering must be decoupled from heavy computational logic.
*   **Single Source of Truth:** The `slicer-config.yaml` file dictates all exclusion rules and timing behaviors.
*   **Platform Agnosticism:** The core analysis logic must remain identical whether running in Desktop Mode (Network Source) or Web Mode (Zip Source).

**Blueprint-Specific Principles:**
*   **Stateless Execution:** Workers must function as pure "Request-Response" units. They must not cache file state or ASTs between jobs.
*   **Distilled Returns Strategy:** Full AST objects are strictly forbidden from crossing the worker-main thread boundary. Only lightweight, serialized metadata objects are permitted.
*   **Config-Driven Throttling:** The server-side watcher must strictly adhere to the debounce timings defined in the configuration file to prevent network saturation.
*   **Priority Queueing:** User-initiated actions (e.g., generating a pack) must preempt background maintenance tasks (e.g., re-indexing a changed file).

### **3. Architectural Flows**

**User Flow:**
1.  **Initialization:** Upon launching the application or dropping a project source, the user sees a "Scanning" indicator. Behind the scenes, the Worker Pool initializes.
2.  **Interaction:** The user interacts with the UI (selecting files, tracing dependencies) with zero latency, even while background analysis is occurring.
3.  **Live Update:** When the user saves a file in their external editor, the application's status indicator briefly flashes "Syncing," but the UI remains fully responsive.
4.  **Generation:** When the user clicks "Generate Pack," the system prioritizes this request, utilizing all available workers to generate architectural summaries immediately.

**Data Flow:**
1.  **Change Detection:** The Server-side watcher detects a file change. It waits for the configured debounce period to ensure the write is complete.
2.  **Notification:** The Server sends a lightweight WebSocket signal to the Browser indicating which files are "dirty."
3.  **Acquisition:** The Browser's Main Thread requests the fresh content of the dirty files from the Server via HTTP.
4.  **Dispatch:** The Main Thread sends the file content and analysis options to the Worker Pool Manager.
5.  **Processing:** A Worker parses the text into an AST, runs the analysis logic (Pipe Detection, Flow Analysis), extracts the required metadata, and discards the AST.
6.  **Aggregation:** The Worker returns the metadata payload to the Main Thread.
7.  **Integration:** The Main Thread updates the central Symbol Graph with the new node data.

**Logic Flow:**
1.  **Pool Management:** The Main Thread spins up `N-1` workers (where N is logical cores). These workers load the analysis scripts and enter a "Warm Wait" state.
2.  **Task Dispatching:** The Dispatcher receives a job (e.g., "Analyze File X"). It checks for an idle worker. If none are available, the task is queued based on priority.
3.  **Worker Execution:**
    *   **Input:** Receives source text.
    *   **Step A (Parse):** Generates AST.
    *   **Step B (Analyze):** Checks for re-exports (Pipe Rule) and logical activity (Flow Rule).
    *   **Step C (Distill):** Extracts public API surface and type definitions.
    *   **Output:** Returns a lightweight JSON object.
4.  **Graph Patching:** The Graph Manager receives the result. It removes the old node associated with the file path and inserts the new node, preserving existing edges where possible until a full link pass is triggered.

### **4. Overall Acceptance Criteria**
*   **Performance:** The UI thread must never block for more than 50ms during a full repository scan.
*   **Correctness:** The dependency graph generated by the multi-threaded engine must be identical to one generated by the single-threaded legacy engine.
*   **Stability:** The application must successfully recover from a "burst" of file changes (e.g., `git checkout`) without crashing or leaving workers in a hung state.
*   **Configuration:** The server-side watcher must demonstrably respect the `watchDebounceMs` setting from the configuration file.
*   **Efficiency:** AST objects must not be detectable in the message payloads transferred between threads.