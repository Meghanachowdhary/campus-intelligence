# Unified Campus Intelligence Dashboard with AI Assistant

A modern, responsive web application that aggregates scattered campus data (Library, Cafeteria, Events, Academics) in real-time. Instead of querying a giant central database, this project utilizes **Model Context Protocol (MCP)** to query independent source modules live based on the student's request.

---

## 🏗️ Architecture

```mermaid
graph TD
    User([Student]) <--> Frontend[React + Vite Dashboard UI]
    Frontend <--> Gateway[Express API Gateway & MCP Client]
    
    subgraph MCP Servers (Independent stdio child processes)
        Gateway <--> |stdio / JSON-RPC| LibServer[Library MCP Server]
        Gateway <--> |stdio / JSON-RPC| CafeServer[Cafeteria MCP Server]
        Gateway <--> |stdio / JSON-RPC| EventServer[Events MCP Server]
        Gateway <--> |stdio / JSON-RPC| AcadServer[Academics MCP Server]
    end
    
    Gateway <--> |Tool-Calling| LLM[Google Gemini API / Fallback Simulator]
```

- **Frontend**: Single Page React Application built with Vite. It features a dark neon cyber-theme, custom glassmorphism design, real-time widget data, interactive forms, and an AI assistant console.
- **Express Backend Gateway**: Acts as the official **MCP Client**. It dynamically spawns the four MCP servers as subprocesses, registers their tools via the MCP protocol, and exposes clean REST endpoints to the frontend.
- **AI Routing**:
  - **Gemini Mode**: If you provide a Google Gemini API Key, the backend connects to Gemini using standard tool-calling. Gemini dynamically routes queries to one or more MCP servers in real-time.
  - **Local AI Router Simulator**: If no API key is specified, the server runs a high-fidelity semantic keyword router. This local router parses requests, invokes the correct MCP tools, formats responses, and feeds full tool-execution JSON logs to the frontend, allowing for a fully functional offline demo!
- **MCP Servers**: Independent services representing separate data owners, communicating via the Model Context Protocol stdio transport:
  1. **Library**: Exposes book searches, details, and reservations.
  2. **Cafeteria**: Exposes menus, specials, and calorie/allergen lookups.
  3. **Events**: Exposes campus calendars, tags searches, and registration.
  4. **Academics**: Exposes course prerequisites, course details, and handbook policy searches.

---

## 📁 Repository Structure

```
campus-intelligence/
├── package.json                   # Root configuration for monorepo running
├── run.bat                        # Double-click launcher script (Windows)
├── mcp-servers/                   # Folder containing independent MCP servers
│   ├── library/                   # Library MCP Server (Books, status, reservations)
│   │   ├── package.json
│   │   └── index.js
│   ├── cafeteria/                 # Cafeteria MCP Server (Daily menu, specials, nutrition)
│   │   ├── package.json
│   │   └── index.js
│   ├── events/                    # Events MCP Server (Club workshops, activities, calendar)
│   │   ├── package.json
│   │   └── index.js
│   └── academics/                 # Academics MCP Server (Handbook, courses, schedules)
│       ├── package.json
│       └── index.js
├── backend/                       # Express server acting as the MCP client & API gateway
│   ├── package.json
│   ├── index.js                   # Spawns MCP subprocesses, handles Gemini tool-calling
│   ├── test-mcp.js                # Programmatic MCP connection verifier
│   └── .env                       # Environment configuration (Gemini API Key)
└── frontend/                      # React application (Vite-based SPA)
    ├── package.json
    ├── index.html
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── App.css                # Custom premium cyber styling
    │   └── components/
```

---

## 🚀 Getting Started (Step-by-Step)

### 1. Install Node.js
If you don't have Node.js installed on your computer:
1. Go to [https://nodejs.org/](https://nodejs.org/) and download the **LTS** version for Windows.
2. Run the installer and click "Next" through the defaults. Make sure the option to **Add to PATH** is checked.
3. Once the installation completes, close any open command prompts or terminals so the new system PATH takes effect.

### 2. Configure Gemini API Key (Optional)
To use a real LLM with dynamic tool calling:
1. Open [backend/.env](file:///C:/Users/kadiy/.gemini/antigravity/scratch/campus-intelligence/backend/.env) in a text editor.
2. Replace `YOUR_GEMINI_API_KEY` with your actual Google Gemini API key.
3. Save the file.
*(If you leave the API key as default, the gateway will automatically run in local AI Router Simulator mode, which is 100% interactive and requires no setup!)*

### 3. Launch the Application
- **On Windows**: Simply go to the `campus-intelligence` directory and double-click the [run.bat](file:///C:/Users/kadiy/.gemini/antigravity/scratch/campus-intelligence/run.bat) launcher script. It will verify your Node.js installation, automatically install all monorepo dependencies, and start the servers!
- **Alternatively (Manual command)**:
  Open a terminal in the `campus-intelligence` folder and run:
  ```bash
  # Install all dependencies
  npm run install:all
  
  # Start the dev servers
  npm run dev
  ```

Once started:
- The **Backend Gateway** is live at `http://localhost:5001`
- The **React Dashboard UI** will be served at `http://localhost:5173` (Open this in your web browser!)

---

## 🧪 Verifying the MCP Connections
We have included a programmatic test runner. To verify that all 4 MCP servers are compiling correctly, starting up, and communicating via the Model Context Protocol stdio transport:
1. Open a terminal in the `campus-intelligence` directory.
2. Run:
   ```bash
   node backend/test-mcp.js
   ```
This script will spawn the servers, request their tools, invoke a sample command on each, and output a success report!
