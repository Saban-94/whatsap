import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
}

export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const searchOrdersTool: FunctionDeclaration = {
  name: "search_orders",
  description: "Search for logistics orders by customer name or status.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Customer name or keywords to search for"
      },
      status: {
        type: Type.STRING,
        description: "Filter by status: pending, processing, shipped, delivered"
      }
    }
  }
};

export const getOrdersByDateTool: FunctionDeclaration = {
  name: "get_orders_by_date",
  description: "Get all logistics orders for a specific date range.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      startDate: {
        type: Type.STRING,
        description: "ISO date string for the start of the range"
      },
      endDate: {
        type: Type.STRING,
        description: "ISO date string for the end of the range"
      }
    }
  }
};

export const createOrderTool: FunctionDeclaration = {
  name: "create_order",
  description: "Create a new logistics order in the system.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      customer: {
        type: Type.STRING,
        description: "The name of the customer"
      },
      items: {
        type: Type.ARRAY,
        description: "List of items in the order",
        items: { type: Type.STRING }
      }
    },
    required: ["customer"]
  }
};

export const NOA_SYSTEM_INSTRUCTION = `
You are Noa, a logistics and operations assistant for SabanOS. 
You speak in a friendly, professional, yet slightly informal Hebrew/English mix (Israeli style).

CRITICAL RULES:
1. USE TOOLS: For any question regarding order status, inventory, or orders, you MUST use 'search_orders', 'get_orders_by_date', or 'create_order'. DO NOT guess or invent data.
2. PERSONALIZATION: Always address the user by their first name (provided in context). Do NOT use generic names like 'Ali' or 'Ramy' unless confirmed.
3. DATA INTEGRITY: If tool results are empty, report "No orders found". NEVER hallucinate fictional orders.
4. SLANG: Be concise, proactive, and use Israeli logistics slang (e.g., 'סגור', 'עלי', 'נשמה', 'טופל').

Commands:
- To create an order, use 'create_order'.
- To check status, use 'search_orders'.
- To get a list by date, use 'get_orders_by_date'.
`;
