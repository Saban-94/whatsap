import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  ChevronLeft,
  ArrowUpDown,
  Clock,
  Package,
  MapPin,
  User as UserIcon,
  History
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface OrderHistoryProps {
  onOrderClick?: (orderId: string) => void;
  onBack?: () => void;
  selectedOrderId?: string;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ onOrderClick, onBack, selectedOrderId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(selectedOrderId || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (selectedOrderId) {
      setSearchTerm(selectedOrderId);
      setStatusFilter('all');
    }
  }, [selectedOrderId]);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, sortOrder]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'orders'), orderBy('createdAt', sortOrder));
      
      if (statusFilter !== 'all') {
        q = query(collection(db, 'orders'), where('status', '==', statusFilter), orderBy('createdAt', sortOrder));
      }

      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      setOrders(ordersData);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const customer = (order.customerName || order.customer || '').toLowerCase();
    const destination = (order.destination || '').toLowerCase();
    const orderId = (order.id || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return customer.includes(term) || destination.includes(term) || orderId.includes(term);
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ready': return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">מוכן</span>;
      case 'preparing': return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">בהכנה</span>;
      case 'pending': return <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold">ממתין</span>;
      case 'shipped': return <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">בדרך</span>;
      case 'delivered': return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold">נמסר</span>;
      default: return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 shrink-0 border-b border-gray-300 safe-top">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1 hover:bg-gray-200 rounded-full transition-colors leading-none">
              <ChevronLeft className="w-6 h-6 text-[#54656f] rotate-180" />
            </button>
          )}
          <History className="w-5 h-5 text-[#00a884]" />
          <h2 className="text-lg font-bold text-[#111b21]">היסטוריית הזמנות</h2>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-[#54656f]">
             <ArrowUpDown className="w-5 h-5" />
           </button>
        </div>
      </header>

      <div className="p-4 space-y-4 shrink-0 border-b border-gray-100 shadow-sm">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="חפש לפי לקוח או יעד..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#f0f2f5] rounded-xl pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['all', 'pending', 'preparing', 'ready', 'shipped', 'delivered'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                statusFilter === s 
                  ? "bg-[#00a884] text-white shadow-md shadow-[#00a884]/20" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {s === 'all' ? 'הכל' : s === 'pending' ? 'ממתינים' : s === 'preparing' ? 'בהכנה' : s === 'ready' ? 'מוכן' : s === 'shipped' ? 'בדרך' : 'נמסרו'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8f9fa] p-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">טוחן נתונים עבורך...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-4 opacity-70">
            <History className="w-16 h-16 stroke-[1]" />
            <p className="text-sm font-medium text-center px-10">לא נמצאו הזמנות התואמות לחיפוש שלך במערכת</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-2 max-w-4xl mx-auto">
            {filteredOrders.map((order) => (
              <div 
                key={order.id} 
                onClick={() => onOrderClick?.(order.id!)}
                className={cn(
                  "bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[#00a884]/30 transition-all cursor-pointer group active:scale-[0.98]",
                  selectedOrderId === order.id ? "border-[#00a884] ring-2 ring-[#00a884]/10 bg-[#00a884]/5" : "border-gray-200"
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-[#111b21] group-hover:text-[#00a884] transition-colors">
                      {order.customerName || order.customer || 'לקוח ללא שם'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1">
                      <Calendar className="w-3 h-3" />
                      {order.createdAt ? format(order.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: he }) : 'תאריך לא ידוע'}
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2 text-[13px] text-gray-600">
                    <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="truncate">{order.destination || 'כתובת לא צוינה'}</span>
                  </div>
                  
                  <div className="flex items-start gap-2 text-[13px] text-gray-600 px-0.5">
                    <Package className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1 italic text-gray-500">
                      {Array.isArray(order.items) ? order.items.join(', ') : order.items}
                    </span>
                  </div>

                  {(order.driverId || order.driverName) && (
                    <div className="flex items-center gap-2 text-[12px] text-[#54656f] bg-[#f0f2f5] p-2 rounded-xl mt-3 border border-gray-100">
                      <UserIcon className="w-3.5 h-3.5 text-orange-500" />
                      <span className="font-semibold">נהג אחראי: {order.driverId === 'ali' ? 'עלי' : order.driverId === 'hikmat' ? 'חיכמת' : (order.driverName || order.driverId)}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end mt-4 pt-3 border-t border-gray-50 flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                   פרטים נוספים <ChevronLeft className="w-3 h-3 transition-all group-hover:translate-x-[-2px] text-[#00a884]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
