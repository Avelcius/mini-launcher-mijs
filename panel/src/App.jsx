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
} from '@mui/material';

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

    fetchData(); // Fetch immediately on component mount
    const interval = setInterval(fetchData, 5000); // Fetch every 5 seconds

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  return (
    <>
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
                  <TableRow key={bot.name}>
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
                  <TableCell colSpan={6} align="center">
                    No bot data available. Waiting for launcher...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </>
  );
}

export default App;
