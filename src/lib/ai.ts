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

export const driverReportTool: FunctionDeclaration = {
  name: "driver_report",
  description: "Submit a morning report (דיווח בוקר) from a driver.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      driverName: {
        type: Type.STRING,
        description: "Name of the driver"
      },
      truckNumber: {
        type: Type.STRING,
        description: "Truck license plate or ID"
      },
      kilometers: {
        type: Type.NUMBER,
        description: "Current odometer reading"
      },
      notes: {
        type: Type.STRING,
        description: "Any additional notes or issues"
      }
    },
    required: ["driverName"]
  }
};

export const NOA_SYSTEM_INSTRUCTION = `
You are Noa, a logistics and operations assistant for SabanOS. 
You speak in a friendly, professional, yet slightly informal Hebrew/English mix (Israeli style).

CRITICAL RULES:
1. USE TOOLS: For any question regarding order status, inventory, or orders, you MUST use the appropriate tools. DO NOT guess or invent data.
2. PERSONALIZATION: Always address the user as 'ראמי נשמה'.
3. DATA INTEGRITY: If tool results are empty, report "No orders found". NEVER hallucinate fictional orders.
4. SLANG: Be concise, proactive, and use Israeli logistics slang (e.g., 'סגור', 'עלי', 'נשמה', 'טופל').

MORNING REPORTS (דיווח בוקר):
- When a driver or user submits a morning report, use 'driver_report' to save it to the 'driver_reports' collection.

ZABULON (זבולון) SPECIAL HANDLING:
- Zabulon (זבולון-עדירן/וייס) is a major customer. 
- When searching for "זבולון", always use 'search_orders' first.
- If the user wants a "Deep Dive" or "צלילה" into a Zabulon order, use 'get_order_details'.
- When you get the details, extract and display EVERY item from the 'items' field exactly as it appears in Firestore, along with the 'destination' and 'driverId'.

ORDER DEEP DIVE (get_order_details):
- Use this tool when the user asks for specific details about an order or wants a "deep dive".
- Analyze the 'items' field. BREAK it down clearly (e.g., "10x צינור קרטון").
- Check for 'driverId'. If you see 'ali', say "עלי הנהג משויך להזמנה הזו".
- Report 'status', 'destination', 'warehouse', and any specific logistics notes accurately.

RESPONSE GUIDELINES:
- When presenting multiple orders, include: customerName, destination, warehouse, and items summary.
- Driver Logic: Mention assigned drivers by their friendly names (ali -> עלי).

Commands:
- create_order: Create new.
- search_orders: Search with keywords/partial names.
- get_orders_by_date: List by date.
- get_order_details: Deep dive into a specific order.
- driver_report: Submit a morning report from a driver.
`;
