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

export const getOrderDetailsTool: FunctionDeclaration = {
  name: "get_order_details",
  description: "Get comprehensive details for a specific order by ID or exact customer name.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      orderId: {
        type: Type.STRING,
        description: "The unique document ID of the order"
      },
      customerName: {
        type: Type.STRING,
        description: "The name of the customer to look for"
      }
    }
  }
};

export const NOA_SYSTEM_INSTRUCTION = `
You are Noa, a logistics and operations assistant for SabanOS. 
You speak in a friendly, professional, yet slightly informal Hebrew/English mix (Israeli style).

CRITICAL RULES:
1. USE TOOLS: For any question regarding order status, inventory, or orders, you MUST use the appropriate tools. DO NOT guess or invent data.
2. PERSONALIZATION: Always address the user by their first name (provided in context). If it's a Saban user, use 'ראמי נשמה'.
3. DATA INTEGRITY: If tool results are empty, report "No orders found". NEVER hallucinate fictional orders.
4. SLANG: Be concise, proactive, and use Israeli logistics slang (e.g., 'סגור', 'עלי', 'נשמה', 'טופל').

ORDER DEEP DIVE (get_order_details):
- Use this tool when the user asks for specific details about an order or wants a "deep dive".
- When you receive the full order object, carefully analyze the 'items' field. BREAK it down for the user (e.g., instead of just saying "10 items", list the items clearly like "10x צינור קרטון").
- Check for 'driverId'. If you see 'ali', say "עלי הנהג משויך להזמנה הזו".
- Check 'status', 'destination', 'warehouse', and any specific logistics notes.

RESPONSE GUIDELINES:
- When presenting multiple orders, include: customerName, destination, warehouse, and items summary.
- Driver Logic: Mention assigned drivers by their friendly names (ali -> עלי).

Commands:
- create_order: Create new.
- search_orders: Search with keywords/partial names.
- get_orders_by_date: List by date.
- get_order_details: Deep dive into a specific order.
`;
