import React from 'react';
import { CheckSquare, Package, MapPin, User, Hash } from 'lucide-react';
import { cn } from '../lib/utils';
import { getCustomerDisplay } from '../lib/orderUtils';

interface DeepDiveCardProps {
  order: {
    customerName?: string;
    customer?: string;
    destination?: string;
    items?: string | string[];
    status?: string;
    driverId?: string;
    driverName?: string;
    id?: string;
  };
}

export const DeepDiveCard: React.FC<DeepDiveCardProps> = ({ order }) => {
  const customerName = getCustomerDisplay(order as any);
  
  // Logic to parse items string as requested by the user
  const parseItems = (itemsInput: string | string[]) => {
    if (Array.isArray(itemsInput)) return itemsInput;
    if (!itemsInput || typeof itemsInput !== 'string') return [];
    
    // First, check for obvious delimiters
    if (itemsInput.includes(',') || itemsInput.includes('\n') || itemsInput.includes(';')) {
      return itemsInput.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
    }

    // Advanced Logistics Parsing: Handles mixed delimiters and dimensions (e.g., "500 3 מטר")
    // Dimensional/Unit list to ignore as "New Item" starters
    const units = ['מטר', 'מ', 'סמ', 'ממ', 'צול', "מ'", 'מ"', 'ס"מ', 'מ"מ', 'ק"ג', 'קג', 'יח', 'יחידה', 'יחידות', 'חבילה', 'שק'];
    
    // Normalize and split by space
    const words = itemsInput.replace(/\s+/g, ' ').trim().split(' ');
    const result: string[] = [];
    let currentItem = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const nextWord = words[i + 1];

      // Is this word a candidate for a new item quantity? (e.g., "10", "10x", "5*")
      const isQuantity = /^\d+([xX*])?$/.test(word);
      
      // A quantity is a "New Item Starter" ONLY IF:
      // 1. It's not the first word AND...
      // 2. The next word is NOT a unit (like "מטר") AND...
      // 3. The next word is NOT another number (like dimensions "500 3")
      const looksLikeNewItem = isQuantity && nextWord && 
                               !/^\d/.test(nextWord) && 
                               !units.some(u => nextWord.startsWith(u));

      if (looksLikeNewItem && currentItem !== '') {
        result.push(currentItem.trim());
        currentItem = word;
      } else {
        currentItem += (currentItem === '' ? '' : ' ') + word;
      }
    }

    if (currentItem) result.push(currentItem.trim());
    return result.length > 0 ? result : [itemsInput];
  };

  const itemsList = parseItems(order.items || '');

  return (
    <div className="bg-white border border-[#00a884]/20 rounded-xl overflow-hidden shadow-md my-2 max-w-full">
      <div className="bg-[#00a884] px-4 py-2 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 opacity-70" />
          <span className="text-xs font-bold font-mono">{order.id?.slice(-6).toUpperCase() || 'NEW'}</span>
        </div>
        <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded uppercase">{order.status || 'pending'}</span>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-[#111b21] flex items-center gap-2">
            <User className="w-5 h-5 text-[#00a884]" />
            {customerName}
          </h3>
          {order.destination && (
            <div className="flex items-start gap-2 text-sm text-gray-500 mt-1">
              <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{order.destination}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <Package className="w-4 h-4" />
            רשימת העמסה (Items Checklist)
          </div>
          
          <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
            {itemsList.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 group group-hover:bg-white p-1 rounded transition-colors">
                <div className="mt-0.5 relative">
                   <div className="w-5 h-5 border-2 border-gray-300 rounded group-hover:border-[#00a884] transition-colors flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-[#00a884] rounded-sm scale-0 group-hover:scale-100 transition-transform" />
                   </div>
                </div>
                <span className="text-sm text-gray-700 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {order.driverId && (
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-gray-700">נהג מעמיס: {order.driverId === 'ali' ? 'עלי' : order.driverId === 'hikmat' ? 'חיכמת' : (order.driverName || order.driverId)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
