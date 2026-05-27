import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string | undefined): string {
  if (!address) return "Unknown";
  if (address.length > 10) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  return address;
}
