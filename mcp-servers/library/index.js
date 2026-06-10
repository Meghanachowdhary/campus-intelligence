import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "library-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// In-memory mock database of library books
const books = [
  { id: "LIB001", title: "Introduction to Algorithms", author: "Thomas H. Cormen", subject: "Computer Science", status: "Available", location: "Floor 3, Shelf A-4", dueBack: null },
  { id: "LIB002", title: "Design Patterns: Elements of Reusable Object-Oriented Software", author: "Erich Gamma", subject: "Computer Science", status: "Checked Out", location: "Floor 2, Shelf B-1", dueBack: "2026-06-15" },
  { id: "LIB003", title: "Clean Code", author: "Robert C. Martin", subject: "Computer Science", status: "Available", location: "Floor 1, Shelf C-2", dueBack: null },
  { id: "LIB004", title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell", subject: "Computer Science", status: "Available", location: "Floor 3, Shelf C-1", dueBack: null },
  { id: "LIB005", title: "The Pragmatic Programmer", author: "Andrew Hunt", subject: "Computer Science", status: "Available", location: "Floor 1, Shelf A-1", dueBack: null },
  { id: "LIB006", title: "Database System Concepts", author: "Abraham Silberschatz", subject: "Computer Science", status: "Checked Out", location: "Floor 2, Shelf D-3", dueBack: "2026-06-20" },
  { id: "LIB007", title: "Computer Networking: A Top-Down Approach", author: "James Kurose", subject: "Computer Science", status: "Available", location: "Floor 3, Shelf E-2", dueBack: null },
  { id: "LIB008", title: "Operating System Concepts", author: "Abraham Silberschatz", subject: "Computer Science", status: "Available", location: "Floor 2, Shelf A-2", dueBack: null },
  { id: "LIB009", title: "Compilers: Principles, Techniques, and Tools", author: "Alfred Aho", subject: "Computer Science", status: "Available", location: "Floor 3, Shelf B-2", dueBack: null },
  { id: "LIB010", title: "A Brief History of Time", author: "Stephen Hawking", subject: "Physics", status: "Available", location: "Floor 4, Shelf A-1", dueBack: null },
  { id: "LIB011", title: "University Physics", author: "Hugh D. Young", subject: "Physics", status: "Checked Out", location: "Floor 4, Shelf B-4", dueBack: "2026-06-12" },
  { id: "LIB012", title: "Calculus", author: "James Stewart", subject: "Mathematics", status: "Available", location: "Floor 4, Shelf C-3", dueBack: null },
  { id: "LIB013", title: "Linear Algebra and Its Applications", author: "David C. Lay", subject: "Mathematics", status: "Available", location: "Floor 4, Shelf C-5", dueBack: null }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_books",
        description: "Search books in the campus library by title, author, or subject.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (e.g. 'algorithms', 'Stephen Hawking', 'Physics')" }
          },
          required: ["query"]
        }
      },
      {
        name: "check_availability",
        description: "Check the current availability and location of a book by its library ID.",
        inputSchema: {
          type: "object",
          properties: {
            bookId: { type: "string", description: "The library book ID (e.g., 'LIB001')" }
          },
          required: ["bookId"]
        }
      },
      {
        name: "reserve_book",
        description: "Place a temporary reservation for a book that is currently available.",
        inputSchema: {
          type: "object",
          properties: {
            bookId: { type: "string", description: "The library book ID (e.g., 'LIB001')" },
            studentName: { type: "string", description: "The name of the student making the reservation" }
          },
          required: ["bookId", "studentName"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_books") {
      const query = (args.query || "").toLowerCase();
      const results = books.filter(
        b =>
          b.title.toLowerCase().includes(query) ||
          b.author.toLowerCase().includes(query) ||
          b.subject.toLowerCase().includes(query)
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2)
          }
        ]
      };
    } else if (name === "check_availability") {
      const bookId = args.bookId.toUpperCase();
      const book = books.find(b => b.id === bookId);

      if (!book) {
        return {
          content: [{ type: "text", text: `Book with ID ${bookId} not found in the library catalog.` }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: book.id,
              title: book.title,
              status: book.status,
              location: book.location,
              dueBack: book.dueBack
            }, null, 2)
          }
        ]
      };
    } else if (name === "reserve_book") {
      const bookId = args.bookId.toUpperCase();
      const studentName = args.studentName;
      const book = books.find(b => b.id === bookId);

      if (!book) {
        return {
          content: [{ type: "text", text: `Book with ID ${bookId} not found.` }],
          isError: true
        };
      }

      if (book.status !== "Available") {
        return {
          content: [{ type: "text", text: `Book '${book.title}' is currently ${book.status} and cannot be reserved.` }],
          isError: true
        };
      }

      // Perform reservation
      book.status = "Reserved";
      book.dueBack = "Reserved by " + studentName;

      return {
        content: [
          {
            type: "text",
            text: `Success! '${book.title}' (ID: ${book.id}) has been reserved for ${studentName}. Please pick it up from ${book.location} within 24 hours.`
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
  console.error("Library MCP Server running...");
}

main().catch((err) => {
  console.error("Fatal error in Library MCP Server:", err);
  process.exit(1);
});
