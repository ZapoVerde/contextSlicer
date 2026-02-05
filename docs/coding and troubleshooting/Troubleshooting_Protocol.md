# The AiAnvil Project: Constructionist Troubleshooting Protocol

**Document-Type:** AI Assistant Debugging Guide

---

## Meta-Instruction: Recognizing When You're Stuck

As an AI assistant, you must monitor your own debugging behavior. If you notice yourself:

- Proposing the same fix multiple times with different explanations
- Saying "this should work" or "let's try..." for the 3rd+ time
- Getting contradictory error messages that don't make logical sense
- Cycling through different approaches without making progress
- Unable to explain WHY an error is occurring (only describing WHAT is happening)

**STOP. You are in a debugging loop. Invoke this protocol immediately.**

---

## Core Philosophy: Build Don't Hunt

When debugging complex problems, **stop guessing and start building.**

Instead of forming hypotheses about what might be wrong in a complex system, build the simplest possible version of what you're trying to achieve. This minimal working example becomes your reference point - proof that the pattern *can* work. The bug is then revealed by comparing what works (the minimal example) against what doesn't (the complex system).

**Key principle:** Do not attempt to debug configuration, environment, or secondary features until the core functionality works in isolation.

---

## When to Invoke This Protocol

Use this protocol when:

- Normal debugging approaches have failed after 2-3 attempts
- The system's behavior appears contradictory or illogical
- Multiple variables make it difficult to isolate the root cause
- You recognize yourself exhibiting the stuck patterns listed above

---

## The Protocol

### Step 1: Define the Minimal Goal

State the simplest, most fundamental piece of functionality you're trying to achieve. Be specific and positive.

**Example:** "A test file must successfully mock a class constructor and verify the mock was called once."

**Not this:** "Fix the Orchestrator test" (too vague)

---

### Step 2: Create a Clean Room Environment

Create a new, temporary, maximally simple file or project where you'll build the working example. This **must not** depend on any project code beyond the absolute minimum.

**Options:**
- A new standalone `.test.ts` file testing only the pattern
- A temporary directory outside the monorepo
- A fresh Vite/Node project with minimal setup

**Example:** "Create `temp-mock-test.spec.ts` that tests only class constructor mocking, with no other imports."

---

### Step 3: Achieve the Goal Incrementally

In your clean room, write the absolute minimum code to achieve your goal. Add one line at a time. Fix any errors immediately. Stop when the minimal example works perfectly with zero errors.

**Critical:** If you can't make it work in the clean room either, the problem is your understanding of the pattern itself. Research the correct approach before continuing.

---

### Step 4: Identify the Delta

Compare your working minimal example to the failing complex code. The bug must exist in the differences between them.

**Look for:**
- Additional imports or dependencies in the complex version
- Configuration differences
- Extra layers of abstraction
- Timing/ordering differences
- Environmental differences (monorepo vs standalone)

**Example:** "The working example uses `mockReturnValue()` but the failing test uses `mockImplementation()` with an arrow function. The arrow function is the problem."

---

### Step 5: Port the Solution

Apply the working pattern from your minimal example to the real code. This is no longer a guess - you're porting a proven solution.

If the port fails, return to Step 4 and look for additional deltas you missed.

---

### Step 6: Document If Architectural (Optional)

If this issue represents a fundamental architectural pattern or a non-obvious tooling conflict that could recur, add it to the **Known Issues Appendix** below.

**Only document if:**
- The issue is likely to recur across multiple files/features
- The solution is non-obvious or counterintuitive
- The root cause is architectural, not just a simple bug

**Don't document:**
- One-off typos or logic errors
- Issues specific to a single file
- Problems easily found in official documentation

---

# Appendix: Known Issues & Solutions

This appendix contains previously solved issues that represent recurring patterns or non-obvious solutions. Reference these before starting the full protocol if your issue matches a known pattern.

---

## A.1 Vitest Type Resolution Errors

**Symptoms:** TypeScript errors like `Cannot find namespace 'vi'` appear in `.spec.ts` files. Using `vi` as a value (`vi.fn()`) works, but using it as a type (`let x: vi.Mock`) fails.

**Root Cause:** Conflict between strict module settings (`verbatimModuleSyntax: true`) and reliance on implicit global types from Vitest.

**Solution:** Explicitly import all testing types from Vitest:

```typescript
// Add this to your imports
import type { Mock, MockedFunction } from 'vitest';

// Now you can use them
const myMock: Mock = vi.fn();
```

**Exemplar:** `packages/client/src/shared/exemplars/vitest-explicit-type-imports.spec.ts`

---

## A.2 Complex Drag-and-Drop State Management

