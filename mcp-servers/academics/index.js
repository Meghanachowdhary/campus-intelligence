import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "academics-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Course Catalog
const courses = {
  "CS101": { id: "CS101", title: "Introduction to Computer Science", credits: 3, instructor: "Dr. Alice Vance", prerequisites: [], description: "Fundamental concepts of programming, algorithms, and computational thinking using Python." },
  "CS201": { id: "CS201", title: "Data Structures and Algorithms", credits: 4, instructor: "Dr. Bob Chen", prerequisites: ["CS101"], description: "Abstract data structures (stacks, queues, trees, graphs) and algorithm design/analysis." },
  "CS301": { id: "CS301", title: "Web Application Development", credits: 3, instructor: "Prof. Sarah Jenkins", prerequisites: ["CS201"], description: "Modern web technology stacks, client-server architectures, and frontend-backend development." },
  "CS401": { id: "CS401", title: "Artificial Intelligence", credits: 4, instructor: "Dr. David Vance", prerequisites: ["CS201"], description: "Search, heuristics, machine learning, neural networks, and applications of modern AI models." },
  "MATH150": { id: "MATH150", title: "Calculus I", credits: 4, instructor: "Prof. Robert Stark", prerequisites: [], description: "Limits, derivatives, integrals, and their applications in science and engineering." },
  "MATH220": { id: "MATH220", title: "Linear Algebra", credits: 3, instructor: "Prof. Robert Stark", prerequisites: ["MATH150"], description: "Vector spaces, matrices, linear transformations, eigenvalues, and eigenvectors." }
};

// Academic Handbook Policies
const handbook = [
  { topic: "Attendance Policy", summary: "Students are expected to attend all classes. A minimum of 75% attendance is required to sit for the final examinations. Absences due to medical emergencies must be certified by the Campus Health Center." },
  { topic: "Graduation Requirements", summary: "To graduate with a Bachelor of Science in Computer Science, students must complete 120 total credits, including 60 credits of core CS courses, maintain a minimum cumulative GPA of 2.0, and complete a Capstone Project." },
  { topic: "Grading Scale", summary: "Courses are graded on a 4.0 scale: A (4.0, 90-100%), B (3.0, 80-89%), C (2.0, 70-79%), D (1.0, 60-69%), F (0.0, <60%). Plusses (+) and minuses (-) adjust values by 0.3 grade points." },
  { topic: "Academic Integrity", summary: "Plagiarism, cheating, and unauthorized collaboration are strictly prohibited. First offences result in a zero for the assignment and reporting to the Academic Dean. Repeated offences may lead to suspension or expulsion." },
  { topic: "Add/Drop Deadline", summary: "Students can add or drop courses without penalty during the first 14 calendar days of the semester. Drops after the 14th day and before the 8th week will receive a grade of 'W' (Withdrawn)." }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_course_details",
        description: "Fetch details, credits, instructor, and prerequisites of a course by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            courseId: { type: "string", description: "The course ID (e.g. 'CS201', 'MATH150')" }
          },
          required: ["courseId"]
        }
      },
      {
        name: "search_handbook",
        description: "Search the academic handbook for university policies, graduation requirements, deadlines, or grading systems.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (e.g. 'attendance', 'credits to graduate', 'grading scale')" }
          },
          required: ["query"]
        }
      },
      {
        name: "check_prerequisites",
        description: "Check if a student meets the prerequisites for a specific course.",
        inputSchema: {
          type: "object",
          properties: {
            courseId: { type: "string", description: "The target course ID they want to take" },
            studentPassedCourses: {
              type: "array",
              items: { type: "string" },
              description: "List of course IDs the student has already completed successfully (e.g. ['CS101', 'MATH150'])"
            }
          },
          required: ["courseId", "studentPassedCourses"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_course_details") {
      const courseId = args.courseId.toUpperCase();
      const course = courses[courseId];

      if (!course) {
        return {
          content: [{ type: "text", text: `Course with ID ${courseId} not found in the academics catalog.` }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(course, null, 2)
          }
        ]
      };
    } else if (name === "search_handbook") {
      const query = (args.query || "").toLowerCase();
      const results = handbook.filter(
        h =>
          h.topic.toLowerCase().includes(query) ||
          h.summary.toLowerCase().includes(query)
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2)
          }
        ]
      };
    } else if (name === "check_prerequisites") {
      const courseId = args.courseId.toUpperCase();
      const studentPassed = (args.studentPassedCourses || []).map(c => c.toUpperCase());
      const course = courses[courseId];

      if (!course) {
        return {
          content: [{ type: "text", text: `Course with ID ${courseId} not found.` }],
          isError: true
        };
      }

      const missing = course.prerequisites.filter(prereq => !studentPassed.includes(prereq));

      const eligible = missing.length === 0;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              courseId: course.id,
              title: course.title,
              prerequisitesRequired: course.prerequisites,
              studentPassed,
              eligible,
              missingPrerequisites: missing
            }, null, 2)
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
  console.error("Academics MCP Server running...");
}

main().catch((err) => {
  console.error("Fatal error in Academics MCP Server:", err);
  process.exit(1);
});
