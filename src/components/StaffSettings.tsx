import React, { useState, useEffect } from 'react';
import { 
  Users, 
  User, 
  Mail, 
  Link as LinkIcon, 
  Settings, 
  Save, 
  Plus, 
  Trash2,
  Calendar,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface StaffProfile {
  id: string;
  name: string;
  role: string;
  email: string;
  profileLink?: string;
  introductionRules: string;
  calendarEnabled: boolean;
}

interface StaffSettingsProps {
  onBack?: () => void;
}

export const StaffSettings: React.FC<StaffSettingsProps> = ({ onBack }) => {
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<StaffProfile>>({});

  useEffect(() => {
    const q = query(collection(db, 'staff'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as StaffProfile[];
      setStaffList(data);
      if (data.length > 0 && !activeStaffId) {
        setActiveStaffId(data[0].id);
        setFormData(data[0]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleStaffSelect = (staff: StaffProfile) => {
    setActiveStaffId(staff.id);
    setFormData(staff);
  };

  const createNewStaff = () => {
    const newId = `staff_${Date.now()}`;
    const newStaff: StaffProfile = {
      id: newId,
      name: 'חבר צוות חדש',
      role: 'תפקיד',
      email: '',
      introductionRules: '',
      calendarEnabled: false
    };
    setActiveStaffId(newId);
    setFormData(newStaff);
  };

  const handleSave = async () => {
    if (!activeStaffId || !formData.email) {
      alert("יש להזין אימייל לסנכרון");
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'staff', activeStaffId), {
        ...formData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert("הפרופיל עודכן בהצלחה");
    } catch (err) {
      console.error("Error saving staff:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק פרופיל זה?")) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
      if (activeStaffId === id) {
        setActiveStaffId(null);
        setFormData({});
      }
    } catch (err) {
      console.error("Error deleting staff:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] md:flex-row overflow-hidden">
      {/* Sidebar List */}
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
        <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-10 shrink-0 safe-top">
          <div className="flex items-center gap-3">
             {onBack && (
               <button onClick={onBack} className="md:hidden p-1 hover:bg-gray-200 rounded-full transition-colors leading-none">
                 <ChevronLeft className="w-6 h-6 text-[#54656f] rotate-180" />
               </button>
             )}
            <Users className="w-5 h-5 text-[#00a884]" />
            <h1 className="text-lg font-bold text-[#111b21]">הגדרות צוות</h1>
          </div>
          <button 
            onClick={createNewStaff}
            className="p-2 bg-[#00a884]/10 text-[#00a884] rounded-full hover:bg-[#00a884]/20 transition-colors"
            title="הוסף חבר צוות"
          >
            <Plus className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-10 flex justify-center"><div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" /></div>
          ) : staffList.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">לא נמצאו חברי צוות</div>
          ) : (
            staffList.map((staff) => (
              <div 
                key={staff.id}
                onClick={() => handleStaffSelect(staff)}
                className={cn(
                  "p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-all",
                  activeStaffId === staff.id ? "bg-[#00a884]/5 border-r-4 border-r-[#00a884]" : ""
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[#54656f]">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#111b21] truncate">{staff.name}</h3>
                    <p className="text-xs text-gray-400 truncate">{staff.role}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(staff.id); }}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 p-4 md:p-10">
        <AnimatePresence mode="wait">
          {activeStaffId ? (
            <motion.div
              key={activeStaffId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <Settings className="w-6 h-6 text-[#00a884]" />
                  <h2 className="text-xl font-bold text-[#111b21]">פרופיל חבר צוות</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 px-1">שם מלא</label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-[#f0f2f5] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                        placeholder="לדוגמה: איציק כהן"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 px-1">תפקיד</label>
                    <div className="relative">
                      <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        value={formData.role || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                        className="w-full bg-[#f0f2f5] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                        placeholder="לדוגמה: מנהל מחסן"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 col-span-full">
                    <label className="text-xs font-bold text-gray-500 px-1 font-mono uppercase tracking-wider">SYNC EMAIL (Calendar)</label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-[#f0f2f5] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                        placeholder="itzik@saban.co.il"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 col-span-full">
                    <label className="text-xs font-bold text-gray-500 px-1">קישור לפרופיל/רשת חברתית</label>
                    <div className="relative">
                      <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        value={formData.profileLink || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, profileLink: e.target.value }))}
                        className="w-full bg-[#f0f2f5] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Black Box Section */}
              <div className="bg-[#111b21] rounded-3xl p-6 shadow-xl border border-gray-800 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#00a884] rounded-lg flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold">קופסה שחורה (System Box)</h2>
                  </div>
                  <div className="text-[10px] bg-red-500 px-2 py-0.5 rounded uppercase font-bold tracking-widest animate-pulse">
                    AI Injection Active
                  </div>
                </div>
                
                <p className="text-xs text-gray-400 mb-4 leading-relaxed italic">
                  הנחיות ל-Noa: הגדר כאן איך נועה צריכה להתנהג עם איציק, אילו תזכורות לשלוח לו ומה רמת הפירוט שהוא צריך.
                </p>

                <textarea 
                  value={formData.introductionRules || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, introductionRules: e.target.value }))}
                  className="w-full bg-[#1c272c] rounded-2xl p-4 text-sm text-[#e9edef] border border-gray-700 min-h-[150px] focus:outline-none focus:ring-2 focus:ring-[#00a884] transition-all"
                  placeholder='לדוגמה: "איציק הוא מנהל המחסן, תני לו דיווחים קצרים, טון דיבור מנומס וחד..." '
                />
              </div>

              {/* Calendar Settings */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#00a884]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#111b21]">חיבור ליומן גוגל (Google Calendar)</h3>
                    <p className="text-xs text-gray-500">אפשר לנועה לנהל אירועים ולשלוח תזכורות אוטומטיות</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <span className={cn(
                     "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                     formData.calendarEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                   )}>
                     {formData.calendarEnabled ? 'Connected' : 'Disconnected'}
                   </span>
                   <button 
                     onClick={() => setFormData(prev => ({ ...prev, calendarEnabled: !prev.calendarEnabled }))}
                     className={cn(
                       "w-12 h-6 rounded-full transition-all relative overflow-hidden",
                       formData.calendarEnabled ? "bg-[#00a884]" : "bg-gray-300"
                     )}
                   >
                     <div className={cn(
                       "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                       formData.calendarEnabled ? "left-1" : "right-1"
                     )} />
                   </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#00a884] hover:bg-[#008f72] text-white font-bold py-3 px-10 rounded-2xl shadow-lg shadow-[#00a884]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                  עדכן פרופיל
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4">
              <Users className="w-16 h-16 stroke-[1]" />
              <p className="text-sm font-medium">בחר חבר צוות כדי לערוך את הפרופיל שלו</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
