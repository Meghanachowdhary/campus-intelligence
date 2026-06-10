import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "cafeteria-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Mock database for Cafeteria
const menus = {
  "north-hall": {
    name: "North Dining Hall",
    breakfast: [
      { item: "Scrambled Eggs", calories: 140, allergens: ["eggs"], veg: true, vegan: false },
      { item: "Vegan Oatmeal", calories: 120, allergens: [], veg: true, vegan: true },
      { item: "Maple Bacon", calories: 180, allergens: [], veg: false, vegan: false }
    ],
    lunch: [
      { item: "Grilled Chicken Breast", calories: 220, allergens: [], veg: false, vegan: false },
      { item: "Quinoa Bowl with Roasted Veggies", calories: 340, allergens: [], veg: true, vegan: true },
      { item: "Classic Caesar Salad", calories: 250, allergens: ["dairy", "wheat", "eggs"], veg: false, vegan: false }
    ],
    dinner: [
      { item: "Baked Salmon", calories: 310, allergens: ["fish"], veg: false, vegan: false },
      { item: "Vegetarian Lasagna", calories: 420, allergens: ["dairy", "wheat"], veg: true, vegan: false },
      { item: "Steamed Broccoli", calories: 50, allergens: [], veg: true, vegan: true }
    ],
    special: "Baked Salmon with Lemon Dill Sauce"
  },
  "south-hall": {
    name: "South Dining Hall",
    breakfast: [
      { item: "Buttermilk Pancakes", calories: 290, allergens: ["dairy", "wheat", "eggs"], veg: true, vegan: false },
      { item: "Turkey Sausage", calories: 120, allergens: [], veg: false, vegan: false },
      { item: "Fresh Fruit Cup", calories: 70, allergens: [], veg: true, vegan: true }
    ],
    lunch: [
      { item: "Spicy Tofu Stir Fry", calories: 280, allergens: ["soy", "wheat"], veg: true, vegan: true },
      { item: "Beef Burger", calories: 520, allergens: ["wheat"], veg: false, vegan: false },
      { item: "Sweet Potato Fries", calories: 180, allergens: [], veg: true, vegan: true }
    ],
    dinner: [
      { item: "BBQ Pulled Pork Sandwich", calories: 480, allergens: ["wheat"], veg: false, vegan: false },
      { item: "Three-Bean Vegan Chili", calories: 220, allergens: [], veg: true, vegan: true },
      { item: "Cornbread", calories: 160, allergens: ["dairy", "wheat", "eggs"], veg: true, vegan: false }
    ],
    special: "Three-Bean Vegan Chili with Cornbread"
  },
  "quad-commons": {
    name: "Quad Commons Cafe",
    breakfast: [
      { item: "Breakfast Burrito", calories: 380, allergens: ["dairy", "wheat", "eggs"], veg: false, vegan: false },
      { item: "Avocado Toast", calories: 210, allergens: ["wheat"], veg: true, vegan: true },
      { item: "Greek Yogurt Parfait", calories: 190, allergens: ["dairy"], veg: true, vegan: false }
    ],
    lunch: [
      { item: "Margherita Pizza Slice", calories: 310, allergens: ["dairy", "wheat"], veg: true, vegan: false },
      { item: "Pesto Pasta Salad", calories: 290, allergens: ["dairy", "wheat", "nuts"], veg: true, vegan: false },
      { item: "Turkey Club Wrap", calories: 410, allergens: ["wheat"], veg: false, vegan: false }
    ],
    dinner: [
      { item: "Chicken Tikka Masala", calories: 450, allergens: ["dairy"], veg: false, vegan: false },
      { item: "Chana Masala (Chickpeas)", calories: 280, allergens: [], veg: true, vegan: true },
      { item: "Basmati Rice", calories: 150, allergens: [], veg: true, vegan: true }
    ],
    special: "Chicken Tikka Masala with Basmati Rice"
  }
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_menu",
        description: "Get the menu (breakfast, lunch, dinner) for a specific campus dining hall.",
        inputSchema: {
          type: "object",
          properties: {
            hall: {
              type: "string",
              description: "The dining hall name (must be 'north-hall', 'south-hall', or 'quad-commons')"
            }
          },
          required: ["hall"]
        }
      },
      {
        name: "get_specials",
        description: "Get today's chef specials across all campus dining halls.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_nutrition_info",
        description: "Get detailed nutritional facts (calories, allergens, vegan/vegetarian status) for a specific food item.",
        inputSchema: {
          type: "object",
          properties: {
            item: {
              type: "string",
              description: "The name of the food item (e.g. 'Avocado Toast', 'Baked Salmon')"
            }
          },
          required: ["item"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_menu") {
      const hall = (args.hall || "").toLowerCase();
      const menuData = menus[hall];

      if (!menuData) {
        return {
          content: [{
            type: "text",
            text: `Dining hall '${args.hall}' not found. Please choose from: 'north-hall', 'south-hall', or 'quad-commons'.`
          }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              hallName: menuData.name,
              breakfast: menuData.breakfast,
              lunch: menuData.lunch,
              dinner: menuData.dinner
            }, null, 2)
          }
        ]
      };
    } else if (name === "get_specials") {
      const specials = Object.keys(menus).map(key => ({
        hall: menus[key].name,
        special: menus[key].special
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(specials, null, 2)
          }
        ]
      };
    } else if (name === "get_nutrition_info") {
      const searchItem = (args.item || "").toLowerCase();
      let foundItem = null;
      let foundHall = "";

      for (const [hallKey, hallData] of Object.entries(menus)) {
        const meals = [...hallData.breakfast, ...hallData.lunch, ...hallData.dinner];
        const match = meals.find(m => m.item.toLowerCase().includes(searchItem));
        if (match) {
          foundItem = match;
          foundHall = hallData.name;
          break;
        }
      }

      if (!foundItem) {
        return {
          content: [{ type: "text", text: `Food item '${args.item}' not found on any dining hall menu today.` }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              item: foundItem.item,
              hall: foundHall,
              calories: foundItem.calories,
              allergens: foundItem.allergens.length > 0 ? foundItem.allergens : ["none"],
              isVegetarian: foundItem.veg,
              isVegan: foundItem.vegan
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
  console.error("Cafeteria MCP Server running...");
}

main().catch((err) => {
  console.error("Fatal error in Cafeteria MCP Server:", err);
  process.exit(1);
});
