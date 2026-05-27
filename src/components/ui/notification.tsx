"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

type NotificationType = "success" | "error" | "info";

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notify: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((message: string, type: NotificationType = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const remove = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto"
            >
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
                n.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
                n.type === "error" ? "bg-rose-50 border-rose-100 text-rose-800" :
                "bg-blue-50 border-blue-100 text-blue-800"
              }`}>
                {n.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                {n.type === "error" && <XCircle className="h-5 w-5 text-rose-500" />}
                {n.type === "info" && <AlertCircle className="h-5 w-5 text-blue-500" />}
                <p className="text-sm font-semibold">{n.message}</p>
                <button onClick={() => remove(n.id)} className="ml-2 hover:opacity-70 transition-opacity">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotify must be used within NotificationProvider");
  return context;
}
