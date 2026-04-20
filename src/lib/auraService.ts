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

  try {
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
          
          // Strategy: Fetch all recent orders (or by status) and filter client-side for better matching (zabulon)
          let ordersRef = collection(db, 'orders');
          let q;
          if (cleanStatus) {
            q = query(ordersRef, where('status', '==', cleanStatus));
          } else {
            // Fetch everything to ensure we find "preparing" etc
            q = query(ordersRef, limit(300));
          }
          
          const snap = await getDocs(q);
          let results = snap.docs.map(d => {
            const data = d.data() as any;
            return {
              id: d.id,
              customerName: data.customerName || data.customer || 'לקוח לא ידוע',
              destination: data.destination || 'יעד לא צוין',
              warehouse: data.warehouse || 'מחסן כללי',
              status: data.status || 'pending',
              items: data.items || [],
              date: data.date,
              driverId: data.driverId
            };
          });
          
          if (cleanQuery) {
            const lowerQuery = cleanQuery.toLowerCase();
            results = results.filter((r: any) => 
              (r.customerName && r.customerName.toLowerCase().includes(lowerQuery)) || 
              (r.items && r.items.some((i: string) => i.toLowerCase().includes(lowerQuery))) ||
              (r.destination && r.destination.toLowerCase().includes(lowerQuery))
            );
          }
          
          console.log(`[Noa Debug] search_orders results for "${cleanQuery}":`, results.length);
          toolOutputs.push({ name: call.name, output: results, id: (call as any).id });

        } else if (call.name === "get_orders_by_date") {
          const { startDate } = call.args as any;
          const searchDate = startDate || todayISO;
          
          // Fetch everything to avoid missing 'preparing' status
          const snap = await getDocs(query(collection(db, 'orders'), limit(300)));
          const allOrders = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
          
          const results = allOrders.filter((order: any) => {
            if (order.date === searchDate) return true;
            if (order.createdAt) {
              const dateFromTs = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
              if (format(dateFromTs, 'yyyy-MM-dd') === searchDate) return true;
            }
            return false;
          }).map(order => ({
            id: order.id,
            customerName: order.customerName || order.customer || 'לקוח לא ידוע',
            destination: order.destination || 'יעד לא צוין',
            status: order.status || 'pending',
            items: order.items || [],
            date: order.date
          }));

          console.log(`[Noa Debug] get_orders_by_date results for "${searchDate}":`, results.length);
          toolOutputs.push({ name: call.name, output: results, id: (call as any).id });

        } else if (call.name === "create_order") {
          const { customer, items } = call.args as any;
          const docRef = await addDoc(collection(db, 'orders'), {
            customerName: customer,
            items: items || ["פריטים מהצ'אט"],
            status: 'pending',
            createdBy: 'noa',
            createdAt: serverTimestamp(),
            date: todayISO
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
                response: { content: o.output } // Correct structure
              } 
            })) 
          }
        ],
        config: { systemInstruction: NOA_SYSTEM_INSTRUCTION }
      });
    }

    return response.text;
  } catch (error) {
    console.error("AI Generation Error:", error);
    return "ראמי נשמה, יש לי קצר קטן בחיבור, מנסה שוב בשבילך.";
  }
};
