# Status Panel

This directory contains a web panel to display the status of the bots managed by the launcher. It's a full-stack application designed to be deployed on Cloudflare.

The stack is:
- **Backend:** Cloudflare Worker (using Hono)
- **Frontend:** React (using Vite and Material-UI)
- **Storage:** Cloudflare KV

---

## How to Set Up and Deploy

### 1. Prerequisites

- You need [Node.js](https://nodejs.org/) installed on your machine.
- You need a [Cloudflare account](https://dash.cloudflare.com/sign-up).
- You need to have the Cloudflare CLI, `wrangler`, installed and configured. If you don't have it, run `npm install -g wrangler` and then `wrangler login`.

### 2. Backend Setup: Create KV Namespace

The backend worker uses Cloudflare's KV store to save the latest status received from the launcher.

1.  **Create a KV Namespace:** In your terminal, run the following command. Give your namespace a descriptive name.
    ```sh
    wrangler kv:namespace create "STATUS_KV"
    ```
2.  **Update `wrangler.toml`:** The command above will output something like this:
    ```
    🌀 Creating namespace "STATUS_KV"
    ✨ Success!
    Add the following to your wrangler.toml:
    [[kv_namespaces]]
    binding = "STATUS_KV"
    id = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
    ```
    Copy the `[[kv_namespaces]]` block and paste it into your `panel/wrangler.toml` file, replacing the placeholder that's already there. You'll also need a `preview_id` for local development, which you can get by running `wrangler kv:namespace create "STATUS_KV" --preview`.

### 3. Local Development

To run both the frontend and backend locally for testing, you need to run two commands in two separate terminals from the `panel/` directory.

- **Terminal 1: Start the Backend Worker**
  ```sh
  cd panel
  wrangler dev
  ```
  This will start the worker, typically on port `8787`.

- **Terminal 2: Start the Frontend Dev Server**
  ```sh
  cd panel
  npm run dev # This is a standard Vite command, we need to add it to package.json
  ```
  This will start the React app, typically on port `5173`. The `vite.config.js` is already configured to proxy API requests to the worker on port `8787`.

*Note: I will add the `dev` script to `package.json` as part of this process.*

### 4. Deployment

1.  **Deploy the Worker:**
    From the `panel/` directory, run:
    ```sh
    wrangler deploy
    ```
    This will deploy your worker to a `*.workers.dev` subdomain. Note the URL of your deployed worker.

2.  **Configure the Launcher:**
    - Open the root `.env` file for the launcher.
    - Set `API_URL` to the URL of your deployed worker, making sure to append the `/api/status` path.
    - Example: `API_URL=https://status-panel-worker.your-username.workers.dev/api/status`

3.  **Build the Frontend:**
    From the `panel/` directory, run:
    ```sh
    npm run build # This is a standard Vite command, we need to add it to package.json
    ```
    This will create a `dist/` directory containing the optimized, static frontend assets.

4.  **Deploy the Frontend to Cloudflare Pages:**
    - Go to your Cloudflare dashboard.
    - Navigate to Workers & Pages -> Create application -> Pages -> Upload assets.
    - Drag and drop the `dist/` folder into the upload box.
    - Deploy the site.

---

After these steps, your launcher will send data to your live worker, and your live Pages site will display that data.
