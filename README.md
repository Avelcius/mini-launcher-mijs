# Multi-Host Bot Launcher & Status Panel

This project contains a system for launching and monitoring Node.js bots across multiple servers. It consists of three main components:

1.  **Launcher (root directory):** The `launcher.js` script is responsible for running, monitoring, and auto-restarting bot processes defined in `start.txt`. It collects detailed status information (CPU, memory, uptime, etc.) for each bot.

2.  **Backend (`/backend`):** A central Node.js/Express server designed to be deployed on a service like [Render](https://render.com/). It receives status updates from all running launcher instances and serves the aggregated data to the frontend panel. It also includes a "sleep signal" mechanism to tell launchers to reduce their update frequency when no one is viewing the panel, saving resources.

3.  **Panel (`/panel`):** A React-based single-page application that provides a web interface for viewing the status of all bots from all hosts in a single table. It is designed to be deployed to a static hosting service like Cloudflare Pages or Render Static Sites.

## Architecture Overview

```
+----------------+      +------------------+      +-----------------+
| Launcher Host 1|      |                  |      |                 |
| (launcher.js)  |----->| Central Backend  |      |  User's Browser |
+----------------+      | (on Render)      |<-----|  (Panel)        |
                        | (Express API)    |      |                 |
+----------------+      |                  |      +-----------------+
| Launcher Host 2|----->|                  |
| (launcher.js)  |      +------------------+
+----------------+
```

-   The **Panel** sends a periodic "heartbeat" to the **Backend** to signal that a user is active.
-   The **Launchers** periodically send their status to the **Backend**.
-   The **Backend** checks for a recent heartbeat. If no one is active, it tells the launchers to "sleep" (i.e., send updates less frequently).
-   The **Panel** fetches the latest aggregated data from the **Backend** to display to the user.

See the `README.md` file in each component's directory for specific setup and deployment instructions.
