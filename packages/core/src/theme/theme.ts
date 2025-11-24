import { createTheme } from '@mui/material/styles';

// Create a basic dark theme to get the application running.
export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});
