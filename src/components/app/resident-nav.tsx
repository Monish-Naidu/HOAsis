import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  FileText,
  Home,
  Landmark,
  MessageSquarePlus,
  Receipt,
  Vote,
} from "lucide-react";

interface ResidentTab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The sidebar has room for a longer name than a 63px tab does. */
  webLabel?: string;
  /** Sidebar only. The phone tab bar holds six. */
  webOnly?: boolean;
}

/** One nav definition, used by the phone tab bar and the website sidebar. */
export const residentTabs: ResidentTab[] = [
  { href: "/resident", label: "Home", icon: Home },
  { href: "/resident/pay", label: "Pay", icon: CreditCard, webLabel: "Pay dues" },
  { href: "/resident/vote", label: "Vote", icon: Vote, webLabel: "Vote and meetings" },
  { href: "/resident/requests", label: "Requests", icon: MessageSquarePlus },
  { href: "/resident/documents", label: "Docs", icon: FileText, webLabel: "Documents" },
  { href: "/resident/account", label: "Account", icon: Receipt },
  {
    href: "/resident/finances",
    label: "Funds",
    icon: Landmark,
    webLabel: "Association funds",
    webOnly: true,
  },
];
