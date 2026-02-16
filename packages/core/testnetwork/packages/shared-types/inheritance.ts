/**
 * @file packages/core/testnetwork/packages/shared-types/inheritance.ts
 * @stamp {"ts":"2026-02-16T06:15:00Z"}
 * @architectural-role Type Definition
 * @description
 * Defines the canonical identity inheritance tower for the Hardened Prism 
 * test network. Updated to include a dependency on config.ts to facilitate 
 * resolution conflict testing where a file is reached via both explicit 
 * wildcard selection and distant dependency tracing.
 *
 * @core-principles
 * 1. IS a structural contract for test network identities.
 * 2. MUST link to config.ts to enable tracing-based resolution conflicts.
 *
 * @api-declaration
 *   export interface Base { id: string; }
 *   export interface Entity extends Base { createdAt: Date; }
 *   export interface User extends Entity { email: string; }
 *   export interface Admin extends User { role: 'admin'; }
 *   export interface SuperAdmin extends Admin { permissions: string[]; }
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { CONFIG } from './config';

/**
 * The root of the identity hierarchy.
 * @internal Used for dependency tracing of CONFIG.
 */
export const _SEED_LINK = CONFIG;

export interface Base {
  /** Unique identifier for the entity. */
  id: string;
}

/**
 * Represents a persistent entity in the system.
 */
export interface Entity extends Base {
  /** ISO 8601 creation timestamp. */
  createdAt: Date;
}

/**
 * Standard user representation.
 */
export interface User extends Entity {
  /** Primary contact email address. */
  email: string;
}

/**
 * User with administrative privileges.
 */
export interface Admin extends User {
  /** Fixed role identifier. */
  role: 'admin';
}

/**
 * Highest level administrative entity.
 */
export interface SuperAdmin extends Admin {
  /** Explicit permission keys granted to the super user. */
  permissions: string[];
}