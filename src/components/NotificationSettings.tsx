import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Volume2, 
  Vibrate, 
  Moon, 
  Clock, 
  Save, 
  ChevronLeft,
  VolumeX,
  Volume1,
  Lock
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NotificationPreferences } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationSettingsProps {
  userId: string;
  onBack?: () => void;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  sound: 'default',
  vibration: true,
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '07:00'
};

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ userId, onBack }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const docRef = doc(db, 'user_settings', userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().notifications) {
          setPreferences(docSnap.data().notifications);
        }
      } catch (err) {
        console.error("Error fetching notification preferences:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [userId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'user_settings', userId), {
        notifications: preferences,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert("העדפות התראות נשמרו בהצלחה");
    } catch (err) {
      console.error("Error saving notification preferences:", err);
      alert("שגיאה בשמירת ההעדפות");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f8f9fa]">
        <div className="w-8 h-8 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 safe-top">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#54656f] rotate-180" />
            </button>
          )}
          <Bell className="w-6 h-6 text-[#00a884]" />
          <h1 className="text-lg font-bold text-[#111b21]">העדפות התראות</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Main Toggle */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                preferences.enabled ? "bg-[#00a884]/10 text-[#00a884]" : "bg-gray-100 text-gray-400"
              )}>
                {preferences.enabled ? <Bell className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111b21]">הפעל התראות</h2>
                <p className="text-xs text-gray-500">כשזה כבוי, לא תקבל התראות Push כלל</p>
              </div>
            </div>
            <button 
              onClick={() => setPreferences(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={cn(
                "w-14 h-7 rounded-full transition-all relative overflow-hidden",
                preferences.enabled ? "bg-[#00a884]" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm",
                preferences.enabled ? "left-1" : "right-1"
              )} />
            </button>
          </div>

          <AnimatePresence>
            {preferences.enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                {/* Sound Selection */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Volume2 className="w-5 h-5 text-[#00a884]" />
                    <h2 className="text-sm font-bold text-[#111b21]">צליל התראה</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['none', 'default', 'chime'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setPreferences(prev => ({ ...prev, sound: s }))}
                        className={cn(
                          "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all",
                          preferences.sound === s 
                            ? "bg-[#00a884] border-[#00a884] text-white shadow-md shadow-[#00a884]/20" 
                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                        )}
                      >
                        {s === 'none' && <VolumeX className="w-4 h-4" />}
                        {s === 'default' && <Volume1 className="w-4 h-4" />}
                        {s === 'chime' && <Volume2 className="w-4 h-4" />}
                        {s === 'none' ? 'ללא' : s === 'default' ? 'ברירת מחדל' : 'פעמון'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vibration Toggle */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Vibrate className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#111b21]">רטט</h2>
                      <p className="text-[11px] text-gray-500">הפעל רטט בקבלת הודעות חדשות</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPreferences(prev => ({ ...prev, vibration: !prev.vibration }))}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      preferences.vibration ? "bg-orange-500" : "bg-gray-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                      preferences.vibration ? "left-1" : "right-1"
                    )} />
                  </button>
                </div>

                {/* Do Not Disturb Section */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-[#111b21]">נא לא להפריע (DND)</h2>
                        <p className="text-[11px] text-gray-500">השתק התראות בשעות מוגדרות</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setPreferences(prev => ({ ...prev, dndEnabled: !prev.dndEnabled }))}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        preferences.dndEnabled ? "bg-purple-600" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                        preferences.dndEnabled ? "left-1" : "right-1"
                      )} />
                    </button>
                  </div>

                  {preferences.dndEnabled && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 px-1">
                          <Clock className="w-3 h-3" />
                          שעת התחלה
                        </label>
                        <input 
                          type="time"
                          value={preferences.dndStart}
                          onChange={(e) => setPreferences(prev => ({ ...prev, dndStart: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 px-1">
                          <Clock className="w-3 h-3" />
                          שעת סיום
                        </label>
                        <input 
                          type="time"
                          value={preferences.dndEnd}
                          onChange={(e) => setPreferences(prev => ({ ...prev, dndEnd: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600/30"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end pt-4 pb-10">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#00a884] hover:bg-[#008f72] text-white font-bold py-3 px-12 rounded-2xl shadow-lg shadow-[#00a884]/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
              שמור העדפות
            </button>
          </div>

          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-start gap-3">
             <VolumeX className="w-5 h-5 text-red-500 shrink-0" />
             <div className="text-[11px] text-red-700 leading-relaxed">
               <strong>שימו לב:</strong> הגדרות אלו משפיעות על התראות בתוך האפליקציה ובמערכת הסימולציה. וודאו שאיציק וראמי מסונכרנים על שעות ה-DND שלהם כדי לא לפספס הזמנות דחופות.
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};
