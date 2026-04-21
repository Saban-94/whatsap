import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // חוק ברזל למאגר משוכפל: נתיבים יחסיים למניעת שגיאות 404
    base: './', 
    
    plugins: [react(), tailwindcss()],
    
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    
    build: {
      // מבטיח ניקוי של תיקיית ה-dist לפני כל בנייה
      emptyOutDir: true,
      // אופטימיזציה לשמות קבצים
      assetsDir: 'assets',
    },
    
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
