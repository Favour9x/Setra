"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import { useAuth } from "./AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileText, 
  FileCheck, 
  RefreshCw, 
  Zap, 
  HandCoins, 
  X,
  Sparkles,
  PauseCircle,
  AlertTriangle,
  AlertOctagon,
  PiggyBank,
} from "lucide-react";

export type NotificationType = 
  | 'payment_received' 
  | 'payment_sent' 
  | 'invoice_created' 
  | 'invoice_paid' 
  | 'subscription_renewed' 
  | 'subscription_paused'
  | 'subscription_renewal_failed'
  | 'threshold_alert'
  | 'workflow_executed' 
  | 'payment_request'
  | 'savings_goal_reached';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: any;
  created_at: string;
}

interface ToastItem {
  id: string;
  notification: NotificationItem;
}

interface NotificationCenterContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterContextType | undefined>(undefined);

export function getNotificationIcon(type: NotificationType, className = "h-5 w-5") {
  switch (type) {
    case 'payment_received':
      return <ArrowDownLeft className={`${className} text-emerald-500`} />;
    case 'payment_sent':
      return <ArrowUpRight className={`${className} text-blue-500`} />;
    case 'invoice_created':
      return <FileText className={`${className} text-amber-500`} />;
    case 'invoice_paid':
      return <FileCheck className={`${className} text-emerald-500`} />;
    case 'subscription_renewed':
      return <RefreshCw className={`${className} text-indigo-500`} />;
    case 'workflow_executed':
      return <Zap className={`${className} text-purple-500`} />;
    case 'payment_request':
      return <HandCoins className={`${className} text-rose-500`} />;
    case 'subscription_paused':
      return <PauseCircle className={`${className} text-amber-500`} />;
    case 'subscription_renewal_failed':
      return <AlertTriangle className={`${className} text-red-500`} />;
    case 'threshold_alert':
      return <AlertOctagon className={`${className} text-orange-500`} />;
    case 'savings_goal_reached':
      return <PiggyBank className={`${className} text-emerald-500`} />;
    default:
      return <Bell className={`${className} text-muted-foreground`} />;
  }
}

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [supabase] = useState(() => {
    try {
      return createClient();
    } catch (err) {
      console.error('Failed to create Supabase client in NotificationCenter:', err);
      return null;
    }
  });

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (!supabase) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  const markAsRead = async (id: string) => {
    if (!user || !supabase) return;
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        // Rollback on error
        await fetchNotifications();
        throw error;
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!user || !supabase) return;
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) {
        await fetchNotifications();
        throw error;
      }
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const triggerToast = useCallback((notif: NotificationItem) => {
    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id: toastId, notification: notif }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 4000);
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !supabase) return;

    fetchNotifications();

    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          console.log("🔔 Real-time notification received:", newNotif);
          
          // Prepend to state
          setNotifications(prev => [newNotif, ...prev]);
          
          // Trigger toast
          triggerToast(newNotif);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotif = payload.new as NotificationItem;
          setNotifications(prev => 
            prev.map(n => n.id === updatedNotif.id ? updatedNotif : n)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchNotifications, triggerToast]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationCenterContext.Provider 
      value={{ 
        notifications, 
        unreadCount, 
        loading, 
        markAsRead, 
        markAllAsRead, 
        refresh: fetchNotifications 
      }}
    >
      {children}

      {/* Premium Top-Right Toast Notifications Tray */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 20, transition: { duration: 0.15 } }}
              layout
              className="pointer-events-auto"
            >
              <div
                onClick={() => {
                  const md = toast.notification.metadata;
                  if (md?.link) {
                    router.push(md.link);
                  } else if (md?.invoice_id) {
                    router.push(`/invoices/${md.invoice_id}`);
                  } else if (toast.notification.type === "payment_received" || toast.notification.type === "payment_sent") {
                    router.push("/transactions");
                  } else if (toast.notification.type === "subscription_renewed" || toast.notification.type === "subscription_paused" || toast.notification.type === "subscription_renewal_failed") {
                    router.push("/subscriptions");
                  } else if (toast.notification.type === "workflow_executed") {
                    router.push("/workflows");
                  }
                }}
                className="bg-card/90 dark:bg-card/95 backdrop-blur-md border border-border/80 shadow-premium hover:shadow-premium-hover rounded-2xl p-4 flex gap-3.5 relative overflow-hidden transition-all duration-300 group cursor-pointer"
              >
                {/* Micro-glow effect */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                
                {/* Type Icon Container */}
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center border border-border/40 shadow-inner group-hover:scale-105 transition-transform duration-300">
                  {getNotificationIcon(toast.notification.type)}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-xs font-black text-foreground tracking-tight line-clamp-1 flex items-center gap-1.5 leading-none">
                    {toast.notification.title}
                    <Sparkles className="h-3 w-3 text-primary animate-pulse flex-shrink-0" />
                  </p>
                  <p className="text-[11px] font-bold text-muted-foreground/80 leading-normal mt-1 pr-1 line-clamp-2">
                    {toast.notification.message}
                  </p>
                </div>

                {/* Close Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setToasts(prev => prev.filter(t => t.id !== toast.id));
                  }}
                  className="flex-shrink-0 self-start p-1 -mt-1 -mr-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) throw new Error("useNotificationCenter must be used within NotificationCenterProvider");
  return context;
}
