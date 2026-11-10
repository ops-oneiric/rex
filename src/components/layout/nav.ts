import {
  AlertTriangle,
  CalendarCheck,
  Building2,
  LayoutDashboard,
  LineChart,
  Settings,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const mainNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/assign", label: "Assign", icon: UserRoundPlus },
  { href: "/associates", label: "Associates", icon: Users },
  { href: "/cadence", label: "Cadence", icon: CalendarCheck },
  { href: "/escalations", label: "Escalations", icon: AlertTriangle },
  { href: "/insights", label: "Insights", icon: LineChart },
];

export const footerNav: NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];