**Symptoms:** Difficulty managing state, event propagation, and re-rendering in UIs with complex, nested, or multi-list drag-and-drop interactions.

**Root Cause:** The inherent complexity of managing DnD state declaratively in React. Issues involve incorrect event handling, performance bottlenecks, or improper use of the DnD library's context and sensors.

**Solution:** Use a centralized state manager (Zustand), stable IDs, and memoized components. The `zubox` component demonstrates this pattern for complex cases.

**Exemplar:** `packages/client/src/shared/exemplars/zubox/`

---

## A.3 Linter False Positive on Function-Typed Variables in Tests

**Symptoms:** When declaring a function-typed variable using `let` at the top of a `describe` block (e.g., `let myFunc: (arg: string) => void;`), ESLint incorrectly reports `no-unused-vars` for the parameter (`arg`).

**Root Cause:** A known tooling bug triggered by: 1) top-level `let` variable, 2) with function signature type, 3) assigned in `beforeEach`. ESLint misinterprets the parameter in the type definition as an unused variable in implementation scope.

**Solution:** Use a `setup()` helper function instead of shared `let` variables with `beforeEach`:

**Before (triggers bug):**
```typescript
describe('My Test', () => {
  let myHandler: (action: string) => Promise<void>; // <-- Linter error
  let mockDep: Mock;

  beforeEach(() => {
    mockDep = vi.fn();
    myHandler = createHandler(mockDep);
  });

  it('should work', () => {
    myHandler('test');
    expect(mockDep).toHaveBeenCalled();
  });
});
```

**After (robust pattern):**
```typescript
function setupTest() {
  const mockDep = vi.fn();
  const myHandler = createHandler(mockDep);
  return { myHandler, mockDep };
}

describe('My Test', () => {
  it('should work', () => {
    const { myHandler, mockDep } = setupTest();
    myHandler('test');
    expect(mockDep).toHaveBeenCalled();
  });
});
```

---

## A.4 TypeScript Error TS2349 on CommonJS Module Imports

**Symptoms:** When importing CommonJS packages (like `ignore` or `adm-zip`), TypeScript throws `TS2349: This expression is not callable. Type 'typeof import(...)' has no call signatures`, even when the import appears correct.

**Root Cause:** Incompatibility between modern module resolution (`"moduleResolution": "NodeNext"`) and type declarations of older CommonJS packages. TypeScript imports the module's type shape but doesn't recognize that the default export is callable.

**Solution (try in order):**

**First, try namespace import:**
```typescript
import * as ignore from 'ignore';
const ig = ignore(); // Often works without type casting
```

**If that fails, try accessing .default:**
```typescript
import ignore from 'ignore';
const ig = ignore.default(); // Some packages expose as .default
```

**Last resort - targeted type assertion:**
```typescript
import ignore from 'ignore';

// Document why this is necessary
// The 'ignore' package has CJS/ESM type definition issues under NodeNext
// module resolution. Verified this is a type-only problem by checking
// runtime behavior works correctly.
const ig = (ignore as any)();
```

**Key points:**
- Try simpler solutions first (namespace import, .default access)
- Only use type assertions when other approaches fail
- Always comment explaining it's a type definition issue, not a logic fix
- Verify the code actually works at runtime (not just a TypeScript issue)

---

## A.5 Vitest Environment Initialization Failures with Firebase

**Symptoms:** Tests attempt real Firebase connections despite mocks. Errors include:
- `FirebaseError: 7 PERMISSION_DENIED`
- `TypeError: Cannot read properties of undefined (reading 'getProvider')`
- `Error: [vitest] No "getAuth" export is defined on the "firebase/auth" mock`

**Root Cause:** Module loading race condition. The test runner imports your app's Firebase initialization code before `vi.mock()` calls are applied, causing the real SDK to be called.

**Solution:** Mock the entire external SDK in `vitest.setup.ts` (loaded by `vitest.config.ts`):

```typescript
// vitest.setup.ts
import { vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  // ... other auth functions
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  // ... other firestore functions
}));
```

Then in your test files:
```typescript
import { getDoc } from 'firebase/firestore';

// Get typed reference to mocked function
const mockGetDoc = vi.mocked(getDoc);
mockGetDoc.mockResolvedValue(/* mock data */);
```

**Key points:**
- Mock at the external SDK boundary, not your internal wrappers
- Mock asynchronously (`mockResolvedValue`) to prevent timeouts
- If issues persist, use the Constructionist Protocol to create a standalone test project

**Exemplar:** `temp-test-project/` (if created and preserved)

---

## A.6 Zustand Store Tests Fail with "Cannot find package 'react'"

