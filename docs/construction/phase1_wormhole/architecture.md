# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   Transform the dependency tracing engine from a spatial "file-to-file" search into a logic-aware "data-flow" tracer to eliminate architectural noise (indexes, orchestrators, and prop-drilling) from the final context pack.
*   Maximize the signal-to-noise ratio for Large Language Models by prioritizing files that interact with specific data while treating passive "pipes" as zero-cost logical transitions.

### **1.1 Detailed Description**
*   This feature introduces a context-sensitive tracing mechanism that follows the "scent" of a specific code identifier (variable, prop, or symbol) through the codebase.
*   The system classifies every step in a trace as either a "Meaningful Interaction" (Logic Junction) or a "Pure Passthrough" (Data Pipe).
*   A "Meaningful Interaction" increments the user’s hop count and includes renaming, logical branching, rendering, or data transformation.
*   A "Pure Passthrough" (including barrel/index files) is treated as a zero-cost "Logical Wormhole," allowing the trace to penetrate deep architectural hierarchies without exhausting the hop limit.
*   A three-way configuration switch allows users to determine how these bypassed "Pipe" files are represented in the final output: full inclusion, total exclusion (preamble metadata only), or docblock extraction only.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **Purity & Statelessness:** Logic modules must remain pure, deriving scores and flows from the provided AST data without side effects.
    *   **Separation of Concerns:** Data-flow analysis must be decoupled from the graph traversal engine and the UI presentation layer.
    *   **Contextual Integrity:** The system must ensure that the "translation map" of data is never broken; if a name changes, the file becomes mandatory context.
*   **Blueprint-Specific Principles:**
    *   **Scent-Sensitive Tracing:** The hop cost of a file is not static; it is determined relative to the specific identifier being tracked.
    *   **Binary Interaction Heuristic:** A file is either a "Pipe" or a "Junction." There is no middle ground in hop-cost calculation to maintain system predictability.
    *   **Contractual Priority:** Any change to an identifier's "contract" (renaming or destructuring) is defined as a meaningful interaction to prevent AI confusion.

### **3. Architectural Flows**
*   **User Flow:**
    1.  The user selects a starting "Seed" symbol or file and defines the "Target Identifier" to be traced.
    2.  The user selects the "Logical Trace" mode (enabled by default).
    3.  The user configures the "Passive File Output" switch (Full Content, Docblocks Only, or Metadata Only).
    4.  The user sets the "Logical Hop" limit (representing the desired depth of actual logic interactions).
    5.  The user initiates the trace and receives feedback on how many physical files were traversed versus how many logical hops were consumed.
    6.  The user generates the context pack, which is filtered based on the selected output switch.

*   **Data Flow:**
    1.  The system identifies the target identifier's entry point in the source file.
    2.  As the traversal moves to a neighboring file, the system passes the "scent" (the current name of the identifier).
    3.  An internal analysis engine inspects the neighbor's structure to determine if the identifier is used, renamed, or simply forwarded.
    4.  If the identifier is renamed, the "scent" is updated for the next leg of the journey.
    5.  The traversal continues until the logical hop limit is reached or the identifier scent is lost.
    6.  The final list of files is passed to the pack generator, tagged with their "Meaningful" or "Passive" status.

*   **Logic Flow:**
    1.  **Identity Check:** Does the identifier appear in the file body outside of the signature and the exit/return point?
    2.  **Contract Check:** Is the identifier assigned to a new name (aliasing) or broken into properties (destructuring)?
    3.  **Barrel Check:** Is the file a dedicated re-exporter with zero internal logic?
    4.  **Hop Increment:** If Identity, Contract, or Logic checks are positive, increment the consumed hop count by 1.
    5.  **Bypass Logic:** If all checks are negative, move to the next file but maintain the current hop count.
    6.  **Output Filtering:** For every file tagged as "Passive," apply the user-selected three-way filter (Full, Docblock, or Metadata) during string concatenation.

### **4. Overall Acceptance Criteria**
*   The system successfully bypasses "Barrel" files (index files) without incrementing the hop count.
*   The system correctly identifies identifier renaming as a meaningful interaction and increments the hop count.
*   A user can successfully trace a variable through 10+ "pipe" components with a hop limit of only 3.
*   The three-way output switch correctly modifies the content of passive files in the final text dump.
*   The system provides clear UI feedback distinguishing between the "Logical Depth" and the "Physical Breadth" of a trace.
*   The tracer identifies "Prop-Drilling" architectural smells and provides a warning if the passthrough chain exceeds a predefined threshold.