/**
 * @file packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts
 * @stamp {"ts":"2026-02-14T07:45:00Z"}
 * @architectural-role Business Logic
 * @description
 * Implements the "Scent-Sensitive" flow analysis heuristic. Evaluates whether a 
 * specific identifier interacts meaningfully within a file or simply passes 
 * through, while tracking identifier renaming (aliasing).
 * 
 * @core-principles
 * 1. IS responsible for identifier-level lifecycle tracking.
 * 2. ENFORCES the binary "Meaningful vs. Passive" classification.
 * 3. MUST update the "Scent" (identifier name) when aliasing is detected.
 * 
 * @api-declaration
 *   export interface FlowResult { isMeaningful: boolean; nextIdentifier: string; }
 *   export function analyzeFlow(ast: Node, targetIdentifier: string): FlowResult;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import traverse from '@babel/traverse';
import type { Node } from '@babel/types';

export interface FlowResult {
  /** True if the identifier is used in logic, rendered, or transformed */
  isMeaningful: boolean;
  /** The name of the identifier to track in downstream files */
  nextIdentifier: string;
}

/**
 * @id packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts#analyzeFlow
 * @description
 * Analyzes the AST to determine the interaction score of a specific identifier.
 * 
 * @param ast - The Babel File AST.
 * @param targetIdentifier - The current name of the identifier being tracked.
 * @returns A FlowResult indicating meaningfulness and the next scent name.
 */
export function analyzeFlow(ast: Node, targetIdentifier: string): FlowResult {
  let interactionCount = 0;
  let nextIdentifier = targetIdentifier;
  let aliased = false;

  traverse(ast, {
    // 1. Detect Aliasing (Renaming)
    // Case A: Destructuring with rename: const { user: account } = props;
    ObjectProperty(path) {
      if (
        path.node.key.type === 'Identifier' &&
        path.node.key.name === targetIdentifier &&
        path.node.value.type === 'Identifier' &&
        path.node.value.name !== targetIdentifier
      ) {
        // Ensure this is a pattern (destructuring), not an object literal creation
        if (path.parentPath.isObjectPattern()) {
          aliased = true;
          nextIdentifier = path.node.value.name;
        }
      }
    },

    // Case B: Variable Assignment / Aliasing: const account = user;
    VariableDeclarator(path) {
      if (
        path.node.init?.type === 'Identifier' && 
        path.node.init.name === targetIdentifier &&
        path.node.id.type === 'Identifier'
      ) {
        aliased = true;
        nextIdentifier = path.node.id.name;
      }
    },

    // 2. Detect Usage / Interactions
    Identifier(path) {
      if (path.node.name !== targetIdentifier) return;

      // --- EXCLUSIONS (Pass-throughs / Pipes) ---

      // A: Incoming Function Parameters
      if (path.listKey === 'params' || path.key === 'param') return; // function(user) or catch(user)
      
      // Destructured params: function({ user })
      if (path.parentPath.isObjectProperty() && path.key === 'value') {
         const grandParent = path.parentPath.parentPath;
         if (grandParent?.isObjectPattern()) {
           const greatGrandParent = grandParent.parentPath;
           // Check if object pattern is in params list
           if (greatGrandParent?.isFunction() && greatGrandParent.node.params.includes(grandParent.node as any)) {
             return; 
           }
         }
      }

      // B: Pure forwarding in JSX: <Child user={user} />
      // Must check grandparent because Identifier is wrapped in JSXExpressionContainer
      if (path.parentPath.isJSXExpressionContainer()) {
        const grandParent = path.parentPath.parentPath;
        if (grandParent?.isJSXAttribute() && grandParent.node.name.name === targetIdentifier) {
           return;
        }
      }

      // C: Standard Re-exports: export { user }
      if (path.parentPath.isExportSpecifier()) return;

      // D: Destructuring without rename: const { user } = props;
      if (path.parentPath.isObjectProperty()) {
         // If shorthand, it's a pass-through extraction
         if (path.parentPath.node.shorthand) return;
         // If it is the key in { user: user }, and value matches, it's pass-through
         // Note: we are strictly looking for matching identifiers.
         if (path.key === 'value' &&
             path.parentPath.node.key.type === 'Identifier' && 
             path.parentPath.node.key.name === targetIdentifier &&
             path.parentPath.node.value.type === 'Identifier' &&
             path.parentPath.node.value.name === targetIdentifier) {
           return;
         }
         // If visiting the key 'user' in { user: ... }, it's just a property name, not usage.
         if (path.key === 'key') return;
      }
      
      // E: Return Statement: return user;
      if (path.parentPath.isReturnStatement()) return;

      // --- INCLUSIONS (Meaningful Interactions) ---

      // A: JSX Rendering / Usage: <div>{user}</div> OR <Child data={user} />
      // Note: <Child user={user} /> was caught by Exclusion B above.
      if (path.parentPath.isJSXExpressionContainer()) {
        interactionCount++;
        return;
      }

      // B: Logic Branching & Expressions
      if (
        path.parentPath.isIfStatement() || 
        path.parentPath.isConditionalExpression() || 
        path.parentPath.isLogicalExpression() || 
        path.parentPath.isBinaryExpression() ||
        path.parentPath.isUnaryExpression()
      ) {
        interactionCount++;
        return;
      }

      // C: Member Access: user.name
      if (path.parentPath.isMemberExpression() && path.parentPath.node.object === path.node) {
        interactionCount++;
        return;
      }

      // D: Hook Dependencies
      if (path.parentPath.isArrayExpression()) {
        const callExpr = path.parentPath.parentPath;
        if (callExpr?.isCallExpression() && callExpr.node.callee.type === 'Identifier') {
           // Heuristic: hooks start with 'use'
           if (callExpr.node.callee.name.startsWith('use')) {
             interactionCount++;
             return;
           }
        }
      }
      
      // E: Function Calls: doSomething(user)
      if (path.parentPath.isCallExpression() && path.listKey === 'arguments') {
        interactionCount++;
        return;
      }
    }
  });

  return {
    isMeaningful: aliased || interactionCount > 0,
    nextIdentifier
  };
}