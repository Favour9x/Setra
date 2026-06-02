"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Search, Menu, User, Settings as SettingsIcon, LogOut, ChevronDown, RefreshCw, QrCode, Camera, X, ScanLine, Download, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Sidebar } from "./Sidebar";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useFinancial } from "@/context/FinancialContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useNotificationCenter, getNotificationIcon } from "@/context/NotificationCenterContext";
import { Html5Qrcode } from "html5-qrcode";
import { useNotify } from "@/components/ui/notification";
import { QRCode } from "react-qr-code";
import { useTheme } from "@/context/ThemeContext";

export function Navbar() {
  const { isLoaded, setSettingsOpen, refreshData, refreshBalance, profile, username, walletAddress, balance } = useFinancial();
  const { user } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationCenter();
  const { notify } = useNotify();
  const { theme, toggle: toggleTheme } = useTheme();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);
  
  const userInitial = profile.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U";
  const userName = `${profile.firstName} ${profile.lastName}`.trim() || user?.email?.split("@")[0] || "User";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalance();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startQRScanner = async () => {
    if (!scannerDivRef.current) return;
    
    try {
      const scanner = new Html5Qrcode("navbar-qr-reader");
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopQRScanner();
          notify("QR code scanned successfully!");
          router.push(`/send?address=${encodeURIComponent(decodedText)}`);
        },
        () => {}
      );
    } catch (err: any) {
      notify("Failed to start camera: " + err.message);
      setShowQRScanner(false);
    }
  };

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {}
    }
    setShowQRScanner(false);
  };

  const downloadMyQR = () => {
    const svg = document.getElementById("navbar-my-qr-code");
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      
      const downloadLink = document.createElement("a");
      downloadLink.download = "setra-wallet-qr.png";
      downloadLink.href = pngFile;
      downloadLink.click();
      
      notify("QR code downloaded!");
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  // Close panel on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    return `${days}d ago`;
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-10 gap-4 justify-between">
        <div className="flex items-center gap-4 md:gap-10 flex-1">
        </div>

        <div className="flex items-center gap-3">
          {/* My QR Code Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowMyQR(true)}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            title="My QR Code"
          >
            <QrCode className="h-5 w-5" />
          </Button>

          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Scan QR Code Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setShowQRScanner(true);
              setTimeout(() => startQRScanner(), 100);
            }}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            title="Scan QR Code"
          >
            <ScanLine className="h-5 w-5" />
          </Button>

          {/* Notifications Dropdown Container */}
          <div className="relative" ref={panelRef}>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setPanelOpen(!panelOpen)}
              className={`relative h-10 w-10 rounded-xl transition-all ${
                panelOpen 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white border-2 border-background animate-in zoom-in duration-200">
                  {unreadCount}
                </span>
              )}
            </Button>

            <AnimatePresence>
              {panelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-96 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-premium p-4 z-50 text-left"
                >
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <p className="text-sm font-black text-foreground">Notifications</p>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] font-bold text-primary hover:underline hover:opacity-80 transition-all cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Dropdown Content */}
                  <div className="mt-3 max-h-[350px] overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                          <Bell className="h-5 w-5 text-muted-foreground/60" />
                        </div>
                        <p className="text-xs font-black text-foreground">No notifications yet</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[200px]">We'll let you know when something important happens.</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id}
                          onClick={() => {
                            if (!n.read) markAsRead(n.id);
                            setPanelOpen(false);
                            
                            // Navigate using metadata link if available, otherwise fallback to type-based routing
                            if (n.metadata?.link) {
                              router.push(n.metadata.link);
                            } else if (n.metadata?.invoice_id) {
                              router.push(`/invoices/${n.metadata.invoice_id}`);
                            } else if (n.type === "payment_received" || n.type === "payment_sent") {
                              router.push("/transactions");
                            } else if (n.type === "subscription_renewed" || n.type === "subscription_paused" || n.type === "subscription_renewal_failed") {
                              router.push("/subscriptions");
                            } else if (n.type === "workflow_executed") {
                              router.push("/workflows");
                            }
                          }}
                          className={`flex gap-3 p-3 rounded-xl hover:bg-muted/40 transition-all text-left cursor-pointer relative ${
                            n.read 
                              ? 'opacity-65 bg-transparent' 
                              : 'bg-muted/10 border border-border/20 shadow-sm'
                          }`}
                        >
                          {/* Unread indicator */}
                          {!n.read && (
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          )}
                          
                          {/* Icon */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center ${!n.read ? 'ml-2' : ''}`}>
                            {getNotificationIcon(n.type, "h-4 w-4")}
                          </div>

                          {/* Message block */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-foreground leading-tight">{n.title}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1 leading-normal pr-1">{n.message}</p>
                            <p className="text-[8px] font-bold text-muted-foreground/50 mt-1.5 uppercase tracking-wider">
                              {formatTimeAgo(n.created_at)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSettingsOpen(true)}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
          
          <Separator orientation="vertical" className="h-8 mx-1 opacity-40 hidden sm:block" />
          
          <motion.div 
            whileHover={{ x: 2 }}
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 cursor-pointer group pl-2"
          >
            <div className="hidden text-right sm:block">
              <p className="text-sm font-black leading-none group-hover:text-primary transition-colors">
                {username ? `@${username}` : userName}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider opacity-60">Personal account</p>
            </div>
            <div className="relative">
              <Avatar className="h-10 w-10 border-2 border-transparent group-hover:border-primary/30 transition-all shadow-soft group-hover:shadow-premium">
                {profile.avatar && <AvatarImage src={profile.avatar} />}
                <AvatarFallback className="font-black text-xs">{userInitial}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background shadow-lg items-center justify-center hidden md:flex">
                <ChevronDown className="h-2 w-2 text-white" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* My QR Code Modal */}
      <AnimatePresence>
        {showMyQR && walletAddress && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMyQR(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-card border border-border/30 rounded-3xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tight">My QR Code</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setShowMyQR(false)} className="rounded-xl hover:bg-muted">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="p-4 bg-white rounded-xl">
                    <QRCode 
                      id="navbar-my-qr-code"
                      value={walletAddress} 
                      size={220}
                      level="H"
                    />
                  </div>
                  <p className="text-sm font-bold text-center">
                    Scan to pay {username ? `@${username}` : "me"}
                  </p>
                  <Button
                    onClick={downloadMyQR}
                    variant="outline"
                    className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download QR Code
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showQRScanner && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={stopQRScanner}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-card border border-border/30 rounded-3xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Scan QR Code</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={stopQRScanner} className="rounded-xl hover:bg-muted">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div id="navbar-qr-reader" ref={scannerDivRef} className="w-full rounded-xl overflow-hidden"></div>
                <p className="text-xs text-muted-foreground text-center">
                  Position the QR code within the frame to scan
                </p>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
