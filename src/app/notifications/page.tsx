"use client";

import React, { useState, useMemo } from "react";
import { useNotificationCenter, getNotificationIcon, type NotificationType } from "@/context/NotificationCenterContext";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Filter, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "motion/react";

const FILTER_OPTIONS: { label: string; value: NotificationType | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Received", value: "payment_received" },
  { label: "Sent", value: "payment_sent" },
  { label: "Invoices", value: "invoice_created" },
  { label: "Paid", value: "invoice_paid" },
  { label: "Subscriptions", value: "subscription_renewed" },
  { label: "Auto-Paused", value: "subscription_paused" },
  { label: "Payment Failed", value: "subscription_renewal_failed" },
  { label: "Threshold Alert", value: "threshold_alert" },
  { label: "Workflows", value: "workflow_executed" },
  { label: "Requests", value: "payment_request" },
];

const ITEMS_PER_PAGE = 20;

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } = useNotificationCenter();
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationType | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const items = filter === "ALL" ? notifications : notifications.filter(n => n.type === filter);
    return items;
  }, [notifications, filter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice(0, page * ITEMS_PER_PAGE);

  const handleClick = (n: typeof notifications[number]) => {
    if (!n.read) markAsRead(n.id);
    const md = n.metadata;
    if (md?.link) {
      router.push(md.link);
    } else if (md?.invoice_id) {
      router.push(`/invoices/${md.invoice_id}`);
    } else if (n.type === "payment_received" || n.type === "payment_sent") {
      router.push("/transactions");
    } else if (n.type === "subscription_renewed") {
      router.push("/subscriptions");
    } else if (n.type === "workflow_executed") {
      router.push("/workflows");
    }
  };

  return (
    <div className="space-y-6 pb-12 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${filtered.length} notification${filtered.length !== 1 ? "s" : ""}`}
            {unreadCount > 0 && (
              <span className="ml-1.5">· <span className="font-semibold text-foreground">{unreadCount} unread</span></span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="h-9 text-xs gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={refresh} className="h-9 text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setFilter(opt.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              filter === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
            {opt.value !== "ALL" && (
              <span className="ml-1.5 opacity-60">
                ({notifications.filter(n => n.type === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Activity
            </CardTitle>
            {page < totalPages && (
              <span className="text-xs text-muted-foreground">
                Showing {paged.length} of {filtered.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="font-semibold text-foreground">
                {filter === "ALL" ? "No notifications yet" : "No notifications of this type"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                {filter === "ALL"
                  ? "We'll let you know when something important happens."
                  : "Try a different filter to see more."}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/40">
                <AnimatePresence mode="popLayout">
                  {paged.map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                      onClick={() => handleClick(n)}
                      className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-muted/20 ${
                        n.read ? "" : "bg-primary/[0.02]"
                      }`}
                    >
                      {/* Unread dot */}
                      <div className="flex-shrink-0 pt-0.5 w-4 flex justify-center">
                        {!n.read && (
                          <span className="block w-2 h-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>

                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
                        n.read
                          ? "bg-muted/30 border-border/40"
                          : "bg-muted/50 border-border/60 shadow-sm"
                      }`}>
                        {getNotificationIcon(n.type, "h-5 w-5")}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-sm leading-tight ${
                              n.read ? "text-foreground/70" : "text-foreground font-semibold"
                            }`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 leading-normal max-w-xl">
                              {n.message}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap"
                                  title={formatFullDate(n.created_at)}>
                              <Clock className="h-3 w-3 inline mr-0.5 -mt-0.5" />
                              {formatTimeAgo(n.created_at)}
                            </span>
                            {!n.read && (
                              <button
                                onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                                className="text-[10px] font-bold text-primary hover:underline flex-shrink-0"
                              >
                                Read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Load More */}
              {page < totalPages && (
                <div className="px-6 py-4 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    className="w-full h-10 text-xs gap-1.5"
                  >
                    Show {Math.min(ITEMS_PER_PAGE, filtered.length - paged.length)} more
                    <ArrowLeft className="h-3 w-3 rotate-90" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
