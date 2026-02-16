/**
 * @file packages/core/testnetwork/packages/ui-kit/index.ts
 * @stamp {"ts":"2026-02-15T22:35:00Z"}
 * @architectural-role UI Component / Barrel
 * @description
 * The root entry point for the UI Kit. Contains re-exports and intentional 
 * side-effect logic to test the "False Pipe" detection rules.
 * 
 * @core-principles
 * 1. OWNS the initialization logic for the UI library.
 * 2. MUST be identified as Logic (Cost 1) due to side effects.
 */

export * from './components';

// Part 2 Logic Violation: Side Effect
// This console.log ensures that hasLogicActivity returns true, 
// classifying this file as Logic rather than a Pipe.
if (typeof window !== 'undefined') {
  console.log('UI Kit Initialized');
}

/**
 * Default export to satisfy dependency links from ComplexBarrel.ts.
 * Without this, the path App -> ComplexBarrel -> ui-kit/index.ts is 
 * considered broken in a symbol-aware graph.
 */
const ThemeProvider = { name: 'DarkTheme' };
export default ThemeProvider;