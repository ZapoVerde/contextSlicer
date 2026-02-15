/** @file packages/shared-types/inheritance.ts */
export interface Base { id: string; }
export interface Entity extends Base { createdAt: Date; }
export interface User extends Entity { email: string; }
export interface Admin extends User { role: 'admin'; }
export interface SuperAdmin extends Admin { permissions: string[]; }