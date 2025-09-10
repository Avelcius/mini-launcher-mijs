# Status Panel Frontend

This directory contains the React-based frontend for the status panel. It is a static site designed to be deployed to a service like Cloudflare Pages or Render Static Sites.

## Functionality

- **Displays Status:** It fetches aggregated bot status data from a central backend API and displays it in a table.
- **Near Real-time:** It polls the backend every 5 seconds for fresh data.
- **Heartbeat:** It sends a "heartbeat" signal to the backend every 10 seconds to let the backend know that a user is actively viewing the page. This allows the backend to tell the launchers to save resources when no one is watching.
- **Theming:** It uses Material-UI with a custom pastel lilac theme.

## Configuration

The panel needs to know the URL of your deployed central backend server.

1.  Create a `.env` file in this `panel/` directory (e.g., by copying `.env.example` if it exists).
2.  In the `.env` file, set the `VITE_API_URL` variable:
    ```
    VITE_API_URL=https://your-backend-service.onrender.com
    ```
    The `VITE_` prefix is important for the Vite build tool to expose the variable to the frontend code.

## Local Development

1.  **Run the Backend:** First, make sure your central backend server is running locally (e.g., `cd ../backend && npm start`).
2.  **Install Dependencies:** From within this `panel/` directory, run:
    ```sh
    npm install
    ```
3.  **Run Dev Server:**
    ```sh
    npm run dev
    ```
    This will start the local development server (usually on port 5173). It will connect to the backend API specified in your `panel/.env` file.

## Deployment

The panel is a static site. You can deploy it to any static hosting service.

1.  **Build the Site:**
    From within the `panel/` directory, run:
    ```sh
    npm run build
    ```
    This will create a `dist/` directory containing the optimized frontend assets.

2.  **Deploy:**
    Upload the contents of the `dist/` folder to your chosen static hosting provider (e.g., Cloudflare Pages, Render Static Sites, Vercel, Netlify). You will need to configure your provider to set the `VITE_API_URL` environment variable during the build process.
