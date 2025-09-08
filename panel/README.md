# Status Panel

This directory contains a web panel to display the status of the bots managed by the launcher. It is a **frontend-only** application that fetches data directly from one or more running `launcher.js` instances.

The stack is:
- **Frontend:** React (using Vite and Material-UI)
- **Backend:** The `launcher.js` script itself acts as the API server for each host.

---

## How to Set Up and Use

### 1. Prerequisites

- You need [Node.js](https://nodejs.org/) installed on your machine to run the launcher and the panel's development server.
- You need one or more instances of the `launcher.js` script running on servers accessible from your browser.

### 2. Launcher Setup

For each server where you run the launcher:

1.  **Configure `.env`:** Make sure the root `.env` file for the launcher has a `PORT` variable set (e.g., `PORT=8080`).
2.  **Firewall:** You must open the specified port in your server's firewall so that your browser can connect to it.
3.  **CORS:** The launcher is configured with a permissive `cors` policy (`app.use(cors())`). For production, you may want to restrict this to only allow requests from the domain where you host the panel.
4.  **Run:** Start the launcher with `node launcher.js`.

### 3. Panel Setup

1.  **Configure Hosts:**
    - Open the `panel/public/hosts.json` file.
    - In the `hosts` array, list the full URL for each of your running launcher APIs.
    - **Example `hosts.json`:**
      ```json
      {
        "hosts": [
          "http://192.168.1.10:8080",
          "http://my-server.example.com:8080"
        ]
      }
      ```

2.  **Install Dependencies:**
    From within the `panel/` directory, run:
    ```sh
    npm install
    ```

3.  **Run in Development Mode:**
    From within the `panel/` directory, run:
    ```sh
    npm run dev
    ```
    This will start the local development server (usually on port 5173) and you can open the URL in your browser. It will connect to the launcher instances defined in `hosts.json`.

### 4. Deployment

The panel is a static site. You can deploy it to any static hosting service, such as Cloudflare Pages, Vercel, or Netlify.

1.  **Build the Site:**
    From within the `panel/` directory, run:
    ```sh
    npm run build
    ```
    This will create a `dist/` directory containing the optimized, static frontend assets.

2.  **Deploy:**
    Upload the contents of the `dist/` folder to your chosen static hosting provider.
