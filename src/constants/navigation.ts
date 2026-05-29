import { Home, Send, History, Receipt, Settings, CreditCard, PieChart, Users, Bell, Search, LayoutDashboard, Repeat, Zap, HandCoins } from "lucide-react";

export const NAVIGATION_ITEMS = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Send Payment",
    href: "/send",
    icon: Send,
  },
  {
    title: "Transactions",
    href: "/transactions",
    icon: History,
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
  },
  {
    title: "Tips",
    href: "/tips",
    icon: HandCoins,
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    title: "Subscriptions",
    href: "/subscriptions",
    icon: Repeat,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: PieChart,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export const SECONDARY_NAVIGATION = [
  {
    title: "Automation",
    href: "/automation",
    icon: Zap,
  },
];
