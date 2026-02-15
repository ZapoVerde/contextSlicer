/**
 * @file packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts
 * @stamp {"ts":"2026-02-15T19:30:00Z"}
 * @architectural-role Business Logic
 * @description
 * Implements Part 2 of the Two-Part Pipe Detection Rule. Scans a file's AST 
 * for "Logic Activity"—meaningful interactions like JSX rendering, hook usage, 
 * or internal declarations—regardless of specific variable scents.
 * 
 * @core-principles
 * 1. ENFORCES the binary classification: Logic-bearing vs. Passive structural.
 * 2. MUST identify JSX and Hooks as definitive logic signatures.
 * 3. OWNS the detection of internal state or transformation logic.
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
 * Analyzes the AST for signs of functional logic. Following the Two-Part Pipe Rule,
 * a file that "does anything" beyond strictly re-exporting is considered Logic.
 * 
 * @param ast - The parsed Babel File AST.
 * @returns True if the file contains JSX, Hooks, conditionals, or internal definitions.
 */
export function hasLogicActivity(ast: Node): boolean {
  if (ast.type !== 'File') return false;

  let activityFound = false;

  // We use a high-performance traversal to find a single "smoking gun" of logic.
  // Once logic is found, we stop immediately.
  traverse(ast, {
    // 1. JSX Usage (The UI Logic Signature)
    // Any JSX element or fragment represents a meaningful UI junction.
    JSXOpeningElement(path) {
      activityFound = true;
      path.stop();
    },
    JSXFragment(path) {
      activityFound = true;
      path.stop();
    },

    // 2. Hook Usage
    // Calls to useX hooks imply state management or side effects.
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
    ConditionalExpression(path) { // Ternaries
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
    // Defining functions or classes locally is logic activity.
    FunctionDeclaration(path) {
      // We skip if this is part of an ExportNamedDeclaration that the 
      // barrel detector might handle, though any internal function is logic.
      activityFound = true;
      path.stop();
    },
    ClassDeclaration(path) {
      activityFound = true;
      path.stop();
    },

    // 5. Variable Definitions (with assignments)
    // Creating constants or variables that aren't just re-exports.
    VariableDeclarator(path) {
      // If a variable is assigned a value (init), it's logic/definition.
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
    nextIdentifier: _targetIdentifier, // Scent tracking is superseded by structural logic
    reason: isMeaningful ? 'Logic/Activity Detected' : 'Passive/Structural'
  };
}