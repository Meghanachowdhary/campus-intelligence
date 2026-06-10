import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Define servers configurations
const serversConfig = {
  library: {
    name: "library-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/library/index.js"),
    client: null,
    transport: null,
    status: "Offline",
    error: null,
    tools: []
  },
  cafeteria: {
    name: "cafeteria-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/cafeteria/index.js"),
    client: null,
    transport: null,
    status: "Offline",
    error: null,
    tools: []
  },
  events: {
    name: "events-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/events/index.js"),
    client: null,
    transport: null,
    status: "Offline",
    error: null,
    tools: []
  },
  academics: {
    name: "academics-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/academics/index.js"),
    client: null,
    transport: null,
    status: "Offline",
    error: null,
    tools: []
  }
};

// Initialize and connect to all MCP servers
async function connectToMcpServer(key) {
  const config = serversConfig[key];
  console.log(`Connecting to ${config.name} at ${config.path}...`);

  try {
    const transport = new StdioClientTransport({
      command: "node",
      args: [config.path]
    });

    const client = new Client(
      {
        name: `gateway-client-to-${key}`,
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    await client.connect(transport);
    
    // Retrieve list of tools
    const response = await client.listTools();
    
    config.client = client;
    config.transport = transport;
    config.status = "Online";
    config.error = null;
    config.tools = response.tools || [];
    
    console.log(`Successfully connected to ${config.name}. Exposed tools: ${config.tools.map(t => t.name).join(", ")}`);
  } catch (err) {
    config.status = "Error";
    config.error = err.message;
    console.error(`Failed to connect to ${config.name}:`, err);
  }
}

async function initAllMcpServers() {
  for (const key of Object.keys(serversConfig)) {
    await connectToMcpServer(key);
  }
}

// REST Endpoint to fetch server statuses and tools
app.get("/api/servers", (req, res) => {
  const statusSummary = {};
  for (const [key, config] of Object.entries(serversConfig)) {
    statusSummary[key] = {
      name: config.name,
      status: config.status,
      error: config.error,
      tools: config.tools,
      path: config.path
    };
  }
  res.json(statusSummary);
});

// REST Endpoint to restart an MCP server process
app.post("/api/servers/:key/restart", async (req, res) => {
  const { key } = req.params;
  if (!serversConfig[key]) {
    return res.status(404).json({ error: `Server config '${key}' not found.` });
  }

  // Close existing connections if any
  try {
    if (serversConfig[key].transport) {
      await serversConfig[key].transport.close();
    }
  } catch (e) {
    console.error(`Error closing transport for ${key}:`, e);
  }

  serversConfig[key].status = "Offline";
  await connectToMcpServer(key);
  res.json({ message: `Restarted ${key} server`, status: serversConfig[key].status });
});

// REST Endpoint to retrieve dashboard statistics widgets
app.get("/api/dashboard", async (req, res) => {
  const dashboard = {
    library: { bookCount: 0, checkedOutCount: 0, sampleBooks: [] },
    cafeteria: { specials: [], diningHalls: ["north-hall", "south-hall", "quad-commons"] },
    events: { upcomingCount: 0, highlightedEvent: null },
    academics: { courseCount: 6, requirements: "120 credits total" }
  };

  // 1. Fetch Cafeteria specials
  if (serversConfig.cafeteria.status === "Online") {
    try {
      const response = await serversConfig.cafeteria.client.callTool({
        name: "get_specials",
        arguments: {}
      });
      dashboard.cafeteria.specials = JSON.parse(response.content[0].text);
    } catch (e) {
      console.error("Dashboard error fetching cafeteria specials:", e);
    }
  }

  // 2. Fetch Events
  if (serversConfig.events.status === "Online") {
    try {
      const response = await serversConfig.events.client.callTool({
        name: "list_events",
        arguments: {}
      });
      const eventsList = JSON.parse(response.content[0].text);
      dashboard.events.upcomingCount = eventsList.length;
      dashboard.events.highlightedEvent = eventsList[0] || null;
    } catch (e) {
      console.error("Dashboard error fetching events:", e);
    }
  }

  // 3. Fetch Library sample
  if (serversConfig.library.status === "Online") {
    try {
      const response = await serversConfig.library.client.callTool({
        name: "search_books",
        arguments: { query: "" }
      });
      const booksList = JSON.parse(response.content[0].text);
      dashboard.library.bookCount = booksList.length;
      dashboard.library.checkedOutCount = booksList.filter(b => b.status === "Checked Out").length;
      dashboard.library.sampleBooks = booksList.slice(0, 3);
    } catch (e) {
      console.error("Dashboard error fetching library stats:", e);
    }
  }

  res.json(dashboard);
});

// Helper: Call a tool on a specific server
async function invokeMcpTool(serverKey, toolName, args) {
  const config = serversConfig[serverKey];
  if (config.status !== "Online") {
    throw new Error(`MCP server '${serverKey}' is offline.`);
  }
  console.log(`Executing tool '${toolName}' on '${serverKey}' server with args:`, args);
  const response = await config.client.callTool({
    name: toolName,
    arguments: args
  });
  return response;
}

// AI Router Simulator (Fallback)
async function runAiRouterSimulator(prompt, personalization) {
  const promptLower = prompt.toLowerCase();
  const logs = [];
  let answer = "";
  
  const studentName = personalization?.name || "Student";
  const studentPassed = personalization?.passedCourses || ["CS101", "MATH150"];
  const studentDiet = personalization?.diet || "";

  // Helper to append log
  const logCall = (server, tool, args, result) => {
    logs.push({
      server,
      tool,
      arguments: args,
      resultText: typeof result === "string" ? result : JSON.stringify(result, null, 2)
    });
  };

  // Cafeteria Branch
  if (
    promptLower.includes("menu") ||
    promptLower.includes("lunch") ||
    promptLower.includes("dinner") ||
    promptLower.includes("breakfast") ||
    promptLower.includes("eat") ||
    promptLower.includes("food") ||
    promptLower.includes("special") ||
    promptLower.includes("cafeteria") ||
    promptLower.includes("dining") ||
    promptLower.includes("calories") ||
    promptLower.includes("allergen")
  ) {
    if (promptLower.includes("special")) {
      const res = await invokeMcpTool("cafeteria", "get_specials", {});
      const data = JSON.parse(res.content[0].text);
      logCall("cafeteria", "get_specials", {}, data);

      answer = `### Today's Dining Hall Specials\nHere are the specials available on campus today:\n\n` +
        data.map(s => `- **${s.hall}**: ${s.special}`).join("\n");
    } else if (promptLower.includes("calories") || promptLower.includes("allergen") || promptLower.includes("nutrition") ||
               (promptLower.includes("info") && (promptLower.includes("avocado") || promptLower.includes("salmon") || promptLower.includes("tofu") || promptLower.includes("pizza") || promptLower.includes("chili") || promptLower.includes("egg")))) {
      // Find food item
      let foodItem = "Avocado Toast";
      if (promptLower.includes("salmon")) foodItem = "Baked Salmon";
      else if (promptLower.includes("tofu")) foodItem = "Spicy Tofu Stir Fry";
      else if (promptLower.includes("pizza")) foodItem = "Margherita Pizza Slice";
      else if (promptLower.includes("chili")) foodItem = "Three-Bean Vegan Chili";
      else if (promptLower.includes("egg")) foodItem = "Scrambled Eggs";
      else if (promptLower.includes("pancake")) foodItem = "Buttermilk Pancakes";

      const res = await invokeMcpTool("cafeteria", "get_nutrition_info", { item: foodItem });
      const data = JSON.parse(res.content[0].text);
      logCall("cafeteria", "get_nutrition_info", { item: foodItem }, data);

      answer = `### Nutrition Info: ${data.item}\n` +
        `- **Dining Hall**: ${data.hall}\n` +
        `- **Calories**: ${data.calories} kcal\n` +
        `- **Allergens**: ${data.allergens.join(", ")}\n` +
        `- **Vegetarian**: ${data.isVegetarian ? "✅ Yes" : "❌ No"}\n` +
        `- **Vegan**: ${data.isVegan ? "✅ Yes" : "❌ No"}`;
    } else {
      // Get menu
      let hall = "north-hall";
      if (promptLower.includes("south")) hall = "south-hall";
      else if (promptLower.includes("quad") || promptLower.includes("commons")) hall = "quad-commons";

      const res = await invokeMcpTool("cafeteria", "get_menu", { hall });
      const data = JSON.parse(res.content[0].text);
      logCall("cafeteria", "get_menu", { hall }, data);

      const formatMealList = (meals) => {
        return meals.map(m => {
          let suffix = "";
          if (m.vegan) suffix = " 🌱 (Vegan)";
          else if (m.veg) suffix = " 🥦 (Vegetarian)";
          return `- **${m.item}** (${m.calories} kcal)${suffix}`;
        }).join("\n");
      };

      answer = `### Today's Menu at ${data.hallName}\n` +
        `Here is the menu for **${data.hallName}** today. ` + (studentDiet ? `*(Filtered for: ${studentDiet})*\n\n` : `\n\n`) +
        `#### 🍳 Breakfast\n${formatMealList(data.breakfast)}\n\n` +
        `#### 🍔 Lunch\n${formatMealList(data.lunch)}\n\n` +
        `#### 🍛 Dinner\n${formatMealList(data.dinner)}\n\n` +
        `*Today's Chef Special is: **${menusSimulatorFallback(hall)}***`;
    }
  }
  // Library Branch
  else if (
    promptLower.includes("book") ||
    promptLower.includes("library") ||
    promptLower.includes("read") ||
    promptLower.includes("author") ||
    promptLower.includes("reserve") ||
    promptLower.includes("borrow") ||
    promptLower.includes("catalog")
  ) {
    if (promptLower.includes("reserve") || promptLower.includes("hold")) {
      // Find book ID
      let bookId = "LIB001";
      if (promptLower.includes("clean code") || promptLower.includes("lib003")) bookId = "LIB003";
      else if (promptLower.includes("pattern") || promptLower.includes("lib002")) bookId = "LIB002";
      else if (promptLower.includes("pragmatic") || promptLower.includes("lib005")) bookId = "LIB005";
      else if (promptLower.includes("physics") || promptLower.includes("lib011")) bookId = "LIB011";

      const res = await invokeMcpTool("library", "reserve_book", { bookId, studentName });
      const text = res.content[0].text;
      logCall("library", "reserve_book", { bookId, studentName }, text);
      answer = text;
    } else if (promptLower.includes("available") || promptLower.includes("status") || promptLower.includes("where is")) {
      let bookId = "LIB001";
      if (promptLower.includes("clean code") || promptLower.includes("lib003")) bookId = "LIB003";
      else if (promptLower.includes("pattern") || promptLower.includes("lib002")) bookId = "LIB002";
      else if (promptLower.includes("pragmatic") || promptLower.includes("lib005")) bookId = "LIB005";

      const res = await invokeMcpTool("library", "check_availability", { bookId });
      const data = JSON.parse(res.content[0].text);
      logCall("library", "check_availability", { bookId }, data);

      answer = `### Library Availability Check\n` +
        `- **Title**: ${data.title}\n` +
        `- **Status**: ${data.status === "Available" ? "🟢 Available" : "🔴 Checked Out"}\n` +
        `- **Shelving Location**: ${data.location}\n` +
        (data.dueBack ? `- **Note**: Due back on ${data.dueBack}` : "");
    } else {
      let query = "algorithms";
      if (promptLower.includes("clean code")) query = "Clean Code";
      else if (promptLower.includes("pattern")) query = "Design Patterns";
      else if (promptLower.includes("pragmatic")) query = "Pragmatic";
      else if (promptLower.includes("physics")) query = "Physics";
      else if (promptLower.includes("math") || promptLower.includes("calculus") || promptLower.includes("algebra")) query = "Mathematics";
      else if (promptLower.includes("history")) query = "History";
      else {
        // extract query if possible, or search all
        const match = prompt.match(/(?:search for|find|look up)\s+["']?([^"'\n\r.?!]+)["']?/i);
        if (match) query = match[1];
        else query = "";
      }

      const res = await invokeMcpTool("library", "search_books", { query });
      const data = JSON.parse(res.content[0].text);
      logCall("library", "search_books", { query }, data);

      if (data.length === 0) {
        answer = `### Library Catalog Search\nI couldn't find any books matching **"${query}"** in the campus library.`;
      } else {
        answer = `### Library Catalog: Search Results for "${query}"\nFound ${data.length} book(s):\n\n` +
          data.map(b => `- **${b.title}** by *${b.author}* (ID: \`${b.id}\`)\n` +
            `  - Status: ${b.status === "Available" ? "🟢 Available" : "🔴 Checked Out"}\n` +
            `  - Location: ${b.location}`
          ).join("\n\n");
      }
    }
  }
  // Events Branch
  else if (
    promptLower.includes("event") ||
    promptLower.includes("workshop") ||
    promptLower.includes("club") ||
    promptLower.includes("register") ||
    promptLower.includes("hackathon") ||
    promptLower.includes("basketball") ||
    promptLower.includes("sports") ||
    promptLower.includes("activity") ||
    promptLower.includes("calendar")
  ) {
    if (promptLower.includes("register") || promptLower.includes("signup") || promptLower.includes("sign up")) {
      let eventId = "EVT001";
      if (promptLower.includes("hackathon") || promptLower.includes("evt002")) eventId = "EVT002";
      else if (promptLower.includes("art") || promptLower.includes("evt003")) eventId = "EVT003";
      else if (promptLower.includes("resume") || promptLower.includes("evt004")) eventId = "EVT004";
      else if (promptLower.includes("basketball") || promptLower.includes("evt005")) eventId = "EVT005";
      else if (promptLower.includes("mcp") || promptLower.includes("llm") || promptLower.includes("evt006")) eventId = "EVT006";

      const studentEmail = `${studentName.toLowerCase().replace(/\s+/g, "")}@university.edu`;
      const res = await invokeMcpTool("events", "register_for_event", { eventId, studentEmail });
      const text = res.content[0].text;
      logCall("events", "register_for_event", { eventId, studentEmail }, text);
      answer = text;
    } else if (promptLower.includes("search") || promptLower.includes("find") || promptLower.includes("workshop") || promptLower.includes("coding") || promptLower.includes("art") || promptLower.includes("sports")) {
      let query = "tech";
      if (promptLower.includes("coding") || promptLower.includes("programming") || promptLower.includes("next.js")) query = "coding";
      else if (promptLower.includes("art") || promptLower.includes("exhibition")) query = "art";
      else if (promptLower.includes("sports") || promptLower.includes("basketball")) query = "sports";
      else if (promptLower.includes("career") || promptLower.includes("resume")) query = "career";

      const res = await invokeMcpTool("events", "search_events", { query });
      const data = JSON.parse(res.content[0].text);
      logCall("events", "search_events", { query }, data);

      if (data.length === 0) {
        answer = `### Campus Events Search\nI found no upcoming events tagged with **"${query}"**.`;
      } else {
        answer = `### Upcoming Events Matching "${query}"\n\n` +
          data.map(e => `#### 📅 ${e.title}\n` +
            `- **Hosted by**: ${e.host}\n` +
            `- **Date/Time**: ${e.date} | ${e.time}\n` +
            `- **Location**: ${e.location}\n` +
            `- **Availability**: ${e.spotsLeft} spots left\n` +
            `- **Event ID**: \`${e.id}\` *(Use "register for ${e.id}" to sign up!)*`
          ).join("\n\n");
      }
    } else {
      // List all
      const res = await invokeMcpTool("events", "list_events", {});
      const data = JSON.parse(res.content[0].text);
      logCall("events", "list_events", {}, data);

      answer = `### Campus Activity Calendar\nHere are the upcoming events and club activities scheduled:\n\n` +
        data.map(e => `- **${e.title}** (ID: \`${e.id}\`)\n` +
          `  - *Date*: ${e.date} | *Time*: ${e.time} | *Location*: ${e.location}\n` +
          `  - *Host*: ${e.host} | Spots Left: ${e.spotsLeft}`
        ).join("\n\n");
    }
  }
  // Academics Branch
  else if (
    promptLower.includes("course") ||
    promptLower.includes("class") ||
    promptLower.includes("prereq") ||
    promptLower.includes("handbook") ||
    promptLower.includes("gpa") ||
    promptLower.includes("attendance") ||
    promptLower.includes("grading") ||
    promptLower.includes("policy") ||
    promptLower.includes("credits") ||
    promptLower.includes("graduate") ||
    promptLower.includes("academic") ||
    promptLower.includes("major")
  ) {
    if (promptLower.includes("prereq") || promptLower.includes("eligible") || promptLower.includes("can i take")) {
      let courseId = "CS201";
      if (promptLower.includes("cs301") || promptLower.includes("web")) courseId = "CS301";
      else if (promptLower.includes("cs401") || promptLower.includes("ai") || promptLower.includes("artificial")) courseId = "CS401";
      else if (promptLower.includes("math220") || promptLower.includes("linear")) courseId = "MATH220";

      const res = await invokeMcpTool("academics", "check_prerequisites", {
        courseId,
        studentPassedCourses: studentPassed
      });
      const data = JSON.parse(res.content[0].text);
      logCall("academics", "check_prerequisites", { courseId, studentPassedCourses: studentPassed }, data);

      if (data.eligible) {
        answer = `### 🟢 Prerequisite Verification: Eligible!\n` +
          `You have completed the required prerequisites for **${data.courseId}: ${data.title}**.\n\n` +
          `- **Required**: ${data.prerequisitesRequired.join(", ") || "None"}\n` +
          `- **Your Completed Courses**: ${data.studentPassed.join(", ")}`;
      } else {
        answer = `### 🔴 Prerequisite Verification: Ineligible!\n` +
          `You cannot register for **${data.courseId}: ${data.title}** yet because you are missing prerequisites.\n\n` +
          `- **Missing Prerequisites**: **${data.missingPrerequisites.join(", ")}**\n` +
          `- **Required**: ${data.prerequisitesRequired.join(", ")}\n` +
          `- **Your Completed Courses**: ${data.studentPassed.join(", ")}`;
      }
    } else if (promptLower.includes("attendance") || promptLower.includes("policy") || promptLower.includes("gpa") || promptLower.includes("graduate") || promptLower.includes("grading") || promptLower.includes("deadline") || promptLower.includes("add/drop")) {
      let query = "Attendance";
      if (promptLower.includes("graduate") || promptLower.includes("graduation") || promptLower.includes("credits to graduate")) query = "Graduation";
      else if (promptLower.includes("grading") || promptLower.includes("scale") || promptLower.includes("gpa")) query = "Grading";
      else if (promptLower.includes("cheat") || promptLower.includes("plagiarism") || promptLower.includes("academic integrity")) query = "Integrity";
      else if (promptLower.includes("deadline") || promptLower.includes("drop") || promptLower.includes("add")) query = "Add/Drop";

      const res = await invokeMcpTool("academics", "search_handbook", { query });
      const data = JSON.parse(res.content[0].text);
      logCall("academics", "search_handbook", { query }, data);

      if (data.length === 0) {
        answer = `### Academic Handbook Search\nI found no handbook entries covering **"${query}"**.`;
      } else {
        answer = `### Academic Handbook: ${data[0].topic}\n${data[0].summary}`;
      }
    } else {
      // Course details
      let courseId = "CS101";
      if (promptLower.includes("cs201") || promptLower.includes("data structure") || promptLower.includes("algorithm")) courseId = "CS201";
      else if (promptLower.includes("cs301") || promptLower.includes("web") || promptLower.includes("app")) courseId = "CS301";
      else if (promptLower.includes("cs401") || promptLower.includes("ai") || promptLower.includes("intelligence")) courseId = "CS401";
      else if (promptLower.includes("math150") || promptLower.includes("calculus")) courseId = "MATH150";
      else if (promptLower.includes("math220") || promptLower.includes("linear") || promptLower.includes("algebra")) courseId = "MATH220";

      const res = await invokeMcpTool("academics", "get_course_details", { courseId });
      const data = JSON.parse(res.content[0].text);
      logCall("academics", "get_course_details", { courseId }, data);

      answer = `### Course Details: ${data.id} - ${data.title}\n` +
        `- **Credits**: ${data.credits} CR\n` +
        `- **Instructor**: ${data.instructor}\n` +
        `- **Prerequisites**: ${data.prerequisites.length > 0 ? data.prerequisites.join(", ") : "None"}\n` +
        `- **Course Description**: ${data.description}`;
    }
  }
  // Hybrid/Multi-tool queries (e.g. check food menu AND upcoming workshops tonight)
  else if (
    (promptLower.includes("menu") || promptLower.includes("eat") || promptLower.includes("food")) &&
    (promptLower.includes("event") || promptLower.includes("workshop") || promptLower.includes("club"))
  ) {
    // Call Cafeteria specials
    const resCafeteria = await invokeMcpTool("cafeteria", "get_specials", {});
    const dataCafeteria = JSON.parse(resCafeteria.content[0].text);
    logCall("cafeteria", "get_specials", {}, dataCafeteria);

    // Call Events list
    const resEvents = await invokeMcpTool("events", "list_events", {});
    const dataEvents = JSON.parse(resEvents.content[0].text);
    logCall("events", "list_events", {}, dataEvents);

    answer = `### Multi-Source Report (Dining Specials & Campus Events)\n\n` +
      `#### 🍽️ Today's Dining Specials:\n` +
      dataCafeteria.map(s => `- **${s.hall}**: ${s.special}`).join("\n") + "\n\n" +
      `#### 📅 Upcoming Events on Campus:\n` +
      dataEvents.slice(0, 3).map(e => `- **${e.title}** hosted by *${e.host}* (${e.date} at ${e.time})`).join("\n");
  }
  // Default fallback
  else {
    answer = `Hi **${studentName}**! I'm your Unified Campus AI Assistant. I can dynamically fetch live data from our independent campus servers. Try asking me:
- **Cafeteria**: *"What is on the menu at North Dining Hall today?"* or *"What are today's chef specials?"*
- **Library**: *"Search the catalog for 'Clean Code'"* or *"Is CS Algorithms book available?"*
- **Events**: *"Are there any coding workshops coming up?"* or *"Register me for EVT001"*
- **Academics**: *"What are the prerequisites for AI (CS401)?"* or *"What does the handbook say about attendance policy?"*`;
  }

  return { answer, logs };
}

// Quick simulator function to get chef special
function menusSimulatorFallback(hall) {
  if (hall === "north-hall") return "Baked Salmon with Lemon Dill Sauce";
  if (hall === "south-hall") return "Three-Bean Vegan Chili with Cornbread";
  return "Chicken Tikka Masala with Basmati Rice";
}

// REST Endpoint: Main Chat AI Assistant
app.post("/api/chat", async (req, res) => {
  const { prompt, personalization } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt field in request body." });
  }

  console.log(`Received user prompt: "${prompt}"`);

  // 1. Dual Mode Routing: Check if GEMINI_API_KEY is available and valid
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY") {
    try {
      console.log("Using real Gemini API for tool routing...");
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash"
      });

      // Gather all declarations from all four servers
      const toolDeclarations = [];
      const toolMap = {}; // Maps toolName -> { serverKey, toolDefinition }

      for (const [serverKey, config] of Object.entries(serversConfig)) {
        if (config.status === "Online") {
          for (const mcpTool of config.tools) {
            // Map MCP tool schema to Gemini function declaration
            toolDeclarations.push({
              name: mcpTool.name,
              description: mcpTool.description,
              parameters: mcpTool.inputSchema
            });
            toolMap[mcpTool.name] = { serverKey, mcpTool };
          }
        }
      }

      const chatSession = model.startChat({
        tools: toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations }] : [],
        systemInstruction: `You are the Unified Campus AI Assistant. You have access to tools that query campus systems: Library catalog, Dining menus, Campus Events, and Academic policies.
Always fetch data live using the tools instead of making things up.
When the user asks something that maps to a tool, call the tool.
You may make multiple tool calls if the query requires data from multiple sources (e.g. check the library for a book and check a course prereq).
Format your final response beautifully in clean Markdown.
If a student asks to register for an event, make sure to ask or retrieve their email.
Personalization context: The current student's name is ${personalization?.name || "Student"}, their completed courses are ${JSON.stringify(personalization?.passedCourses || [])}, and their diet is ${personalization?.diet || "None"}. Use this context to prefill tool arguments (e.g., studentName or studentPassedCourses) if needed.`,
      });

      let response = await chatSession.sendMessage(prompt);
      const logs = [];

      // Loop to handle potential multiple function call rounds (Gemini handles function callbacks)
      let functionCalls = response.functionCalls;
      let iterations = 0;
      const maxIterations = 5;

      while (functionCalls && functionCalls.length > 0 && iterations < maxIterations) {
        iterations++;
        const functionResponses = [];

        for (const call of functionCalls) {
          const toolInfo = toolMap[call.name];
          if (!toolInfo) {
            console.error(`Gemini requested unknown tool: ${call.name}`);
            functionResponses.push({
              response: { error: `Tool ${call.name} not found.` }
            });
            continue;
          }

          // Execute tool on the appropriate MCP server
          try {
            const mcpResponse = await invokeMcpTool(
              toolInfo.serverKey,
              call.name,
              call.args
            );

            // Parse response content
            const resultText = mcpResponse.content[0].text;
            let resultData;
            try {
              resultData = JSON.parse(resultText);
            } catch (e) {
              resultData = { message: resultText };
            }

            logs.push({
              server: toolInfo.serverKey,
              tool: call.name,
              arguments: call.args,
              resultText
            });

            functionResponses.push({
              name: call.name,
              response: { result: resultData }
            });
          } catch (err) {
            console.error(`Error executing tool ${call.name} on server ${toolInfo.serverKey}:`, err);
            functionResponses.push({
              name: call.name,
              response: { error: err.message }
            });
          }
        }

        // Send function responses back to the model
        response = await chatSession.sendMessage(functionResponses);
        functionCalls = response.functionCalls;
      }

      return res.json({
        answer: response.text,
        logs: logs
      });
    } catch (apiError) {
      console.error("Error using Gemini API. Falling back to AI Simulator...", apiError);
      // Fallback to simulator
      const result = await runAiRouterSimulator(prompt, personalization);
      return res.json({
        answer: `*(API Routing Error: Falling back to local Simulator mode)*\n\n` + result.answer,
        logs: result.logs
      });
    }
  } else {
    // Run AI Router Simulator
    console.log("No Gemini API Key found. Running local AI Router Simulator...");
    const result = await runAiRouterSimulator(prompt, personalization);
    res.json(result);
  }
});

// Start listening and connect to servers
app.listen(PORT, async () => {
  console.log(`Gateway Express Server listening on http://localhost:${PORT}`);
  await initAllMcpServers();
});
