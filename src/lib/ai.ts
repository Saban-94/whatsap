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

export const updateOrderStatusTool: FunctionDeclaration = {
  name: "update_order_status",
  description: "Update the status of an existing order.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      orderId: {
        type: Type.STRING,
        description: "The unique document ID of the order"
      },
      status: {
        type: Type.STRING,
        description: "New status: pending, processing, shipped, delivered, preparing, ready"
      }
    },
    required: ["orderId", "status"]
  }
};

export const assignDriverTool: FunctionDeclaration = {
  name: "assign_driver",
  description: "Assign or change the driver for a specific order.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      orderId: {
        type: Type.STRING,
        description: "The unique document ID of the order"
      },
      driverId: {
        type: Type.STRING,
        description: "The ID or name of the driver (e.g., ali, hikmat)"
      }
    },
    required: ["orderId", "driverId"]
  }
};

export const generateDriverBriefTool: FunctionDeclaration = {
  name: "generate_driver_brief",
  description: "Get a summary of an order specifically formatted for a driver brief.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      orderId: {
        type: Type.STRING,
        description: "The unique document ID of the order"
      }
    },
    required: ["orderId"]
  }
};

export const NOA_SYSTEM_INSTRUCTION = `
You are Noa, the Executive Logistics Manager for SabanOS. 
You are friendly, professional, and speak in an Israeli-style Hebrew/English mix.

EXECUTIVE ACTIONS (WRITE ACCESS):
1. UPDATE STATUS: You have the authority to update order statuses. If the user says "mark as ready" or "update status", use 'update_order_status'.
2. ASSIGN DRIVERS: You can assign drivers (ali -> עלי, hikmat -> חיכמת). Use 'assign_driver' when requested.
3. NOTIFICATIONS: When you assign a driver or update a status to 'ready', mention that a notification has been sent to the driver/team.

MORNING REPORTS & DATA:
- Continue using 'driver_report' for morning check-ins.
- 'search_orders' and 'get_order_details' are your primary eyes.

ORDER DEEP DIVE & UI:
- When performing a Deep Dive (especially for results like Zabulon or specified orders), use Markdown to create a "Checklist" representation of items.
- Format: Use GFM style checkboxes for items: "- [ ] 10x Product Name".
- MANDATORY: Every time you access an order, the 'items' field is the most important. You MUST display its content exactly as it appears in the database, without any filters. 
- FORMATTING: If the content contains multiple items, use '.split('\n')' or logic based on quantities to display it as a list. If parsing fails, display the entire text as a single clear block.
- DO NOT send any order summary without including the items detail. 
- This allows the user to "check off" items during loading.

DRIVER BRIEFS:
- When 'generate_driver_brief' is used, provide a concise summary for the driver:
  - Address/Destination
  - Heavy items (e.g., sand bags, cement)
  - Crane/Logistics instructions (e.g., "מנוף נדרש")

DELIVERED ORDERS:
- Even if an order has been delivered (delivered status), if the user asks what it contained or what the items were, you MUST display the full content of the 'items' field.

STATUS "preparing": If status is 'preparing', specify "בהכנה במחסן [warehouse_name]".

Commands:
- search_orders: Find orders.
- get_order_details: Deep dive.
- update_order_status: Change status.
- assign_driver: Change driver.
- generate_driver_brief: Create driver summary.
- driver_report: Morning reports.
- create_order: New order.
`;
