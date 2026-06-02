"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus, Trash2, Loader2, Users, Wallet, X, AlertTriangle, Copy, Send,
} from "lucide-react";
import { useNotify } from "@/components/ui/notification";
import Link from "next/link";

interface Beneficiary {
  id: string;
  recipient_tag: string | null;
  recipient_address: string;
  recipient_avatar: string | null;
  created_at: string;
}

function formatAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function getInitials(tag: string | null): string {
  if (!tag) return "?";
  return tag.slice(0, 2).toUpperCase();
}

export default function BeneficiariesPage() {
  const { notify } = useNotify();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchBeneficiaries();
  }, []);

  async function fetchBeneficiaries() {
    setLoading(true);
    try {
      const res = await fetch("/api/beneficiaries", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setBeneficiaries(data.beneficiaries);
      }
    } catch { } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`/api/beneficiaries/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setBeneficiaries(prev => prev.filter(b => b.id !== id));
        notify("Beneficiary removed");
      } else {
        notify("Failed to remove beneficiary");
      }
    } catch {
      notify("Failed to remove beneficiary");
    } finally {
      setRemoving(null);
      setConfirmId(null);
    }
  }

  async function handleCopy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      notify("Address copied");
    } catch {
      notify("Failed to copy");
    }
  }

  return (
    <div className="space-y-8 pb-12 px-4 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground text-pretty">Beneficiaries</h1>
            <p className="text-sm text-muted-foreground font-semibold mt-0.5">
              Saved recipients for quick payments
            </p>
          </div>
        </div>
        <Link href="/send">
          <Button className="h-11 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            New Payment
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : beneficiaries.length === 0 ? (
        <Card className="border-none shadow-premium bg-card overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-black text-foreground">No Beneficiaries Yet</h3>
            <p className="text-sm text-muted-foreground font-semibold mt-1 max-w-sm">
              Save recipients you pay frequently to quickly send payments without typing addresses.
            </p>
            <Link href="/send">
              <Button className="mt-8 h-11 rounded-xl font-bold shadow-lg shadow-primary/20">
                <Send className="h-4 w-4 mr-2" />
                Send a Payment
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {beneficiaries.map((b, idx) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Card className="border-none shadow-premium bg-card overflow-hidden group relative">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary flex-shrink-0">
                        {b.recipient_avatar ? (
                          <img src={b.recipient_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(b.recipient_tag)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {b.recipient_tag || "Unknown"}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">
                          {formatAddress(b.recipient_address)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmId(confirmId === b.id ? null : b.id)}
                      className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                      title="Remove beneficiary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg text-xs font-bold flex-1"
                      onClick={() => handleCopy(b.recipient_address)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy
                    </Button>
                    <Link href={`/send?address=${encodeURIComponent(b.recipient_tag ? `@${b.recipient_tag}` : b.recipient_address)}`} className="flex-1">
                      <Button
                        size="sm"
                        className="h-8 rounded-lg text-xs font-bold w-full"
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Send
                      </Button>
                    </Link>
                  </div>

                  {/* Remove confirmation */}
                  <AnimatePresence>
                    {confirmId === b.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 pt-3 border-t border-border/30 mt-3">
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                          <p className="text-xs font-semibold text-destructive/80 flex-1">Remove this beneficiary?</p>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-md text-xs"
                              onClick={() => setConfirmId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 rounded-md text-xs"
                              disabled={removing === b.id}
                              onClick={() => handleRemove(b.id)}
                            >
                              {removing === b.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Remove"
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
