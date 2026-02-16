/** @file packages/web/PropDriller.tsx */
import React from 'react';
import { Dashboard } from './Dashboard';

// Receives props, passes them through. 
// This should be LOGIC (Cost 1), not PIPE (Cost 0).
export const PropDriller = (props: any) => {
  return <Dashboard {...props} />;
};