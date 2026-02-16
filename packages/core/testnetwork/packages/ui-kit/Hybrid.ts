/** @file packages/ui-kit/Hybrid.ts */
// Re-export AND import same symbol
export { Button } from './components';
import { Button } from './components';

// Then use it
export const PrimaryButton = () => Button();