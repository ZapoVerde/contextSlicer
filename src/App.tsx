import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme/theme';
import ContextSlicerScreen from './features/context-slicer/ContextSlicerScreen';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ContextSlicerScreen />
    </ThemeProvider>
  );
};

export default App;