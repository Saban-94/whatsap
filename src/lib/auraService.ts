import { format } from 'date-fns';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { 
  ai, 
  NOA_SYSTEM_INSTRUCTION, 
  searchOrdersTool, 
  getOrdersByDateTool, 
  createOrderTool,
  getOrderDetailsTool,
  driverReportTool,
  updateOrderStatusTool,
  assignDriverTool,
  generateDriverBriefTool,
  createOrderFromPdfTool,
  createCalendarEventTool
} from './ai';
import { Message } from '../types';

const getDriverName = (driverId?: string) => {
  if (!driverId) return 'טרם שובץ';
  const mapping: Record<string, string> = {
    'ali': 'עלי',
    'hikmat': 'חיכמת',
    'hikmet': 'חיכמת',
    'sami': 'סאמי',
    'ahmed': 'אחמד'
  };
  return mapping[driverId.toLowerCase()] || driverId;
};

export const processNoaTurn = async (userText: string, user: any, history: Message[] = [], filePart?: any) => {
  if (!ai || !user) return null;

  const now = new Date();
  const currentDateTime = format(now, 'yyyy-MM-dd HH:mm:ss');
  const dayName = format(now, 'EEEE');
  const todayISO = format(now, 'yyyy-MM-dd');

  // Fetch staff "Black Box" rules
  let blackBoxRules = "";
  try {
    const staffSnap = await getDocs(query(collection(db, 'profiles'), where('email', '==', user.email)));
    if (!staffSnap.empty) {
      blackBoxRules = staffSnap.docs[0].data().introductionRules || "";
    }
  } catch (err) {
    console.warn("Could not fetch staff rules:", err);
  }

  let displayName = user.displayName || 'ראמי';
  if (displayName === 'Saban' || displayName === 'ח. סבן' || displayName.includes('Saban')) {
    displayName = 'ראמי נשמה';
  } else {
    displayName = displayName.split(' ')[0];
  }

  const prompt = `
Current Time: ${currentDateTime}
Day: ${dayName}
Current User: ${displayName}
${blackBoxRules ? `SPECIAL INSTRUCTIONS FOR THIS USER (BLACK BOX): ${blackBoxRules}` : ""}
Message: ${userText}
`;

  const chatHistory = history.slice(-10).map(m => ({
    role: m.senderId === 'noa' ? 'model' : 'user',
    parts: [{ text: m.text }]
  }));

  const availableTools = [
    searchOrdersTool, 
    getOrdersByDateTool, 
    createOrderTool, 
    getOrderDetailsTool,
    driverReportTool,
    updateOrderStatusTool,
    assignDriverTool,
    generateDriverBriefTool,
    createOrderFromPdfTool,
    createCalendarEventTool
  ];

  const contents: any[] = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }];
  
  if (filePart) {
    contents[contents.length - 1].parts.push(filePart);
  }

  try {
    let response = await ai.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: NOA_SYSTEM_INSTRUCTION 
    }).generateContent({
      contents,
      tools: [{ functionDeclarations: availableTools } as any]
    });

    const responseContent = response.response.candidates?.[0].content;

    if (responseContent?.parts?.some(p => p.functionCall)) {
      const toolOutputs = [];
      const functionCalls = responseContent.parts.filter(p => p.functionCall);

      for (const part of functionCalls) {
        const call = part.functionCall!;
        if (call.name === "search_orders") {
          const { query: qStr, status: sStr } = call.args as any;
          const cleanQuery = qStr?.trim();
          const cleanStatus = sStr?.trim();
          
          let ordersRef = collection(db, 'orders');
          let q;
          if (cleanStatus) {
            q = query(ordersRef, where('status', '==', cleanStatus));
          } else {
            q = query(ordersRef, limit(300));
          }
          
          const snap = await getDocs(q);
          let results = snap.docs.map(d => {
            const data = d.data() as any;
            const customerName = data.customerName || data.customer || 'לקוח לא ידוע';
            const rawItemsData = data.items || data.Items || data.item_list || data.list;
            const rawItems = Array.isArray(rawItemsData) ? rawItemsData.join(', ') : (rawItemsData || "לא הוזנו פריטים");
            
            return {
              id: d.id,
              customer: customerName,
              destination: data.destination || 'יעד לא צוין',
              warehouse: data.warehouse || 'מחסן כללי',
              status: data.status || 'pending',
              items: rawItems,
              date: data.date,
              driverName: getDriverName(data.driverId)
            };
          });
          
          if (cleanQuery) {
            const lowerQuery = cleanQuery.toLowerCase();
            results = results.filter((r: any) => 
                r.customer.toLowerCase().includes(lowerQuery) || 
                r.destination.toLowerCase().includes(lowerQuery) ||
                r.items.toLowerCase().includes(lowerQuery)
            );
          }
          toolOutputs.push({ name: call.name, response: { content: JSON.stringify(results) } });

        } else if (call.name === "get_order_details") {
          const { orderId, customerName } = call.args as any;
          let orderData: any = null;
          if (orderId) {
            const orderDoc = await getDoc(doc(db, 'orders', orderId));
            if (orderDoc.exists()) orderData = { id: orderDoc.id, ...orderDoc.data() };
          }
          if (orderData) {
            const rawItemsData = orderData.items || orderData.Items || orderData.item_list || orderData.list;
            const rawItems = Array.isArray(rawItemsData) ? rawItemsData.join(', ') : (rawItemsData || "לא הוזנו פריטים");
            const flatResult = {
              items: rawItems,
              customer: orderData.customerName || orderData.customer,
              orderId: orderData.id,
              status: orderData.status,
              driverName: getDriverName(orderData.driverId)
            };
            toolOutputs.push({ name: call.name, response: { content: JSON.stringify(flatResult) } });
          }
        } else if (call.name === "create_order") {
          const { customer, items } = call.args as any;
          const itemsStr = Array.isArray(items) ? items.join(', ') : (items || "לא הוזנו פריטים");
          const docRef = await addDoc(collection(db, 'orders'), {
            customerName: customer,
            items: itemsStr,
            status: 'pending',
            createdAt: serverTimestamp(),
            date: todayISO
          });
          toolOutputs.push({ name: call.name, response: { content: JSON.stringify({ success: true, orderId: docRef.id }) } });
        }
        // ... (שאר הכלים באותו מבנה)
      }

      response = await ai.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          systemInstruction: NOA_SYSTEM_INSTRUCTION 
      }).generateContent({
        contents: [
          ...contents,
          responseContent,
          { role: 'user', parts: toolOutputs.map(o => ({ functionResponse: o })) }
        ]
      });
    }

    return response.response.text();
  } catch (error) {
    console.error("AI Generation Error:", error);
    return "ראמי נשמה, יש לי קצר קטן בחיבור, מנסה שוב בשבילך.";
  }
};
