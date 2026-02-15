# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   Transform the context gathering process from a simple file-aggregation tool into a "Three-Layer Context Compiler" that generates a self-contained, high-signal developer environment.
*   The primary objective is to eliminate AI hallucinations caused by "type vacuums" by automatically resolving and extracting the surface area of external dependencies that cross the selected context boundary.

### **1.1 Detailed Description**
*   The system implements a structured three-tier output format designed to maximize LLM comprehension while minimizing token waste. 
*   Layer 1 (Spatial Context) provides a hierarchical map of the included files. 
*   Layer 2 (Type Grammar) identifies every symbol imported by the pack that resides outside the current hop-range and extracts their flattened type definitions into a centralized "Glossary of Contracts." 
*   Layer 3 (Source Logic) provides the implementation details, using a "Developer Brief" format for summarized files that emphasizes behavioral intent (Purpose) and symbol provenance (Input Sources) over raw code. 
*   This approach allows users to maintain extremely tight context boundaries without losing the type safety and interface clarity required for complex refactoring.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **Principle of Explicit Intent:** The system must describe *why* code exists and *how* it interacts, not just *what* it is.
    *   **Separation of Concerns:** Distinct separation between topological structure, type definitions, and behavioral logic.
    *   **Token Optimization:** Aggressive deduplication of boundary types and truncation of non-essential type fields.
*   **Blueprint-Specific Principles:**
    *   **The Three-Layer Mandate:** Every generated pack must follow the strict Tree -> Library -> Logic sequence.
    *   **Flattened Boundary Extraction:** External interfaces must be resolved into their final "flattened" shape to ensure the AI has a complete contract without needing to chase inheritance chains.
    *   **Scent-Sensitive Provenance:** Every imported symbol in a summary must be accompanied by its logical source path to prevent provenance ambiguity.
    *   **Behavioral Classification:** Summarized files must be categorized by their architectural pattern: Generate (Sources), Transform (Logic), Consume (Sinks), or Passthrough (Pipes).

### **3. Architectural Flows**
*   **User Flow:**
    1.  The user provides a "Seed" file or symbol representing the center of their current task.
    2.  The user defines the expansion range using a dual-resolution gradient, selecting how many "Upstream" (Imports) and "Downstream" (Usage) hops should be included as Full Code vs. Summaries.
    3.  The system generates a pack that includes the requested logic plus an automatically discovered library of all external types required to make that logic valid.
    4.  The user receives a single, compiled document that serves as a complete "contractual universe" for the LLM.
*   **Data Flow:**
    1.  **Selection Phase:** The system calculates the set of files within the logical hop range of the seed.
    2.  **Boundary Scan:** The system inspects the import declarations of every file in the selection set.
    3.  **Leakage Detection:** Any import pointing to a file *not* in the selection set is marked as a "Boundary Crossing."
    4.  **Peeking Phase:** The system retrieves the specific type signatures for these crossing symbols from the project's broader file index.
    5.  **Flattening Phase:** The system resolves inheritance and type aliases for those symbols to create a standalone definition.
    6.  **Assembly Phase:** The tree, the extracted boundary library, and the source logic are concatenated into the final format.
*   **Logic Flow:**
    1.  **Resolution Logic:** The system determines if a file should be Full, Summarized, or a Boundary Type based on its topological distance from the seed.
    2.  **Classification Logic:** Files are analyzed to determine their architectural pattern based on the flow of symbols (Inputs vs. Outputs).
    3.  **Wormhole Logic:** Structural files (Barrels/Index files) are automatically identified and forced into a "Passthrough" summary to prevent hop-count bloat.
    4.  **Deduplication Logic:** The system ensures that a boundary type imported by ten different files is only extracted and presented once in the Grammar layer.

### **4. Overall Acceptance Criteria**
*   **Spatial Integrity:** Every context pack begins with a text-based tree representing the files included in the implementation layer.
*   **Contractual Completeness:** Any symbol imported by a file in the pack that is not itself in the pack MUST have its definition present in the Boundary Library.
*   **Flattening Success:** Extracted boundary types must include their immediate parent interfaces/properties to be usable by an LLM without further expansion.
*   **Provenance Accuracy:** All summaries must explicitly list the source path for every imported symbol shown.
*   **UI Clarity:** The expansion controls must use "Upstream/Downstream" terminology and provide visual feedback for the dual-resolution zones.
*   **Token Efficiency:** Summarized files must use truncated type surfaces for definitions exceeding a specific complexity threshold.