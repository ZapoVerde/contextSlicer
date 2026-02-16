/** @file packages/ui-kit/button/index.ts */
export { Button } from '../components';

// Part 2 Logic Violation: New Definition (Type Narrowing)
import { Button as BaseButton } from '../components';
export type StrictButton = typeof BaseButton & { variant: 'primary' };