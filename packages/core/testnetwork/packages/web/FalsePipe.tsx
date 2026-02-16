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