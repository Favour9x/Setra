"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useAuth } from "@/context/AuthContext";
import { useFinancial } from "@/context/FinancialContext";
import { useNotify } from "@/components/ui/notification";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2, Sparkles, AlertCircle, User } from "lucide-react";

export default function SetupUsernamePage() {
  const [usernameInput, setUsernameInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const { refreshData } = useFinancial();
  const { notify } = useNotify();
  const router = useRouter();
  const supabase = createClient();

  // Real-time availability check with debounce
  useEffect(() => {
    if (!usernameInput) {
      setAvailable(null);
      setValidationError(null);
      return;
    }

    // Rule validation
    if (!/^[a-zA-Z]/.test(usernameInput)) {
      setValidationError("Username must start with a letter");
      setAvailable(null);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameInput)) {
      setValidationError("Only letters, numbers, and underscores allowed");
      setAvailable(null);
      return;
    }

    if (usernameInput.length < 3) {
      setValidationError("Username must be at least 3 characters");
      setAvailable(null);
      return;
    }

    if (usernameInput.length > 20) {
      setValidationError("Username cannot exceed 20 characters");
      setAvailable(null);
      return;
    }

    setValidationError(null);
    setChecking(true);

    const checkUnique = setTimeout(async () => {
      try {
        const cleanUsername = usernameInput.toLowerCase().trim();
        const { data, error } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", cleanUsername)
          .maybeSingle();

        if (error) {
          console.error("Availability check failed:", error);
          setAvailable(null);
        } else if (data) {
          // Username is already taken
          setAvailable(false);
        } else {
          // Username is available
          setAvailable(true);
        }
      } catch (err) {
        console.error("Availability check exception:", err);
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => clearTimeout(checkUnique);
  }, [usernameInput, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !available || validationError) return;

    setSubmitting(true);
    const cleanUsername = usernameInput.toLowerCase().trim();
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: cleanUsername,
          username_changed_at: now
        })
        .eq("id", user.id);

      if (error) {
        console.error("Failed to save username:", error);
        notify(`Error: ${error.message}`);
        setSubmitting(false);
      } else {
        notify(`Username @${cleanUsername} successfully configured!`);
        await refreshData();
        router.push("/");
      }
    } catch (err: any) {
      console.error("Username save exception:", err);
      notify(err.message || "Failed to save username");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 md:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center mb-8 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-black text-xl">S</span>
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase opacity-90">Setra</h2>
        </div>

        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardHeader className="p-8 pb-4 text-center">
            <CardTitle className="text-2xl font-black">Choose Username</CardTitle>
            <CardDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 mt-2">
              Identify yourself across the financial web
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Unique Username
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 font-black text-lg">
                    @
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    required
                    disabled={submitting}
                    autoComplete="off"
                    className="h-12 pl-8 pr-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-black text-lg"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {checking && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
                    )}
                    {!checking && available === true && !validationError && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                        <Check className="h-4 w-4 text-emerald-500 stroke-[3px]" />
                      </div>
                    )}
                    {!checking && available === false && !validationError && (
                      <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/30">
                        <X className="h-4 w-4 text-destructive stroke-[3px]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Validation messages */}
                {validationError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-bold text-destructive/80 ml-1 flex items-center gap-1.5"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    {validationError}
                  </motion.p>
                )}
                {!validationError && available === false && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-bold text-destructive/80 ml-1 flex items-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Username is already taken
                  </motion.p>
                )}
                {!validationError && available === true && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-bold text-emerald-500 ml-1 flex items-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Username is available!
                  </motion.p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitting || !available || !!validationError}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-[0.1em] shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                Confirm Username
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/30 font-black uppercase tracking-[0.3em] text-[10px]">
          <User className="h-3 w-3" />
          Setra Decentralized Identity
        </div>
      </motion.div>
    </div>
  );
}
