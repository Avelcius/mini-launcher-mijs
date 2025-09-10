const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // Render provides the PORT env var

// --- In-Memory Storage ---
// This object will store the latest status for each host.
// The key is the hostId, the value is the array of bot objects.
const hostsStatus = {};
// We'll store the timestamp of the last heartbeat from the frontend.
let lastHeartbeat = 0;

// --- Middleware ---
app.use(cors());
app.use(express.json());


// --- API Endpoints ---

// The panel frontend sends a heartbeat to this endpoint periodically
app.post('/api/heartbeat', (req, res) => {
  lastHeartbeat = Date.now();
  console.log('Heartbeat received.');
  res.status(200).json({ success: true });
});

// The launcher sends its status to this endpoint
app.post('/api/status', (req, res) => {
  const { hostId, bots } = req.body;

  if (!hostId || !Array.isArray(bots)) {
    return res.status(400).json({ error: 'Invalid payload structure' });
  }

  // Store the received status data
  hostsStatus[hostId] = {
    bots,
    lastUpdate: Date.now(),
  };
  console.log(`Received status from ${hostId} with ${bots.length} bots.`);

  // Check if the frontend is active
  const isPanelActive = (Date.now() - lastHeartbeat) < 20000; // 20-second threshold

  if (isPanelActive) {
    // If active, tell the launcher to continue polling quickly
    res.json({ action: 'poll' });
  } else {
    // If inactive, tell the launcher to go to sleep
    console.log(`Panel inactive. Telling host ${hostId} to sleep.`);
    res.json({ action: 'sleep', duration: 300 }); // Sleep for 300 seconds (5 minutes)
  }
});

// The panel frontend gets the aggregated status from this endpoint
app.get('/api/status', (req, res) => {
  const allBots = [];
  const now = Date.now();

  // Garbage collect hosts that haven't updated in a while (e.g., 10 minutes)
  for (const hostId in hostsStatus) {
    if (now - hostsStatus[hostId].lastUpdate > 600000) {
      console.log(`Host ${hostId} is stale, removing.`);
      delete hostsStatus[hostId];
    }
  }

  // Aggregate bots from all active hosts
  for (const hostId in hostsStatus) {
    const hostData = hostsStatus[hostId];
    const botsWithHost = hostData.bots.map(bot => ({
      ...bot,
      hostId: hostId,
    }));
    allBots.push(...botsWithHost);
  }

  res.json(allBots);
});


// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Central backend server listening on port ${PORT}`);
});
