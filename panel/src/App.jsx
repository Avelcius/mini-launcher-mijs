import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Link,
  Typography,
  CssBaseline,
  Container,
  ThemeProvider,
  createTheme,
} from '@mui/material';

// Create a custom pastel lilac theme
const lilacTheme = createTheme({
  palette: {
    primary: {
      main: '#C8A2C8', // Pastel Lilac
    },
    secondary: {
      main: '#E6E6FA', // Lavender
    },
    background: {
      default: '#F8F8FF', // Ghost White
    },
  },
  components: {
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#E6E6FA', // Use a light lavender for the table header
        },
      },
    },
  },
});

// Helper function to format uptime from seconds to a human-readable string
const formatUptime = (seconds) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

// Helper function to determine chip color based on status
const getStatusChipColor = (status) => {
  switch (status) {
    case 'running':
      return 'success';
    case 'restarting':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

function App() {
  const [bots, setBots] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setBots(data);
        setError(null);
      } catch (e) {
        console.error("Failed to fetch bot status:", e);
        setError('Failed to load data. Is the backend worker running?');
      }
    };

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/heartbeat', { method: 'POST' });
      } catch (e) {
        console.error("Failed to send heartbeat:", e);
      }
    };

    fetchData();
    sendHeartbeat();

    const dataInterval = setInterval(fetchData, 5000);
    const heartbeatInterval = setInterval(sendHeartbeat, 10000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(heartbeatInterval);
    };
  }, []);

  return (
    <ThemeProvider theme={lilacTheme}>
      <CssBaseline />
      <Container style={{ marginTop: '2rem' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Bot Status Panel
        </Typography>
        {error && <Typography color="error">{error}</Typography>}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Host</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>CPU</TableCell>
                <TableCell>Memory (MB)</TableCell>
                <TableCell>Uptime</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bots.length > 0 ? (
                bots.map((bot) => (
                  <TableRow key={`${bot.hostId}-${bot.name}`}>
                    <TableCell>{bot.hostId}</TableCell>
                    <TableCell>{bot.name}</TableCell>
                    <TableCell>
                      {bot.username ? (
                        <Link href={`https://t.me/${bot.username}`} target="_blank" rel="noopener">
                          @{bot.username}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={bot.status} color={getStatusChipColor(bot.status)} size="small" />
                    </TableCell>
                    <TableCell>{bot.cpu ? bot.cpu.toFixed(2) : '0.00'}%</TableCell>
                    <TableCell>{bot.memory ? (bot.memory / 1024 / 1024).toFixed(2) : '0.00'}</TableCell>
                    <TableCell>{formatUptime(bot.uptime)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No bot data available. Waiting for launcher...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </ThemeProvider>
  );
}

export default App;
