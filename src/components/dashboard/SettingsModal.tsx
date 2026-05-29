"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/context/FinancialContext";
import { useTheme } from "@/context/ThemeContext";
import { useNotify } from "@/components/ui/notification";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import {
  User, 
  Bell, 
  Shield, 
  Moon, 
  Sun, 
  Monitor, 
  LogOut, 
  Save,
  Globe,
  Wallet,
  Loader2,
  X,
  Check,
  Copy,
  CheckCircle2 as CheckIcon
} from "lucide-react";

export function SettingsModal() {
  const { settings, updateSettings, profile, updateProfile, isSettingsOpen, setSettingsOpen, walletAddress, walletId, username, usernameChangedAt, refreshData } = useFinancial();
  const { user, signOut } = useAuth();
  const { notify } = useNotify();
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const supabase = React.useMemo(() => createClient(), []);

  // Username edit states
  const [newUsername, setNewUsername] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [updatingUsername, setUpdatingUsername] = useState(false);

  // Initialize username input
  useEffect(() => {
    if (isSettingsOpen && username) {
      setNewUsername(username);
    }
  }, [isSettingsOpen, username]);

  // Username restriction calculations
  const changedDate = usernameChangedAt ? new Date(usernameChangedAt) : null;
  const nextChangeDate = changedDate ? new Date(changedDate.getTime() + 90 * 24 * 60 * 60 * 1000) : null;
  const cannotChangeYet = nextChangeDate ? new Date() < nextChangeDate : false;
  const nextChangeDateFormatted = nextChangeDate ? nextChangeDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : "";

  // Real-time username validation and availability check
  useEffect(() => {
    if (!newUsername || newUsername === username) {
      setUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    if (!/^[a-zA-Z]/.test(newUsername)) {
      setUsernameError("Must start with a letter");
      setUsernameAvailable(null);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setUsernameError("Letters, numbers, underscores only");
      setUsernameAvailable(null);
      return;
    }

    if (newUsername.length < 3) {
      setUsernameError("Min 3 characters");
      setUsernameAvailable(null);
      return;
    }

    if (newUsername.length > 20) {
      setUsernameError("Max 20 characters");
      setUsernameAvailable(null);
      return;
    }

    setUsernameError(null);
    setCheckingUsername(true);

    const checkUnique = setTimeout(async () => {
      try {
        const cleanName = newUsername.toLowerCase().trim();
        const { data, error } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", cleanName)
          .maybeSingle();

        if (error) {
          setUsernameAvailable(null);
        } else if (data) {
          setUsernameAvailable(false);
        } else {
          setUsernameAvailable(true);
        }
      } catch (err) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(checkUnique);
  }, [newUsername, username, supabase]);

  const handleUpdateUsername = async () => {
    if (!user || !usernameAvailable || usernameError || updatingUsername) return;
    
    setUpdatingUsername(true);
    try {
      const { data: profileRecord, error: profileErr } = await supabase
        .from("profiles")
        .select("username_changed_at")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profileErr) {
        notify(`Verification error: ${profileErr.message}`);
        setUpdatingUsername(false);
        return;
      }
      
      if (profileRecord?.username_changed_at) {
        const lastChanged = new Date(profileRecord.username_changed_at);
        const allowDate = new Date(lastChanged.getTime() + 90 * 24 * 60 * 60 * 1000);
        if (new Date() < allowDate) {
          const formattedDate = allowDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          notify(`You can change your username on ${formattedDate}`);
          setUpdatingUsername(false);
          return;
        }
      }
      
      const cleanName = newUsername.toLowerCase().trim();
      const now = new Date().toISOString();
      
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          username: cleanName,
          username_changed_at: now
        })
        .eq("id", user.id);
        
      if (updateErr) {
        notify(`Update failed: ${updateErr.message}`);
      } else {
        notify("Username successfully updated!");
        await refreshData();
      }
    } catch (err: any) {
      notify(err.message || "Failed to update username");
    } finally {
      setUpdatingUsername(false);
    }
  };

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      notify("Wallet address copied to clipboard");
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // Local state for profile form to prevent excessive renders
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalProfile(profile);
    }
  }, [isSettingsOpen, profile]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    if (isSettingsOpen) {
      window.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isSettingsOpen, setSettingsOpen]);

  const handleSave = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    updateProfile(localProfile);
    notify("Profile updated and synchronized");
    setLoading(false);
  };

  const { setThemeMode } = useTheme();

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    updateSettings({ theme });
    setThemeMode(theme);
    notify(`Interface adjusted to ${theme} mode`);
  };

  const toggleNotifications = () => {
    updateSettings({ notificationsEnabled: !settings.notificationsEnabled });
    notify(settings.notificationsEnabled ? "Alerts silenced" : "Real-time alerts enabled");
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full h-full md:h-auto max-w-4xl md:max-h-[95vh] bg-card border-none md:border shadow-premium md:rounded-[2.5rem] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-8 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-foreground uppercase italic underline decoration-primary decoration-4 underline-offset-8">Configuration</h2>
                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.3em] mt-3">Identity • Interface • Security</p>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl h-10 w-10 border-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-12 pb-24">
              <div className="grid gap-12 lg:grid-cols-2">
                {/* Profile Section */}
                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Personal Identification</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-6 p-4 rounded-3xl bg-muted/20 border border-border/40">
                      <div className="relative group overflow-hidden w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-black text-primary border-2 border-primary/20">
                        {localProfile.avatar ? (
                          <img src={localProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          `${localProfile.firstName[0] || ""}${localProfile.lastName[0] || ""}`
                        )}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-[10px] font-black text-white uppercase backdrop-blur-sm">
                          Upload
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setLocalProfile({ ...localProfile, avatar: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }} 
                          />
                        </label>
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-black text-lg text-foreground tracking-tight">{localProfile.firstName} {localProfile.lastName}</h4>
                        <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60 tracking-[0.2em]">{user?.email || "verified_user"}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-2">Given Name</Label>
                          <Input 
                            value={localProfile.firstName} 
                            onChange={(e) => setLocalProfile({ ...localProfile, firstName: e.target.value })}
                            className="h-12 rounded-xl bg-muted/40 border-none focus-visible:ring-primary/20 font-bold" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-2">Surname</Label>
                          <Input 
                            value={localProfile.lastName} 
                            onChange={(e) => setLocalProfile({ ...localProfile, lastName: e.target.value })}
                            className="h-12 rounded-xl bg-muted/40 border-none focus-visible:ring-primary/20 font-bold" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-2">Contact Email</Label>
                        <Input 
                            value={localProfile.email} 
                            onChange={(e) => setLocalProfile({ ...localProfile, email: e.target.value })}
                            className="h-12 rounded-xl bg-muted/40 border-none focus-visible:ring-primary/20 font-bold" 
                        />
                      </div>
                      
                      {/* Username change system */}
                      <div className="space-y-3 pt-4 border-t border-border/40">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-2">Unique Username</Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 font-black text-sm">
                            @
                          </span>
                          <Input 
                            value={newUsername} 
                            disabled={cannotChangeYet || updatingUsername}
                            onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                            placeholder="username"
                            className="h-12 pl-8 pr-12 rounded-xl bg-muted/40 border-none focus-visible:ring-primary/20 font-bold" 
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {checkingUsername && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
                            )}
                            {!checkingUsername && usernameAvailable === true && !usernameError && (
                              <Check className="h-4 w-4 text-emerald-500 stroke-[3px]" />
                            )}
                            {!checkingUsername && usernameAvailable === false && !usernameError && (
                              <X className="h-4 w-4 text-destructive stroke-[3px]" />
                            )}
                          </div>
                        </div>

                        {/* Display message if cannot change yet (90 day lock) */}
                        {cannotChangeYet && (
                          <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider ml-2 bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10">
                            🔒 You can change your username on {nextChangeDateFormatted}
                          </p>
                        )}

                        {/* Real-time validation/availability labels */}
                        {!cannotChangeYet && usernameError && (
                          <p className="text-[10px] font-bold text-destructive/80 ml-2">
                            ⚠️ {usernameError}
                          </p>
                        )}
                        {!cannotChangeYet && !usernameError && usernameAvailable === false && (
                          <p className="text-[10px] font-bold text-destructive/80 ml-2">
                            ❌ Username is taken
                          </p>
                        )}
                        {!cannotChangeYet && !usernameError && usernameAvailable === true && (
                          <p className="text-[10px] font-bold text-emerald-500 ml-2">
                            ✨ Username is available!
                          </p>
                        )}

                        {/* Save button for username */}
                        {!cannotChangeYet && newUsername !== username && usernameAvailable === true && (
                          <Button
                            onClick={handleUpdateUsername}
                            disabled={updatingUsername || !usernameAvailable || !!usernameError}
                            className="w-full h-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-black text-[10px] uppercase tracking-wider transition-all mt-2"
                          >
                            {updatingUsername ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              "Update Username"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Appearance Section */}
                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Aesthetic Interface</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: "light", icon: Sun, label: "Day" },
                      { id: "dark", icon: Moon, label: "Night" },
                      { id: "system", icon: Monitor, label: "Auto" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleThemeChange(item.id as any)}
                        className={`flex flex-col items-center gap-4 p-5 rounded-[2rem] border-2 transition-all duration-300 group ${
                          settings.theme === item.id 
                            ? "border-primary bg-primary/5 shadow-inner" 
                            : "border-transparent bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                          settings.theme === item.id ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "bg-card text-muted-foreground group-hover:scale-110 group-hover:text-foreground"
                        }`}>
                          <item.icon className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Wallet Information */}
                <section className="space-y-8 lg:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Wallet Information</h3>
                  </div>
                  
                  {walletAddress && (
                    <div className="p-6 rounded-[2rem] bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Wallet className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">Circle Wallet</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Connected & Verified</p>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                          Active
                        </div>
                      </div>
                      <div className="space-y-3 mt-4">
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Wallet Address</p>
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-background/50">
                            <p className="text-xs font-mono text-foreground flex-1 truncate">{walletAddress}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={copyWalletAddress}
                              className="h-8 w-8 rounded-lg hover:bg-primary/10 flex-shrink-0"
                            >
                              {copiedAddress ? (
                                <CheckIcon className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Network</p>
                            <p className="text-xs font-bold text-foreground">Arc Testnet</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Environment</p>
                            <p className="text-xs font-bold text-foreground">Sandbox</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-6 rounded-[2rem] bg-muted/10 border border-border/40 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-black uppercase tracking-widest">Real-time Notifications</p>
                            <p className="text-[10px] font-bold text-muted-foreground/60">Receive alerts for transactions and invoices</p>
                        </div>
                        <div 
                          onClick={toggleNotifications}
                          className={cn("h-6 w-11 rounded-full relative p-1 cursor-pointer transition-colors duration-300", settings.notificationsEnabled ? "bg-primary" : "bg-muted-foreground/20")}>
                          <div className={cn("h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300", settings.notificationsEnabled ? "translate-x-5" : "translate-x-0")} />
                        </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 p-8 border-t bg-card/80 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <Button 
                variant="ghost" 
                onClick={async () => {
                  setSigningOut(true);
                  await new Promise(r => setTimeout(r, 800));
                  await signOut();
                  setSigningOut(false);
                  setSettingsOpen(false);
                }}
                disabled={signingOut}
                className="w-full sm:w-auto text-rose-600 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-700 transition-all rounded-xl h-11 px-6 shadow-sm border-2 border-rose-100 flex items-center justify-center"
              >
                {signingOut ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
                Terminate Session
              </Button>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => setSettingsOpen(false)}
                  className="flex-1 sm:flex-none rounded-2xl h-12 px-8 font-black text-[10px] uppercase tracking-widest border-2"
                >
                   Discard
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 sm:flex-none h-12 px-10 rounded-2xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Finalize Config
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
