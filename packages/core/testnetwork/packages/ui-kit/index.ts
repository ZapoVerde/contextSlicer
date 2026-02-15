/** @file packages/ui-kit/index.ts */
export * from './components';

// Part 2 Logic Violation: Side Effect
if (typeof window !== 'undefined') {
  console.log('UI Kit Initialized');
}