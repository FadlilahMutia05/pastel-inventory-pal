import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Truck,
  ShoppingCart,
  BarChart3,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard },
  { path: "/stock", label: "Stok", icon: Package },
  { path: "/cargo", label: "Kargo", icon: Truck },
  { path: "/sales", label: "Jual", icon: ShoppingCart },
  { path: "/reports", label: "Laporan", icon: BarChart3 },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all",
                  isActive && "bg-pink-light"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
