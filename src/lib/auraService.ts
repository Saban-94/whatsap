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
  createOrderFromPdfTool
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
    createOrderFromPdfTool
  ];

  const contents: any[] = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }];
  
  if (filePart) {
    // Add file part to the last message part
    contents[contents.length - 1].parts.push(filePart);
  }

  try {
    let response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
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
            
            // Robust mapping: try multiple variations just in case
            const rawItemsData = data.items || data.Items || data.item_list || data.list;
            
            // Debug Log
            console.log("Raw items from Firestore during search:", rawItemsData);
            
            // Raw String Injection for items
            const rawItems = Array.isArray(rawItemsData) ? rawItemsData.join(', ') : (rawItemsData || "לא הוזנו פריטים");
            
            return {
              id: d.id,
              customer: data.customerName || data.customer || 'לקוח לא ידוע',
              destination: data.destination || 'יעד לא צוין',
              warehouse: data.warehouse || 'מחסן כללי',
              status: data.status || 'pending',
              items: rawItems,
              date: data.date,
              driverId: data.driverId,
              driverName: getDriverName(data.driverId)
            };
          });
          
          if (cleanQuery) {
            const lowerQuery = cleanQuery.toLowerCase();
            const searchSlug = lowerQuery.split(/[\s\-/]/)[0]; 

            results = results.filter((r: any) => {
              const customerLower = (r.customer || '').toLowerCase();
              const destinationLower = (r.destination || '').toLowerCase();
              const itemsStr = (r.items || '').toLowerCase();

              return customerLower.includes(lowerQuery) || 
                     customerLower.includes(searchSlug) ||
                     destinationLower.includes(lowerQuery) ||
                     itemsStr.includes(lowerQuery);
            });
          }
          
          console.log(`[Noa Debug] search_orders results for "${cleanQuery}":`, results.length);
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify(results) }, id: (call as any).id });

        } else if (call.name === "get_order_details") {
          const { orderId, customerName } = call.args as any;
          let orderData: any = null;

          if (orderId) {
            const orderDoc = await getDoc(doc(db, 'orders', orderId));
            if (orderDoc.exists()) {
              orderData = { id: orderDoc.id, ...orderDoc.data() };
            }
          }

          if (!orderData && customerName) {
            const lowerCName = customerName.toLowerCase();
            const searchSlug = lowerCName.split(/[\s\-/]/)[0];
            const snap = await getDocs(query(collection(db, 'orders'), limit(300)));
            const match = snap.docs.find(d => {
              const data = d.data() as any;
              const name = (data.customerName || data.customer || '').toLowerCase();
              return name.includes(lowerCName) || name.includes(searchSlug);
            });
            if (match) {
              orderData = { id: match.id, ...match.data() };
            }
          }

          if (orderData) {
            // Robust mapping: try multiple variations
            const rawItemsData = orderData.items || orderData.Items || orderData.item_list || orderData.list;
            
            // Debug Log
            console.log("Raw items from Firestore for details:", rawItemsData);
            
            // Raw String Injection for items
            const rawItems = Array.isArray(rawItemsData) ? rawItemsData.join(', ') : (rawItemsData || "לא הוזנו פריטים");
            
            // Flat Tool Response as requested: { items, customer, orderId }
            const flatResult = {
              items: rawItems,
              customer: orderData.customerName || orderData.customer || 'לקוח לא ידוע',
              orderId: orderData.id,
              destination: orderData.destination,
              status: orderData.status,
              driverId: orderData.driverId,
              driverName: getDriverName(orderData.driverId)
            };
            
            console.log(`[Noa Debug] get_order_details found:`, flatResult.customer);
            toolOutputs.push({ name: call.name, output: { content: JSON.stringify(flatResult) }, id: (call as any).id });
          } else {
            toolOutputs.push({ name: call.name, output: { content: JSON.stringify({ error: "Order not found" }) }, id: (call as any).id });
          }
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
          }).map(order => {
            const rawItemsData = order.items || order.Items || order.item_list || order.list;
            const rawItems = Array.isArray(rawItemsData) ? rawItemsData.join(', ') : (rawItemsData || "לא הוזנו פריטים");
            return {
              id: order.id,
              customer: order.customerName || order.customer || 'לקוח לא ידוע',
              destination: order.destination || 'יעד לא צוין',
              status: order.status || 'pending',
              items: rawItems,
              date: order.date
            };
          });

          console.log(`[Noa Debug] get_orders_by_date results for "${searchDate}":`, results.length);
          toolOutputs.push({ name: call.name, output: { content: JSON.stringify(results) }, id: (call as any).id });

        } else if (call.name === "create_order") {
          const { customer, items } = call.args as any;
          
          // Ensure items is a string for the database
          const itemsStr = Array.isArray(items) ? items.join(', ') : (items || "לא הוזנו פריטים");

          const docRef = await addDoc(collection(db, 'orders'), {
            customerName: customer,
            items: itemsStr,
            status: 'pending',
            createdBy: 'noa',
            createdAt: serverTimestamp(),
            date: todayISO
          });

          const confirmation = { 
            success: true, 
            orderId: docRef.id, 
            customer: customer,
            items: itemsStr,
            message: `הזמנה עבור ${customer} נוצרה בהצלחה במערכת.`
          };

          console.log(`[Noa Debug] create_order successful for: ${customer}`);
          toolOutputs.push({ 
            name: call.name, 
            output: { content: JSON.stringify(confirmation) }, 
            id: (call as any).id 
          });
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
        } else if (call.name === "create_order_from_pdf") {
          const { customerName, items, destination, orderNumber, date } = call.args as any;
          
          // Deduplication Check
          const qExist = query(collection(db, 'orders'), where('orderNumber', '==', orderNumber));
          const snapExist = await getDocs(qExist);
          
          if (!snapExist.empty) {
            console.log(`[Noa Debug] Duplicate orderNumber blocked: ${orderNumber}`);
            toolOutputs.push({ 
              name: call.name, 
              output: { content: JSON.stringify({ success: false, error: "Duplicate orderNumber", message: `הזמנה מספר ${orderNumber} כבר קיימת במערכת.` }) }, 
              id: (call as any).id 
            });
          } else {
            const docRef = await addDoc(collection(db, 'orders'), {
              customerName,
              items,
              destination,
              orderNumber,
              status: 'preparing',
              createdBy: 'noa_pdf',
              createdAt: serverTimestamp(),
              date: date || todayISO
            });

            console.log(`[Noa Debug] create_order_from_pdf successful for: ${customerName} (${orderNumber})`);
            toolOutputs.push({ 
              name: call.name, 
              output: { content: JSON.stringify({ success: true, orderId: docRef.id, message: `הזמנה ${orderNumber} של ${customerName} הוקמה בהצלחה.` }) }, 
              id: (call as any).id 
            });
          }
        }
      }

      // Send results back to model
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...contents,
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
