# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to implement a multi-resolution context generation system that maximizes the utility of Large Language Model (LLM) token windows. By providing full implementation details for core logic and distilled semantic summaries for peripheral dependencies, the system enables the AI to understand deep architectural context without being overwhelmed by implementation noise.

### **1.1 Detailed Description**
*   The system transitions from a binary "In/Out" file selection model to a graduated "Resolution Gradient" model. This is achieved through a dual-threshold hop-counting strategy. Users define a focal point (seed) and set two logical boundaries: an inner boundary for full-text extraction and an outer boundary for semantic summarization. Files within the inner boundary that contain meaningful logic are extracted in full, while files in the outer boundary—or those identified as purely structural (barrels/pipes)—are reduced to a standardized summary format. This summary captures the "Scent" of data flow (Inputs, Outputs, and Local Types) and identifies the file's architectural role through four distinct patterns: Transform, Consume, Generate, and Passthrough.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **Logic-Aware Slicing:** Context must be gathered based on functional dependencies rather than just directory structure.
    *   **Token Parsimony:** Every byte included in the output must serve a specific diagnostic or constructive purpose for the LLM.
    *   **Separation of Concerns:** The extraction logic (Tracer) must remain independent of the representation logic (Summary Generator).
*   **Blueprint-Specific Principles:**
    *   **Resolution Hierarchy:** The depth of full extraction must always be less than or equal to the depth of summary extraction.
    *   **Infrastructure Transparency:** Structural files (barrels/index files) are treated as "wormholes" that facilitate traversal but do not contribute to implementation detail; they are autosummarized regardless of their proximity to the seed.
    *   **Internal Symbol Isolation:** Summaries must focus exclusively on internal project symbols, omitting library or third-party identifiers to preserve clarity.
    *   **Local Type Sovereignty:** Only type definitions originating within a specific file are included in its summary to prevent redundant type-pasting across the pack.

### **3. Architectural Flows**
*   **User Flow:**
    1.  The user identifies a specific symbol or file as the seed for their task.
    2.  The user interacts with a dual-ticker control to set the "Full Extraction" depth (the core work zone) and the "Summary" depth (the contextual background).
    3.  The user enables "Smart Trace" to ensure the hop counts respect logical boundaries rather than physical file counts.
    4.  The system visually identifies which files will be extracted in full and which will be summarized.
    5.  The user initiates the generation, receiving a formatted document where core files are implementation-complete and peripheral files are logically distilled.
*   **Data Flow:**
    1.  The system retrieves raw source data from the active data source.
    2.  An analyzer generates Abstract Syntax Trees (AST) for all files within the maximum defined range.
    3.  The Dependency Graph maps relationships and classifies nodes as "Meaningful Logic" or "Structural Passthroughs."
    4.  The Summary Generator processes nodes designated for summarization, extracting identifier names, export signals, and type-definition blocks.
    5.  The Pack Assembler orchestrates the final string construction, interleaving full-text blocks and summary blocks into a unified context pack.
*   **Logic Flow:**
    1.  The Tracer initiates a Breadth-First Search (BFS) from the seed, calculating logical hops (cost of 0 for passthroughs, cost of 1 for logic).
    2.  For each discovered node, a conditional check determines the resolution level:
        *   If (Node == Passthrough) OR (Depth > Inner Ticker) AND (Depth <= Outer Ticker) -> **Summary Mode**.
        *   If (Node == Meaningful) AND (Depth <= Inner Ticker) -> **Full Mode**.
    3.  The Summary Engine analyzes the AST for the target file:
        *   Identifies internal "In" symbols by filtering for relative imports.
        *   Identifies "Out" symbols by cataloging exports.
        *   Assigns a "Flow Pattern" based on the ratio of In-symbols to Out-symbols.
        *   Extracts literal text for locally declared type interfaces and aliases.
    4.  The system applies a final filter to remove any files matching exclusion patterns.

### **4. Overall Acceptance Criteria**
*   **Multi-Resolution Output:** The generated context pack must successfully contain a mix of full-text source code and semantic summaries as defined by the user’s ticker settings.
*   **Mandatory Autosummarization:** Files identified as "Barrels" or "Passthroughs" must be represented as summaries even when located within the "Full Extraction" hop range.
*   **Semantic Accuracy:** Summaries must correctly categorize files into the four defined patterns (Transform, Consume, Generate, Passthrough) based on symbol flow.
*   **Internal Symbol Integrity:** Symbol lists in summaries must exclude library-specific identifiers (e.g., standard framework hooks or external utilities).
*   **Type Capture:** The "Types Created" section of a summary must include the full definition of locally declared types but omit types imported from other files.
*   **Performance:** The trace and summary generation for up to 300 files must complete in a timeframe that does not trigger browser "long task" warnings (typically under 2 seconds).