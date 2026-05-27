export type TransactionStatus = "success" | "pending" | "processing" | "failed";
export type TransactionType = "income" | "expense";

export interface TransactionStatusHistory {
  status: TransactionStatus;
  timestamp: number;
  message?: string;
}

export interface Transaction {
  id: string;
  referenceId: string;
  name: string;
  amount: number;
  status: TransactionStatus;
  type: TransactionType;
  timestamp: number;
  category: string;
  avatar?: string;
  recipientAddress?: string;
  recipientUsername?: string;
  statusHistory?: TransactionStatusHistory[];
  metadata?: any;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  type: "payment_sent" | "payment_received" | "invoice_created";
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  notificationsEnabled: boolean;
  currency: string;
  biometricEnabled: boolean;
  autoArchive: boolean;
  highContrastMode: boolean;
  multiRegion: boolean;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
}

export interface FinancialState {
  balance: number | null;
  transactions: Transaction[];
  activities: Activity[];
  invoiceCount: number;
  invoices?: any[];
  settings: UserSettings;
  profile: UserProfile;
}
