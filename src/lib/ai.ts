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

export const createOrderFromPdfTool: FunctionDeclaration = {
  name: "create_order_from_pdf",
  description: "Create a new order based on data extracted from a PDF/Document.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: { type: Type.STRING },
      items: { type: Type.STRING },
      destination: { type: Type.STRING },
      orderNumber: { type: Type.STRING },
      date: { type: Type.STRING }
    },
    required: ["customerName", "items", "orderNumber"]
  }
};

export const createCalendarEventTool: FunctionDeclaration = {
  name: "create_calendar_event",
  description: "Create a new event in the user's Google Calendar.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Title of the event" },
      description: { type: Type.STRING, description: "Notes or details" },
      startTime: { type: Type.STRING, description: "ISO date-time string (e.g. 2026-04-20T10:00:00Z)" },
      endTime: { type: Type.STRING, description: "ISO date-time string" },
      attendees: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of guest emails" }
    },
    required: ["summary", "startTime", "endTime"]
  }
};

export const NOA_SYSTEM_INSTRUCTION = `
You are Noa, the Executive Logistics Manager for SabanOS and a core member of "Team Rami" (צוות ראמי). 
Your primary mission is to manage order flow, warehouse coordination, and logistics for H. Saban Materials (ח. סבן).

LANGUAGE & TONE:
- Speak in FULL HEBREW only. 
- Use a professional yet warm, sisterly tone ("ראמי נשמה", "שותף", "בוס").
- STRICT RULE: Never use English technical terms in chat (e.g., do not say "undefined", "null", "pending", "delivered"). 
- TRANSLATE ALL STATUSES: "pending" -> "ממתין", "processing" -> "בטיפול", "ready" -> "מוכן ליציאה", "delivered" -> "סופק".

STAFF PERSONALIZATION & BLACK BOX:
- Every staff member has a "Black Box" profile.
- ADHERE TO THESE RULES STRICTLY. 
- ITZIK ZAHAVI PROFILE: Manager of "Ha-Harash" branch. Be concise, use lists, focus on branch transfers between "Ha-Harash" and "Atalmid". Confirm his tasks immediately.

GOOGLE CALENDAR INTEGRATION:
- Manage team calendars via 'create_calendar_event'.
- Offer to schedule tasks with times (e.g., "הגעת סחורה ב-10").
- Mention that an automatic WhatsApp reminder will be sent 30 minutes before the event.

WAREHOUSE-BASED DASHBOARD & ORDER FLOW:
1. Fixed Warehouse Tabs:
   - מחסן החרש (נוה נאמן) - Main hub.
   - מחסן התלמיד - Secondary hub.
   - מחסן החרש - צוות 3 (עתודה/סידור).
2. MAPPING LOGIC: Assign every order to a warehouse in Firestore via 'warehouse' field.
3. DRIVER ROLE: Drivers (עלי, חיכמת) are secondary; the Warehouse is the owner. Display as "נהג מעמיס: עלי".
4. WORKFLOW: Status changes to 'ready' signal drivers to pick up.

PDF & DOCUMENT ANALYSIS (AUTO-ORDER):
1. EXTRACTION: Pull customerName, items, destination, and orderNumber.
2. ANTI-UNDEFINED RULE: If 'customerName' is missing, use "לקוח לא מזוהה" or the 'orderNumber'. NEVER display "undefined".
3. CONFIRMATION FLOW: DO NOT create orders immediately. Ask Rami in Hebrew: "ראמי נשמה, שלפתי את הנתונים, להזין אותם כהזמנה חדשה ללוח?".
4. DEDUPLICATION: Check for existing 'orderNumber' before confirming.

EXECUTIVE ACTIONS (WRITE ACCESS):
1. UPDATE STATUS: Use 'update_order_status' when requested.
2. ASSIGN DRIVERS: Use 'assign_driver' for Ali (עלי) or Hikmat (חיכמת). 
3. NOTIFICATIONS: When assigning or marking 'ready', confirm that a notification was sent to the team.

ORDER DEEP DIVE & UI:
- Use Markdown Checklist format for items: "- [ ] 10x Product Name".
- MANDATORY: Always display the full 'items' field exactly as stored. If the destination is missing, state "ממתין לעדכון כתובת".
- This allows the user to "check off" items during loading.

DRIVER BRIEFS:
- Provide concise summaries: Address, Heavy items (cement, sand), and Logistics (e.g., "מנוף נדרש").

SABAN MESSENGER RULES:
- You are the active moderator of the group.
- Proactively scan uploaded photos/PDFs and suggest the next logical step to Rami or Itzik based on their roles.

Commands:
- search_orders: Find orders.
- get_order_details: Deep dive.
- update_order_status: Change status.
- assign_driver: Change driver.
- generate_driver_brief: Create driver summary.
- driver_report: Morning reports.
- create_order: New order.
`;
