"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, X, Loader2, User, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, resolvedAddress: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RecipientInput({
  value,
  onChange,
  onValidationChange,
  placeholder = "Enter @username or 0x address",
  disabled = false,
  className,
}: RecipientInputProps) {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isUsernameMode, setIsUsernameMode] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Store validation callback in a ref to prevent infinite rendering loops
  const onValidationChangeRef = useRef(onValidationChange);
  useEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);

  // Validate Ethereum address pattern
  const isValidEthAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  useEffect(() => {
    if (!value) {
      setStatus("idle");
      setResolvedAddress(null);
      setMessage(null);
      setIsUsernameMode(false);
      onValidationChangeRef.current?.(false, null);
      return;
    }

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const trimmedValue = value.trim();

    // 1. Detection logic
    // If input starts with @ or contains no 0x prefix → treat as username
    const isUsername = trimmedValue.startsWith("@") || !trimmedValue.toLowerCase().startsWith("0x");
    setIsUsernameMode(isUsername);

    if (isUsername) {
      // Clear error immediately when user starts typing
      setMessage(null);
      setResolvedAddress(null);
      onValidationChangeRef.current?.(false, null);
      
      // Show loading state while debouncing
      setStatus("loading");

      // Debounce username resolution API call
      debounceTimer.current = setTimeout(async () => {
        try {
          const cleanUsername = trimmedValue.startsWith("@") ? trimmedValue.slice(1) : trimmedValue;
          
          if (!cleanUsername) {
            setStatus("invalid");
            setMessage("Invalid username format");
            onValidationChangeRef.current?.(false, null);
            return;
          }

          const response = await fetch(`/api/user/resolve?username=${encodeURIComponent(cleanUsername)}`);
          if (!response.ok) {
            throw new Error("Failed to resolve user");
          }

          const data = await response.json();
          if (data.success && data.found && data.walletAddress) {
            setStatus("valid");
            setResolvedAddress(data.walletAddress);
            setMessage(`@${data.username} found`);
            onValidationChangeRef.current?.(true, data.walletAddress);
          } else {
            setStatus("invalid");
            setResolvedAddress(null);
            setMessage("User not found on Setra");
            onValidationChangeRef.current?.(false, null);
          }
        } catch (error) {
          console.error("Error resolving username:", error);
          setStatus("invalid");
          setMessage("Error querying user directory");
          onValidationChangeRef.current?.(false, null);
        }
      }, 500);
    } else {
      // 2. Wallet address validation logic
      const isValid = isValidEthAddress(trimmedValue);
      if (isValid) {
        setStatus("valid");
        setResolvedAddress(trimmedValue);
        setMessage(null);
        onValidationChangeRef.current?.(true, trimmedValue);
      } else {
        setStatus("invalid");
        setResolvedAddress(null);
        setMessage("Invalid wallet address");
        onValidationChangeRef.current?.(false, null);
      }
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="relative flex items-center">
        {/* Left icon context */}
        <div className="absolute left-3.5 text-muted-foreground/50">
          {isUsernameMode ? (
            <User className="h-4.5 w-4.5 transition-colors" />
          ) : (
            <Wallet className="h-4.5 w-4.5 transition-colors" />
          )}
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "w-full h-11 pl-10 pr-12 text-sm font-semibold rounded-xl bg-muted/20 border border-border/40 focus:border-primary/45 focus:outline-none transition-all placeholder:text-muted-foreground/45",
            status === "valid" && "border-emerald-500/30 focus:border-emerald-500/50",
            status === "invalid" && "border-destructive/30 focus:border-destructive/50",
            disabled && "opacity-50 cursor-not-allowed bg-muted/40"
          )}
        />

        {/* Right status icon */}
        <div className="absolute right-3.5 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Loader2 className="h-4.5 w-4.5 animate-spin text-muted-foreground/60" />
              </motion.div>
            )}

            {status === "valid" && (
              <motion.div
                key="valid"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"
              >
                <Check className="h-3 w-3 text-emerald-500 stroke-[3.5px]" />
              </motion.div>
            )}

            {status === "invalid" && (
              <motion.div
                key="invalid"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20"
              >
                <X className="h-3 w-3 text-destructive stroke-[3.5px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Helper validation messages */}
      <AnimatePresence>
        {(message || resolvedAddress) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="px-1.5 space-y-1"
          >
            {message && (
              <p
                className={cn(
                  "text-xs font-bold transition-all",
                  status === "valid" ? "text-emerald-500" : "text-destructive/80"
                )}
              >
                {message}
              </p>
            )}
            
            {status === "valid" && resolvedAddress && isUsernameMode && (
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground/70">
                <span className="font-bold uppercase tracking-wider text-[9px] bg-muted/65 px-1.5 py-0.5 rounded text-muted-foreground/60 border border-border/20">
                  Resolved Address:
                </span>
                <span className="font-mono bg-muted/20 px-1 py-0.5 rounded text-muted-foreground/80">
                  {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-6)}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
