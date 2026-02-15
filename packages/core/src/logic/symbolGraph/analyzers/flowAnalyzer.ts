/**
 * @file packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts
 * @stamp {"ts":"2026-02-15T21:25:00Z"}
 * @architectural-role Business Logic
 * @description
 * Implements Part 2 of the Two-Part Pipe Detection Rule. Scans a file's AST 
 * for "Logic Activity"—meaningful interactions like JSX rendering, hook usage, 
 * type definitions, or internal declarations—regardless of specific variable scents.
 * 
 * @core-principles
 * 1. ENFORCES the binary classification: Logic-bearing vs. Passive structural.
 * 2. MUST identify JSX, Hooks, and Type definitions as definitive logic signatures.
 * 3. OWNS the detection of internal state, transformation logic, or contract definitions.
 * 
 * @api-declaration
 *   export function hasLogicActivity(ast: Node): boolean;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import traverse from '@babel/traverse';
import type { Node } from '@babel/types';

/**
 * @id packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts#hasLogicActivity
 * @description
 * Analyzes the AST for signs of functional or structural logic. Following the 
 * Two-Part Pipe Rule, a file that "does anything" beyond strictly re-exporting 
 * is considered Logic (Cost 1).
 * 
 * @param ast - The parsed Babel File AST.
 * @returns True if the file contains JSX, Hooks, Type Definitions, or internal logic.
 */
export function hasLogicActivity(ast: Node): boolean {
  if (ast.type !== 'File') return false;

  let activityFound = false;

  // We use high-performance traversal to find a single "smoking gun" of logic.
  // Once logic is found, we stop immediately.
  traverse(ast, {
    // 1. JSX Usage (The UI Logic Signature)
    JSXOpeningElement(path) {
      activityFound = true;
      path.stop();
    },
    JSXFragment(path) {
      activityFound = true;
      path.stop();
    },

    // 2. Hook Usage
    CallExpression(path) {
      const callee = path.node.callee;
      if (callee.type === 'Identifier' && callee.name.startsWith('use')) {
        activityFound = true;
        path.stop();
      }
    },

    // 3. Logic Structures & Control Flow
    IfStatement(path) {
      activityFound = true;
      path.stop();
    },
    SwitchStatement(path) {
      activityFound = true;
      path.stop();
    },
    ConditionalExpression(path) {
      activityFound = true;
      path.stop();
    },
    ForStatement(path) {
      activityFound = true;
      path.stop();
    },
    WhileStatement(path) {
      activityFound = true;
      path.stop();
    },

    // 4. Internal Definitions
    FunctionDeclaration(path) {
      activityFound = true;
      path.stop();
    },
    ClassDeclaration(path) {
      activityFound = true;
      path.stop();
    },

    // 5. TypeScript Contract Definitions
    // Defining interfaces or types is considered architectural activity.
    TSInterfaceDeclaration(path) {
      activityFound = true;
      path.stop();
    },
    TSTypeAliasDeclaration(path) {
      activityFound = true;
      path.stop();
    },
    TSEnumDeclaration(path) {
      activityFound = true;
      path.stop();
    },

    // 6. Variable Definitions (with assignments)
    VariableDeclarator(path) {
      if (path.node.init !== null) {
        activityFound = true;
        path.stop();
      }
    }
  });

  return activityFound;
}

/**
 * @deprecated Use hasLogicActivity for the updated Pipe Detection Rule.
 * Maintained for temporary compatibility during the refactor.
 */
export function analyzeFlow(ast: Node, _targetIdentifier: string) {
  const isMeaningful = hasLogicActivity(ast);
  return {
    isMeaningful,
    nextIdentifier: _targetIdentifier,
    reason: isMeaningful ? 'Logic/Activity Detected' : 'Passive/Structural'
  };
}