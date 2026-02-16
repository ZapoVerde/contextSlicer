# Updated Testing Strategy: The Dual-Tiered Validation Approach

Following the necessary refactoring to support the distributed worker architecture, the testing strategy has been explicitly split into two distinct, complementary tiers. This strategy ensures high **logic stability** through dedicated unit testing while maintaining high **system fidelity** through integration testing.

This separation resolves the fragility noted when structural changes in the codebase interfered with pure logic validation.

---

## Tier 1: Logical Contract Tests (In-Memory)
These tests focus purely on the **rules** governing context pack generation. They are isolated, fast, and completely independent of the physical file structure, ensuring the core intellectual property of the slicer remains intact.

| Test File | Purpose | Key Testable Logic |
| :--- | :--- | :--- |
| `03-resolution-priority.spec.ts` | **Conflict Resolution** | Verifies the **Highest Resolution Wins** logic when a file is requested as both `Full` and `Summary`. |
| `05-exclusion-filtering.spec.ts` | **Sieve Logic** | Validates that inclusion patterns and exclusion patterns are applied correctly, testing the logic of **Trace-Through** across excluded nodes. |
| `07-scent-tracking.spec.ts` | **Flow Analysis** | Validates the purity of the `flowAnalyzer` by confirming that simple identifier aliasing and variable assignment are correctly classified as **Logic (Cost 1)**. |

**Mechanism:** These tests use an **In-Memory Micro-Repo** constructed directly within the test function (as seen in the refactor of `03-resolution-priority.spec.ts`). The `buildSymbolGraph` function is called with a mocked `WorkerPool` that returns pre-defined, minimal metadata that *simulates* the worker's output for the desired logic test.

---

## Tier 2: Structural Integration Tests (Prism Network)
These tests focus on the **Fidelity** of the implementation, ensuring that the distributed pieces work together correctly on a realistic codebase that contains architectural friction.

| Test File | Purpose | Key Testable Logic |
| :--- | :--- | :--- |
| `01-pipe-detection.spec.ts` | **Pipe Rule Verification** | Confirms the worker logic correctly distinguishes between **Pure Pipes** (Cost 0) and **Logic Junctions** (Cost 1) based on real-world imports and side effects. |
| `02-hop-counting.spec.ts` | **Logical vs. Physical BFS** | Verifies the **Augmented Tracer** correctly applies Cost 0 to Pipes, enabling deep traversal across many physical files in minimal logical hops (the "Wormhole" effect). |
| `04-boundary-detection.spec.ts` | **Boundary Layer Integrity** | Validates that the **Boundary Scanner** and **Type Extractor** work across the monorepo structure, correctly resolving aliases and extracting type definitions from excluded paths. |
| `06-output-formatting.spec.ts` | **Assembly & Serialization** | Confirms the Main Thread correctly stages the three layers (Spatial Map, Boundary Library, Source Logic) and applies the `[SEED]` / `[SUMMARY]` markers based on the tracer's final resolution map. |

**Mechanism:** These tests rely on the **`NetworkHarness`**, which sets up the entire `testnetwork` folder structure on disk and builds the full Symbol Graph using the actual **MockWorkerPool** implementation. This ensures that path resolution and Babel parsing quirks are tested in a controlled, repeatable environment.

### **Conclusion**

The new strategy provides **comprehensive coverage**:
*   **Logic Stability** is guaranteed by the fast, isolated **Tier 1** tests.
*   **System Fidelity** is guaranteed by the high-detail, slower **Tier 2** integration tests running against the Prism Network.

The system is now fully implemented and its testing suite is significantly more **robust** and **maintainable**.

**STATUS: Testing Strategy Documented | NEXT: Work Complete**