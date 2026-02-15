/** @file packages/web/Router.tsx */
import React from 'react';
const Dashboard = React.lazy(() => import('./Dashboard'));
export const Router = () => <Dashboard />;