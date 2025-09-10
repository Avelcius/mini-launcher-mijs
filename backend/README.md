# Central Status Backend

This is a simple Node.js/Express server designed to act as a central API for the bot launcher and status panel.

## Functionality

- **Receives Status:** It accepts `POST` requests from multiple `launcher.js` instances, containing the status of their managed bots.
- **Stores Status:** It stores the latest status for each host in memory.
- **Serves Status:** It serves the aggregated status of all bots from all hosts to the panel frontend on a `GET` request.
- **"Sleep Signal" Logic:** It tracks whether a user is actively viewing the panel via a heartbeat mechanism. If no one is viewing the panel, it instructs launchers to "sleep" (stop sending frequent updates) to save resources.

## Endpoints

- `POST /api/heartbeat`: The panel frontend sends a request here every 10 seconds to signal it's active.
- `POST /api/status`: The launcher sends bot status updates here. The response tells the launcher whether to continue polling or to sleep.
- `GET /api/status`: The panel frontend fetches aggregated bot data from this endpoint.

## Deployment on Render

This server is designed to be deployed as a **Web Service** on [Render](https://render.com/).

1.  Create a new "Web Service" on Render and connect it to your GitHub repository.
2.  **Environment:** Choose "Node".
3.  **Build Command:** `npm install`
4.  **Start Command:** `npm start` (or `node server.js`)

Render will automatically detect the `package.json` and use the start command. It will also assign a public `https://*.onrender.com` URL to the service. This URL is what you will use for the `API_URL` in the launcher's `.env` file and the `VITE_API_URL` in the panel's `.env` file.
