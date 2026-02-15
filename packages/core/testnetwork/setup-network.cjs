/** @file packages/core/testnetwork/setup-network.cjs
 * @stamp {"ts":"2026-02-15T20:45:00Z"}
 * @architectural-role Utility Script
 * @description
 * Generates the "Hardened Prism Network v2.1" test bed. This script creates 
 * a complex monorepo structure used to validate the Context Slicer's heuristics.
 * 
 * v2.1 Updates:
 * - Added PropDriller.tsx (React pattern false-positive test)
 * - Added tsconfig.json (Path alias support)
 * - Added Type-only imports and Enums
 * - Added Hybrid Import/Export patterns
 * - Added TEST_SCENARIOS.md
 * 
 * @contract
 *   assertions:
 *     purity: side-effects (Filesystem I/O)
 *     external_io: fs
 */

const fs = require('fs');
const path = require('path');

const root = __dirname;

const files = {
  // --- ROOT CONFIGURATION ---
  'package.json': `
{
  "name": "prism-network",
  "workspaces": ["packages/*"]
}
`,
  // New: Path Aliases Configuration
  'tsconfig.json': `
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@prism/shared-types/*": ["packages/shared-types/*"],
      "@prism/ui-kit/*": ["packages/ui-kit/*"],
      "@prism/web/*": ["packages/web/*"]
    }
  }
}
`,
  // New: Test Scenarios Documentation
  'TEST_SCENARIOS.md': `
# Prism Network Test Scenarios

## Scenario 1: The Logical Pipe Test
*   **Seed:** \`packages/web/App.tsx\`
*   **Settings:** 1 Hop Full / 2 Hops Summary (Logical Mode)
*   **Target:** \`packages/ui-kit/components/buttons/core/Button.tsx\`
*   **Expected:** 
    *   The tracer should skip the intermediate barrels in \`ui-kit\`.
    *   Physical Hops: 4 (App -> Barrel -> Barrel -> Barrel -> Button)
    *   Logical Hops: 1 (App -> Button)

## Scenario 2: The False Pipe (Prop Driller)
*   **Seed:** \`packages/web/PropDriller.tsx\`
*   **Expected:** 
    *   File should be classified as **LOGIC (Cost 1)**, not PIPE.
    *   Reason: It performs component composition/prop passing, not just re-exporting.

## Scenario 3: The Boundary Paradox
*   **Seed:** \`packages/web/adapter.ts\`
*   **Settings:** Exclude \`packages/legacy/**\`
*   **Expected:**
    *   \`adapter.ts\` is Full Code.
    *   \`packages/legacy/oldTypes.ts\` is EXCLUDED from main pack.
    *   BUT \`LegacyUser\` interface is extracted into the **Boundary Library**.

## Scenario 4: Path Aliases & Monorepo Resolving
*   **Seed:** \`packages/web/App.tsx\`
*   **Expected:** 
    *   Imports using \`@prism/shared-types\` should resolve identical to relative imports.
`,

  // --- PACKAGE: shared-types (The Inheritance Tower) ---
  'packages/shared-types/package.json': `
{
  "name": "@prism/shared-types",
  "main": "inheritance.ts"
}
`,
  'packages/shared-types/inheritance.ts': `
/** @file packages/shared-types/inheritance.ts */
export interface Base { id: string; }
export interface Entity extends Base { createdAt: Date; }
export interface User extends Entity { email: string; }
export interface Admin extends User { role: 'admin'; }
export interface SuperAdmin extends Admin { permissions: string[]; }
`,

  'packages/shared-types/generics.ts': `
/** @file packages/shared-types/generics.ts */
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
`,

  // New: Enums and Namespaces
  'packages/shared-types/enums.ts': `
/** @file packages/shared-types/enums.ts */
export enum Role { 
  Admin = 'ADMIN', 
  User = 'USER',
  Guest = 'GUEST'
}

export namespace API {
  export const BASE_URL = 'https://api.example.com';
  export interface Config { timeout: number; }
}
`,

  'packages/shared-types/config.ts': `
/** @file packages/shared-types/config.ts */
export const CONFIG = { theme: 'dark' };
`,

  // --- PACKAGE: ui-kit (Transit & Pipe Zone) ---
  'packages/ui-kit/package.json': `
{
  "name": "@prism/ui-kit",
  "main": "index.ts"
}
`,
  'packages/ui-kit/index.ts': `
/** @file packages/ui-kit/index.ts */
export * from './components';

// Part 2 Logic Violation: Side Effect
if (typeof window !== 'undefined') {
  console.log('UI Kit Initialized');
}
`,

  // Deep Pipe Stack
  'packages/ui-kit/components/index.ts': `
/** @file packages/ui-kit/components/index.ts */
export * from './buttons';
export * from './Input';
`,
  'packages/ui-kit/components/Input.tsx': `
/** @file packages/ui-kit/components/Input.tsx */
export const Input = () => 'input';
`,
  'packages/ui-kit/components/buttons/index.ts': `
/** @file packages/ui-kit/components/buttons/index.ts */
export * from './core';
`,
  'packages/ui-kit/components/buttons/core/index.ts': `
/** @file packages/ui-kit/components/buttons/core/index.ts */
export { Button } from './Button';
`,
  'packages/ui-kit/components/buttons/core/Button.tsx': `
/** @file packages/ui-kit/components/buttons/core/Button.tsx */
export const Button = () => 'button';
`,

  'packages/ui-kit/button/index.ts': `
/** @file packages/ui-kit/button/index.ts */
export { Button } from '../components';

// Part 2 Logic Violation: New Definition (Type Narrowing)
import { Button as BaseButton } from '../components';
export type StrictButton = typeof BaseButton & { variant: 'primary' };
`,

  // New: Hybrid Export/Import (Re-export AND use)
  'packages/ui-kit/Hybrid.ts': `
/** @file packages/ui-kit/Hybrid.ts */
// Re-export AND import same symbol
export { Button } from './components';
import { Button } from './components';

// Then use it
export const PrimaryButton = () => Button();
`,

  'packages/ui-kit/ComplexBarrel.ts': `
/** @file packages/ui-kit/ComplexBarrel.ts */
export * from './components';
export { Button as AliasedButton } from './components';
export { default as ThemeProvider } from './index';
export type { StrictButton } from './button/index';
`,

  'packages/ui-kit/placeholder.ts': `
/** @file packages/ui-kit/placeholder.ts */
// TODO: Implement later
export {};
`,

  // --- PACKAGE: legacy (The Sieve & Paradox Zone) ---
  'packages/legacy/oldTypes.ts': `
/** @file packages/legacy/oldTypes.ts */
export interface LegacyUser {
  oldId: number;
  username: string;
}
`,

  // --- PACKAGE: web (The Feature Core) ---
  'packages/web/package.json': `
{
  "name": "@prism/web",
  "dependencies": {
    "@prism/shared-types": "*",
    "@prism/ui-kit": "*"
  }
}
`,
  
  // The Möbius Loop (Circular)
  'packages/web/userService.ts': `
/** @file packages/web/userService.ts */
import { validateUser } from './validator';
export function getUser() { 
  return validateUser({ id: '1' }); 
}
`,
  'packages/web/validator.ts': `
/** @file packages/web/validator.ts */
import { getUser } from './userService';
export function validateUser(u: any) { 
  return u.id ? getUser() : null; 
}
`,

  // Test Files
  'packages/web/userService.spec.ts': `
/** @file packages/web/userService.spec.ts */
import { getUser } from './userService';
test('getUser', () => { expect(getUser()).toBeDefined(); });
`,
  'packages/web/validator.test.tsx': `
/** @file packages/web/validator.test.tsx */
import { validateUser } from './validator';
describe('validator', () => { it('validates', () => {}); });
`,

  // The Identity Scent Chain
  'packages/web/ScentChainA.ts': `
/** @file packages/web/ScentChainA.ts */
import { ScentChainB } from './ScentChainB';
export const ScentChainA = (user: any) => ScentChainB(user);
`,
  'packages/web/ScentChainB.ts': `
/** @file packages/web/ScentChainB.ts */
import { ScentChainC } from './ScentChainC';
export const ScentChainB = (user: any) => {
  const account = user;
  return ScentChainC(account);
};
`,
  'packages/web/ScentChainC.ts': `
/** @file packages/web/ScentChainC.ts */
import { ScentChainD } from './ScentChainD';
export const ScentChainC = (account: any) => {
  const { account: profile } = { account };
  return ScentChainD(profile);
};
`,
  'packages/web/ScentChainD.ts': `
/** @file packages/web/ScentChainD.ts */
export const ScentChainD = (profile: any) => {
  const member = profile;
  console.log(member.name);
};
`,

  // The Async Loader
  'packages/web/Router.tsx': `
/** @file packages/web/Router.tsx */
import React from 'react';
const Dashboard = React.lazy(() => import('./Dashboard'));
export const Router = () => <Dashboard />;
`,
  'packages/web/Dashboard.tsx': `
/** @file packages/web/Dashboard.tsx */
export const Dashboard = () => 'dashboard';
`,

  // False Pipe: Hooks
  'packages/web/FalsePipe.tsx': `
/** @file packages/web/FalsePipe.tsx */
import React, { useEffect } from 'react';
// Looks like a pipe - re-exports Dashboard
export { Dashboard } from './Dashboard';
// But ALSO has logic - hook usage
export const Monitor = () => {
  useEffect(() => {
    console.log('Monitoring');
  }, []);
  return null;
};
`,

  // New: False Pipe: Prop Drilling (React Pattern)
  'packages/web/PropDriller.tsx': `
/** @file packages/web/PropDriller.tsx */
import React from 'react';
import { Dashboard } from './Dashboard';

// Receives props, passes them through. 
// This should be LOGIC (Cost 1), not PIPE (Cost 0).
export const PropDriller = (props: any) => {
  return <Dashboard {...props} />;
};
`,

  // New: Type-Only Imports
  'packages/web/TypeOnly.ts': `
/** @file packages/web/TypeOnly.ts */
import type { User } from '../shared-types/inheritance';
export const processUser = (u: User) => u.email;
`,

  // New: Default and Named Exports Mixed
  'packages/web/DefaultExport.tsx': `
/** @file packages/web/DefaultExport.tsx */
export default function DefaultComponent() {
  return 'default';
}
export const namedExport = 'named';
`,

  // New: Multi Entry Point
  'packages/web/Entry2.tsx': `
/** @file packages/web/Entry2.tsx */
import { Dashboard } from './Dashboard';
export const Entry2 = () => <Dashboard />;
`,

  // New: Comments Only
  'packages/web/TODO.ts': `
/** @file packages/web/TODO.ts */
// TODO: Implement user authentication
// Phase 1: Basic login
// Phase 2: OAuth integration
`,

  // TypeScript Declarations
  'packages/web/@types/globals.d.ts': `
/** @file packages/web/@types/globals.d.ts */
declare global {
  interface Window {
    __APP_CONFIG__: any;
  }
}
export {};
`,

  // Documentation Structure
  'packages/web/docs/architecture/decisions.md': `# ADR 001`,
  'packages/web/docs/api/endpoints.md': `# API Docs`,
  'packages/web/docs/guides/setup.yaml': `steps: []`,

  // The Boundary Paradox
  'packages/web/adapter.ts': `
/** @file packages/web/adapter.ts */
import { LegacyUser } from '../legacy/oldTypes';
export const adapt = (u: LegacyUser) => ({ id: u.oldId });
`,

  // Unusual Paths
  'packages/web/src/features/(auth)/login.tsx': `
/** @file packages/web/src/features/(auth)/login.tsx */
export const Login = () => 'login';
`,

  // Non-TS Artifacts
  'packages/web/data.json': `{ "test": true }`,
  'packages/web/config.yaml': `version: 1`,

  // App Entry (The Seed) - Updated with External Libs and Aliases
  'packages/web/App.tsx': `
/** @file packages/web/App.tsx */
import React from 'react';
import { Button as MuiButton } from '@mui/material';

// Local Relative
import { ScentChainA } from './ScentChainA';
import { getUser } from './userService';

// Monorepo Alias (via tsconfig/package.json)
import { SuperAdmin } from '@prism/shared-types/inheritance';
import { AsyncState } from '@prism/shared-types/generics';

// Relative Barrel
import { AliasedButton } from '../ui-kit/ComplexBarrel';

// New Components
import { PropDriller } from './PropDriller';
import DefaultComponent from './DefaultExport';

export const App = () => {
  const user = getUser();
  return (
    <>
      <MuiButton>External</MuiButton>
      <AliasedButton onClick={() => ScentChainA(user)} />
      <PropDriller />
      <DefaultComponent />
    </>
  );
};
`
};

console.log('--- Generating Hardened Prism Network (v2.1) ---');

// Clean up conflict if exists (File vs Directory)
const componentConflict = path.join(root, 'packages/ui-kit/components.ts');
if (fs.existsSync(componentConflict)) {
  console.log('[Cleanup] Removing legacy components.ts file to allow directory creation');
  fs.unlinkSync(componentConflict);
}

Object.entries(files).forEach(([relPath, content]) => {
  const fullPath = path.join(root, relPath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content.trim());
  console.log(`[Created] ${relPath}`);
});

console.log('--- Setup Complete ---');