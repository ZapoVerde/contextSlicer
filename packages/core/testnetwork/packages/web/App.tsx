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