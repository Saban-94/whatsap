import { format } from 'date-fns';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { 
  ai, 
  NOA_SYSTEM_INSTRUCTION, 
  searchOrdersTool, 
  getOrdersByDateTool, 
  createOrderTool 
} from './ai';

export const processNoaTurn = async (userText: string, user: any) => {
  if (!ai || !user) return null;

  const now = new Date();
  const currentDateTime = format(now, 'yyyy-MM-dd HH:mm:ss');
  const dayName = format(now, 'EEEE');
  const todayISO = format(now, 'yyyy-MM-dd');

  let displayName = user.displayName || 'ראמי';
  if (displayName === 'Saban' || displayName === 'ח. סבן' || displayName.includes('Saban')) {
    displayName = 'ראמי נשמה';
  } else {
    displayName = displayName.split(' ')[0];
  }

  const prompt = `
Current Time: ${currentDateTime}
Day: ${dayName}
User Name: ${displayName}
Message: ${userText}
`;

  let response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: NOA_SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: [searchOrdersTool, getOrdersByDateTool, createOrderTool] }]
    }
  });

  if (response.functionCalls) {
    const toolOutputs = [];
    for (const call of response.functionCalls) {
      if (call.name === "search_orders") {
        const { query: qStr, status: sStr } = call.args as any;
        const cleanQuery = qStr?.trim();
        const cleanStatus = sStr?.trim();
        
        let ordersRef = collection(db, 'orders');
        let q;
        if (cleanStatus) {
           q = query(ordersRef, where('status', '==', cleanStatus));
        } else {
           q = query(ordersRef, limit(100));
        }
        
        const snap = await getDocs(q);
        let results = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) }));
        
        if (cleanQuery) {
          const lowerQuery = cleanQuery.toLowerCase();
          results = results.filter((r: any) => 
            (r.customer && r.customer.toLowerCase().includes(lowerQuery)) || 
            (r.items && r.items.some((i: string) => i.toLowerCase().includes(lowerQuery)))
          );
        }
        
        console.log(`[Noa Debug] search_orders results for "${cleanQuery}":`, results.length);
        toolOutputs.push({ name: call.name, output: results, id: (call as any).id });

      } else if (call.name === "get_orders_by_date") {
        const { startDate, endDate } = call.args as any;
        const searchDate = startDate || todayISO;
        
        // Fetch a larger window and filter in-memory for flexibility (3 formats)
        const snap = await getDocs(query(collection(db, 'orders'), limit(150)));
        const allOrders = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        
        const results = allOrders.filter((order: any) => {
          if (!order.createdAt) return false;
          
          // Format 1: Firebase Timestamp
          const ts = order.createdAt;
          const dateFromTs = ts.toDate ? ts.toDate() : new Date(ts);
          const iso = format(dateFromTs, 'yyyy-MM-dd');
          const dmy = format(dateFromTs, 'dd/MM/yyyy');
          
          return iso === searchDate || dmy === searchDate || iso.includes(searchDate) || dmy.includes(searchDate);
        });

        console.log(`[Noa Debug] get_orders_by_date results for "${searchDate}":`, results.length);
        toolOutputs.push({ name: call.name, output: results, id: (call as any).id });

      } else if (call.name === "create_order") {
        const { customer, items } = call.args as any;
        const docRef = await addDoc(collection(db, 'orders'), {
          customer,
          items: items || ["פריטים מהצ'אט"],
          status: 'pending',
          createdBy: 'noa',
          createdAt: serverTimestamp()
        });
        toolOutputs.push({ name: call.name, output: { success: true, orderId: docRef.id }, id: (call as any).id });
      }
    }

    // Send results back to model
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
        response.candidates[0].content, 
        { 
          role: 'user', 
          parts: toolOutputs.map((o) => ({ 
            functionResponse: { 
              name: o.name, 
              // Fix: ensure the data is wrapped in object: { response: { content: result } }
              // according to user instruction to prevent Proto field error
              response: { content: o.output },
              id: o.id
            } 
          })) 
        }
      ],
      config: { systemInstruction: NOA_SYSTEM_INSTRUCTION }
    });
  }

  return response.text;
};
