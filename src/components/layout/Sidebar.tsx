import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Truck,
  ShoppingCart,
  Receipt,
  BarChart3,
  Users,
} from "lucide-react";
import logoImage from "@/assets/logo.jpg";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/stock", label: "Kelola Stok", icon: Package },
  { path: "/cargo", label: "Kargo Masuk", icon: Truck },
  { path: "/sales", label: "Penjualan", icon: ShoppingCart },
  { path: "/transactions", label: "Transaksi", icon: Receipt },
  { path: "/reports", label: "Laporan", icon: BarChart3 },
  { path: "/suppliers", label: "Supplier", icon: Users },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom branding */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src={logoImage} 
            alt="Mao~Mao Store" 
            className="w-10 h-10 rounded-xl shadow-soft object-cover"
          />
          <div>
            <p className="font-display font-bold text-sm">Mao~Mao Store</p>
            <p className="text-xs text-muted-foreground">Blindbox Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
