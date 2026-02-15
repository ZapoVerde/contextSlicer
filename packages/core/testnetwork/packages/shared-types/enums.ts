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