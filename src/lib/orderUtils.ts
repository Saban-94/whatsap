import { Order } from '../types';

export const getCustomerDisplay = (order: Partial<Order>): string => {
  if (!order) return 'לקוח לא ידוע';
  
  const name = order.customerName || order.customer;
  
  if (!name || name === 'undefined' || name === 'null') {
    return 'לקוח לא ידוע';
  }
  
  return name;
};

export const getItemsDisplay = (items: any): string => {
  if (!items) return 'לא צוין';
  if (Array.isArray(items)) return items.join(', ');
  if (typeof items === 'string') return items;
  return 'לא צוין';
};
