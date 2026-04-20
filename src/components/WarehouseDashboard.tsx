import React, { useState, useEffect } from 'react';
import { 
  Warehouse, 
  Package, 
  MapPin, 
  User, 
  CheckCircle2, 
  Clock, 
  Map,
  Truck,
  History,
  RefreshCcw,
  AlertTriangle
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { getCustomerDisplay } from '../lib/orderUtils';
import { motion, AnimatePresence } from 'motion/react';

interface WarehouseDashboardProps {
  onBack?: () => void;
}

const WAREHOUSES = [
  { id: 'harash', name: 'מחסן החרש (נוה נאמן)', icon: <Warehouse className="w-5 h-5" /> },
  { id: 'talmid', name: 'מחסן התלמיד', icon: <Map className="w-5 h-5" /> },
  { id: 'team3', name: 'מחסן החרש - צוות 3', icon: <Truck className="w-5 h-5" /> }
];

export const WarehouseDashboard: React.FC<WarehouseDashboardProps> = ({ onBack }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState(WAREHOUSES[0].id);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getWarehouseOrders = (warehouseId: string) => {
    return orders.filter(order => {
      const w = (order.warehouse || '').toLowerCase();
      if (warehouseId === 'harash') return w.includes('חרש') && !w.includes('3');
      if (warehouseId === 'talmid') return w.includes('תלמיד');
      if (warehouseId === 'team3') return w.includes('3');
      return false;
    });
  };

  const markAsReady = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'ready',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'טרם שובץ';
    const mapping: Record<string, string> = {
      'ali': 'עלי',
      'hikmat': 'חיכמת',
      'sami': 'סאמי'
    };
    return mapping[driverId.toLowerCase()] || driverId;
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <Warehouse className="w-6 h-6 text-[#00a884]" />
          <h1 className="text-lg font-bold text-[#111b21]">דשבורד מחסנים (SabanOS)</h1>
        </div>
        <button 
          onClick={() => setLoading(true)} 
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
        >
          <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </header>

      {/* Warehouse Tabs */}
      <div className="bg-white border-b border-gray-200 px-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
          {WAREHOUSES.map((w) => (
            <button
              key={w.id}
              onClick={() => setActiveTab(w.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2",
                activeTab === w.id 
                  ? "border-[#00a884] text-[#00a884] bg-[#00a884]/5" 
                  : "border-transparent text-gray-500 hover:bg-gray-50"
              )}
            >
              {w.icon}
              {w.name}
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                activeTab === w.id ? "bg-[#00a884] text-white" : "bg-gray-100 text-gray-500"
              )}>
                {getWarehouseOrders(w.id).filter(o => o.status !== 'ready' && o.status !== 'delivered').length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {getWarehouseOrders(activeTab).length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 gap-4 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <Package className="w-16 h-16 stroke-[1]" />
                <p className="font-medium">אין משימות פעילות למחסן זה כרגע</p>
              </div>
            ) : (
              getWarehouseOrders(activeTab).map((order) => (
                <div 
                  key={order.id}
                  className={cn(
                    "bg-white rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md relative overflow-hidden",
                    order.status === 'ready' ? "border-green-100 bg-green-50/30" : "border-gray-100",
                    order.isUrgent && "border-red-500 bg-red-50 ring-1 ring-red-500 shadow-red-100"
                  )}
                >
                  {order.isUrgent && (
                    <div className="absolute top-0 right-0 left-0 h-1 bg-red-500" />
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#111b21] truncate">
                          {getCustomerDisplay(order)}
                        </h3>
                        {order.isUrgent && (
                           <motion.div
                             animate={{ scale: [1, 1.1, 1] }}
                             transition={{ repeat: Infinity, duration: 1.5 }}
                           >
                             <AlertTriangle className="w-4 h-4 text-red-600 fill-red-100" />
                           </motion.div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>נוצר: {order.date || 'היום'}</span>
                      </div>
                    </div>
                    {order.status === 'ready' ? (
                      <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        מוכן להעמסה
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-[10px] font-bold">
                        ממתין להכנה
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex gap-2">
                       <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                       <span className="text-[13px] text-gray-600 line-clamp-1">{order.destination || 'כתובת לא צוינה'}</span>
                    </div>
                    <div className="bg-[#f0f2f5] p-3 rounded-xl border border-gray-200/50">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                         <Package className="w-3.5 h-3.5" />
                         רשימת פריטים להכנה
                       </div>
                       <p className="text-[13px] text-[#111b21] font-medium leading-relaxed italic">
                         {Array.isArray(order.items) ? order.items.join(', ') : order.items}
                       </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[#54656f]">
                       <User className="w-3.5 h-3.5 text-orange-500" />
                       <span className="font-semibold">נהג מעמיס: {getDriverName(order.driverId || order.driverName)}</span>
                    </div>
                    
                    {order.status !== 'ready' && order.status !== 'delivered' && (
                      <button
                        onClick={() => markAsReady(order.id!)}
                        className="bg-[#00a884] shadow-md shadow-[#00a884]/20 hover:bg-[#008f72] text-white text-[11px] font-bold py-2 px-4 rounded-xl transition-all active:scale-95"
                      >
                        מוכן להעמסה
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
