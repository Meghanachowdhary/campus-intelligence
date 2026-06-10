import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "events-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// In-memory mock event registry
const events = [
  { id: "EVT001", title: "Next.js & Frontend Architecture Workshop", host: "Google Developer Student Club (GDSC)", date: "2026-06-10", time: "18:00 - 20:00", location: "Science Block Seminar Hall 1", tags: ["tech", "coding", "workshop"], spotsLeft: 12 },
  { id: "EVT002", title: "Hackathon 2026 Orientation", host: "Coding Club", date: "2026-06-11", time: "17:00 - 18:30", location: "Main Auditorium", tags: ["tech", "coding", "competition"], spotsLeft: 150 },
  { id: "EVT003", title: "Annual Spring Art Exhibition", host: "Fine Arts Society", date: "2026-06-12", time: "10:00 - 17:00", location: "Campus Galleria", tags: ["art", "exhibition", "social"], spotsLeft: 80 },
  { id: "EVT004", title: "Resume Building & Interview Prep", host: "Career Development Cell", date: "2026-06-13", time: "14:00 - 16:00", location: "Placement Hall B", tags: ["career", "workshop"], spotsLeft: 45 },
  { id: "EVT005", title: "Inter-College Basketball Finals", host: "Sports Council", date: "2026-06-10", time: "16:00 - 19:00", location: "Indoor Sports Complex", tags: ["sports", "game"], spotsLeft: 200 },
  { id: "EVT006", title: "Introduction to LLMs and MCP Servers", host: "AI & ML Club", date: "2026-06-15", time: "15:00 - 17:00", location: "Block C, Lab 3", tags: ["tech", "ai", "workshop"], spotsLeft: 5 }
];

const registrations = [];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_events",
        description: "List all upcoming campus events, club workshops, and sports matches.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "search_events",
        description: "Search for campus events by tag or text query.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Tag or search query (e.g., 'coding', 'workshop', 'GDSC')"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "register_for_event",
        description: "Register a student for a specific campus event by event ID.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: { type: "string", description: "The event ID (e.g. 'EVT001')" },
            studentEmail: { type: "string", description: "The student's official email address" }
          },
          required: ["eventId", "studentEmail"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_events") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events, null, 2)
          }
        ]
      };
    } else if (name === "search_events") {
      const query = (args.query || "").toLowerCase();
      const results = events.filter(
        e =>
          e.title.toLowerCase().includes(query) ||
          e.host.toLowerCase().includes(query) ||
          e.tags.some(t => t.toLowerCase() === query)
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2)
          }
        ]
      };
    } else if (name === "register_for_event") {
      const eventId = args.eventId.toUpperCase();
      const studentEmail = args.studentEmail;
      const event = events.find(e => e.id === eventId);

      if (!event) {
        return {
          content: [{ type: "text", text: `Event with ID ${eventId} not found.` }],
          isError: true
        };
      }

      if (event.spotsLeft <= 0) {
        return {
          content: [{ type: "text", text: `Sorry, the event '${event.title}' is fully booked.` }],
          isError: true
        };
      }

      // Record registration
      registrations.push({ eventId, studentEmail, registeredAt: new Date().toISOString() });
      event.spotsLeft -= 1;

      return {
        content: [
          {
            type: "text",
            text: `Successful Registration! You have registered ${studentEmail} for '${event.title}' on ${event.date} at ${event.time}. Location: ${event.location}.`
          }
        ]
      };
    } else {
      throw new Error(`Tool ${name} not found`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: error.message }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Events MCP Server running...");
}

main().catch((err) => {
  console.error("Fatal error in Events MCP Server:", err);
  process.exit(1);
});
