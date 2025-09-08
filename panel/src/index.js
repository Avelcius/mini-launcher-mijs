import { Hono } from 'hono';
import { cors } from 'hono/cors';

// The "Bindings" generic type is used to type the `c.env` object.
// STATUS_KV will be the binding to our KV namespace.
const app = new Hono();

// We need CORS so the frontend (on a different domain) can call the API
app.use('/api/*', cors());

// Endpoint for the launcher to post status updates
app.post('/api/status', async (c) => {
  try {
    const statusData = await c.req.json();
    // We store the data as a JSON string in KV under the key 'latest_status'
    await STATUS_KV.put('latest_status', JSON.stringify(statusData));
    return c.json({ success: true, message: 'Status updated' });
  } catch (error) {
    return c.json({ success: false, message: 'Failed to update status', error: error.message }, 500);
  }
});

// Endpoint for the frontend to get the latest status
app.get('/api/status', async (c) => {
  try {
    // We retrieve the status string from KV
    const statusDataString = await STATUS_KV.get('latest_status');
    if (statusDataString === null) {
      // If no status has been stored yet, return an empty array
      return c.json([]);
    }
    // We parse the string back into a JSON object before sending
    const statusData = JSON.parse(statusDataString);
    return c.json(statusData);
  } catch (error) {
    return c.json({ success: false, message: 'Failed to retrieve status', error: error.message }, 500);
  }
});

export default app;
