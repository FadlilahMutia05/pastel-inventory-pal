import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
} from "lucide-react";
import { useStoreSettings } from "@/hooks/use-store-settings";

const navItems = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard },
  { path: "/stock", label: "Stok", icon: Package },
  { path: "/", label: "Logo", icon: null, isLogo: true },
  { path: "/sales", label: "Jual", icon: ShoppingCart },
  { path: "/settings", label: "Setting", icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();
  const { data: settings } = useStoreSettings();

  const logoUrl = settings?.logo_url;
  const logoEmoji = settings?.logo_emoji || "🎁";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          // Center logo item
          if (item.isLogo) {
            return (
              <Link
                key="home-logo"
                to="/"
                className="flex flex-col items-center justify-center -mt-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-card flex items-center justify-center overflow-hidden border-4 border-white">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{logoEmoji}</span>
                  )}
                </div>
              </Link>
            );
          }

          const Icon = item.icon!;

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