**Symptoms:** Test runner fails with `Error: Cannot find package 'react' imported from .../zustand/esm/react.mjs` when testing a Zustand store.

**Root Cause:** The default `import { create } from 'zustand'` resolves to Zustand's React-specific module, which has a hard dependency on `react`. In headless environments (VS Code extensions, servers), React isn't installed, so the test fails.

**Solution:** Use Zustand's vanilla entry point for non-React environments:

**Before (fails in Node.js):**
```typescript
import { create } from 'zustand';

export const useMyStore = create<MyStore>((set) => ({
  // ... store logic
}));
```

**After (works everywhere):**
```typescript
import { createStore } from 'zustand/vanilla';

export const myStore = createStore<MyStore>((set) => ({
  // ... store logic
}));

// In tests, use directly:
// myStore.getState()
// myStore.setState({ ... })
```

---

## A.7 Vitest Hoisting and Mocking Failures with `vscode`

**Symptoms:** Cascade of errors when mocking the `vscode` module:
1. `ReferenceError: Cannot access '[mockFunction]' before initialization`
2. `Error: [vitest] No "window" export is defined on the "vscode" mock`
3. TypeScript errors accessing custom mock properties

**Root Cause:** Multi-layered tooling conflict:
1. **Hoisting:** `vi.mock()` is hoisted to the top, creating a temporal dead zone for variables defined outside the factory
2. **Incomplete mocks:** The mock must satisfy all imports, including transitive dependencies like loggers
3. **Type safety:** Custom mock properties need proper type casting

**Solution:** Define the complete mock inside the `vi.mock()` factory:

**Before (triggers errors):**
```typescript
const mockReadFile = vi.fn(); // <-- In temporal dead zone

vi.mock('vscode', () => ({
  workspace: { fs: { readFile: mockReadFile } },
  // Missing vscode.window - will fail if logger imports vscode
}));
```

**After (hoisting-safe and complete):**
```typescript
vi.mock('vscode', () => {
  // All mocks created inside the factory
  const mockReadFile = vi.fn();
  const mockOutputChannel = { appendLine: vi.fn() };
  const mockWindow = { createOutputChannel: vi.fn().mockReturnValue(mockOutputChannel) };

  return {
    workspace: { fs: { readFile: mockReadFile } },
    window: mockWindow, // Satisfies logger dependency
    Uri: { file: (path: string) => ({ fsPath: path }) },
    default: {},
    // Expose internal mocks for test access
    __mockReadFile: mockReadFile,
  };
});

import { describe, it, vi } from 'vitest';
import * as vscode from 'vscode';
import type { Mock } from 'vitest';

// Type-safe extraction of custom mock property
const mockReadFile = (vscode as unknown as { __mockReadFile: Mock }).__mockReadFile;

describe('MyTest', () => {
  it('works', () => {
    mockReadFile.mockResolvedValue(Buffer.from('data'));
    // ... test
  });
});
```

---

## A.8 Mocking Class Constructors in Vitest

**Symptoms:** When mocking a class instantiated with `new ClassName()`, tests may pass but produce warnings: `[vitest] The vi.fn() mock did not use 'function' or 'class' in its implementation`.

**Root Cause:** Vitest tracks class instantiation differently than function calls. Arrow functions returning plain objects don't properly track constructor calls.

**Solution:** Use one of two patterns:

### Pattern 1: Mock Return Value (Use This 90% of the Time)

```typescript
const mockExecuteNode = vi.fn().mockResolvedValue(undefined);

vi.mocked(Orchestrator).mockReturnValue({
  executeNode: mockExecuteNode,
} as Orchestrator);
```

**When to use:** When you just need the instance to have specific methods.

### Pattern 2: Mock Implementation (For Constructor Arguments)

```typescript
const mockExecuteNode = vi.fn().mockResolvedValue(undefined);

vi.mocked(Orchestrator).mockImplementation(function(this: any) {
  this.executeNode = mockExecuteNode;
} as any);

// Now you can verify constructor arguments
expect(Orchestrator).toHaveBeenCalledWith(expectedArg1, expectedArg2);
```

**When to use:** When you need to verify what arguments the constructor received.

**Key points:**
- Pattern 1 is simpler and sufficient for most cases
- Pattern 2 uses `function` (not arrow function) for proper `this` binding
- The `as any` cast is necessary due to Vitest's mock typing limitations

**Common mistakes:**
- ❌ Using arrow functions: `() => ({ executeNode: vi.fn() })`
- ❌ Overcomplicating with `ConstructorParameters` or multiple type casts
- ✅ Keep it simple: use `mockReturnValue` unless you specifically need `mockImplementation`