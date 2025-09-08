import { Hono } from 'hono';
import { cors } from 'hono/cors';

// The "Bindings" generic type is used to type the `c.env` object.
// STATUS_KV will be the binding to our KV namespace.
const app = new Hono();

// We need CORS so the frontend (on a different domain) can call the API
app.use('/api/*', cors());

// Endpoint for the frontend to signal that it is active
app.post('/api/heartbeat', async (c) => {
  try {
    // Set a key that expires in 20 seconds.
    // The frontend will send a heartbeat every 10 seconds to keep this key alive.
    await STATUS_KV.put('frontend_active', 'true', { expirationTtl: 20 });
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, message: 'Failed to set heartbeat', error: error.message }, 500);
  }
});

// Endpoint for the launcher to check if it should send data
app.get('/api/should_send_status', async (c) => {
  try {
    const isActive = await STATUS_KV.get('frontend_active');
    return c.json({ shouldSend: !!isActive });
  } catch (error) {
    // In case of error, default to not sending to be safe.
    return c.json({ shouldSend: false, error: error.message }, 500);
  }
});

// Endpoint for the launcher to post status updates
app.post('/api/status', async (c) => {
  try {
    const { hostId, bots } = await c.req.json();

    if (!hostId || !Array.isArray(bots)) {
      return c.json({ success: false, message: 'Invalid payload structure. Expected { hostId, bots }.' }, 400);
    }

    // We store the bot list as a JSON string in KV under a key specific to the host.
    // We also set a TTL (Time To Live) of 60 seconds. If a host stops sending updates,
    // its data will automatically expire and disappear from the panel.
    await STATUS_KV.put(`status_${hostId}`, JSON.stringify(bots), { expirationTtl: 60 });

    return c.json({ success: true, message: `Status updated for host: ${hostId}` });
  } catch (error) {
    return c.json({ success: false, message: 'Failed to update status', error: error.message }, 500);
  }
});

// Endpoint for the frontend to get the latest status from all hosts
app.get('/api/status', async (c) => {
  try {
    // List all keys that start with "status_"
    const list = await STATUS_KV.list({ prefix: 'status_' });

    const allBots = [];

    for (const key of list.keys) {
      const hostId = key.name.replace('status_', '');
      const botsJsonString = await STATUS_KV.get(key.name);

      if (botsJsonString) {
        const bots = JSON.parse(botsJsonString);
        // Add the hostId to each bot object so the frontend knows where it came from
        const botsWithHost = bots.map(bot => ({ ...bot, hostId }));
        allBots.push(...botsWithHost);
      }
    }

    return c.json(allBots);
  } catch (error) {
    return c.json({ success: false, message: 'Failed to retrieve status', error: error.message }, 500);
  }
});

export default app;
