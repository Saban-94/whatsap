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
  generateDriverBriefTool
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
Current User: ${displayName}
Message: ${userText}
`;

  const availableTools = [
    searchOrdersTool, 
    getOrdersByDateTool, 
    createOrderTool, 
    getOrderDetailsTool,
    driverReportTool,
    updateOrderStatusTool,
    assignDriverTool,
    generateDriverBriefTool
  ];

  try {
    let response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: NOA_SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: availableTools }]
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
            // Fetch a broad set to ensure we find "preparing" etc, and allow fuzzy matching
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
            const searchSlug = lowerQuery.split(/[\s\-/]/)[0]; 

            results = results.filter((r: any) => {
              const customerNameLower = (r.customerName || '').toLowerCase();
              const destinationLower = (r.destination || '').toLowerCase();
              const itemsStr = Array.isArray(r.items) 
                ? r.items.join(' ').toLowerCase() 
                : (typeof r.items === 'string' ? r.items.toLowerCase() : '');

              return customerNameLower.includes(lowerQuery) || 
                     customerNameLower.includes(searchSlug) ||
                     destinationLower.includes(lowerQuery) ||
                     itemsStr.includes(lowerQuery);
            });
          }
          
          console.log(`[Noa Debug] search_orders results for "${cleanQuery}":`, results.length);
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify(results) }, id: (call as any).id });

        } else if (call.name === "get_order_details") {
          const { orderId, customerName } = call.args as any;
          let result = null;

          if (orderId) {
            const orderDoc = await getDoc(doc(db, 'orders', orderId));
            if (orderDoc.exists()) {
              result = { id: orderDoc.id, ...orderDoc.data() };
            }
          }

          if (!result && customerName) {
            const lowerCName = customerName.toLowerCase();
            const searchSlug = lowerCName.split(/[\s\-/]/)[0];
            const snap = await getDocs(query(collection(db, 'orders'), limit(300)));
            const match = snap.docs.find(d => {
              const data = d.data() as any;
              const name = (data.customerName || data.customer || '').toLowerCase();
              return name.includes(lowerCName) || name.includes(searchSlug);
            });
            if (match) {
              result = { id: match.id, ...match.data() };
            }
          }

          console.log(`[Noa Debug] get_order_details for "${orderId || customerName}":`, result ? "Found" : "Not Found");
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify(result) }, id: (call as any).id });

        } else if (call.name === "get_orders_by_date") {
          const { startDate } = call.args as any;
          const searchDate = startDate || todayISO;
          
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
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify(results) }, id: (call as any).id });

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
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify({ success: true, orderId: docRef.id }) }, id: (call as any).id });
        } else if (call.name === "driver_report") {
          const { driverName, truckNumber, kilometers, notes } = call.args as any;
          const docRef = await addDoc(collection(db, 'driver_reports'), {
            driverName,
            truckNumber,
            kilometers,
            notes,
            reportDate: todayISO,
            createdAt: serverTimestamp()
          });
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify({ success: true, reportId: docRef.id }) }, id: (call as any).id });
        } else if (call.name === "update_order_status") {
          const { orderId, status } = call.args as any;
          await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: serverTimestamp() });
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify({ success: true }) }, id: (call as any).id });
        } else if (call.name === "assign_driver") {
          const { orderId, driverId } = call.args as any;
          await updateDoc(doc(db, 'orders', orderId), { driverId, updatedAt: serverTimestamp() });
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify({ success: true }) }, id: (call as any).id });
        } else if (call.name === "generate_driver_brief") {
          const { orderId } = call.args as any;
          const orderDoc = await getDoc(doc(db, 'orders', orderId));
          let result = null;
          if (orderDoc.exists()) {
            result = orderDoc.data();
          }
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify(result) }, id: (call as any).id });
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
                response: o.output,
                id: o.id
              } 
            })) 
          }
        ],
        config: { 
          systemInstruction: NOA_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: availableTools }]
        }
      });
    }

    return response.text;
  } catch (error) {
    console.error("AI Generation Error:", error);
    return "ראמי נשמה, יש לי קצר קטן בחיבור, מנסה שוב בשבילך.";
  }
};
