"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.user) {
      router.push("/setup-username");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
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
            <CardTitle className="text-2xl font-black">Begin Journey</CardTitle>
            <CardDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 mt-2">
              Join the future of capital management
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <form onSubmit={handleSignup} className="space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3 text-destructive"
                >
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 px-4 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Secure Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 px-4 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-medium"
                />
                <p className="text-[10px] font-bold text-muted-foreground/40 ml-1">Must be at least 6 characters</p>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-[0.1em] shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                Create Account
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border/40 text-center">
              <p className="text-sm font-bold text-muted-foreground">
                Already on Setra?{" "}
                <Link href="/login" className="text-primary hover:underline underline-offset-4 decoration-2">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/30 font-black uppercase tracking-[0.3em] text-[10px]">
          <Sparkles className="h-3 w-3" />
          Quantum Encryption Enabled
        </div>
      </motion.div>
    </div>
  );
}
