import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Get current page title
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/dashboard":
        return "Dashboard";
      case "/stock":
        return "Kelola Stok";
      case "/cargo":
        return "Kargo Masuk";
      case "/sales":
        return "Penjualan";
      case "/transactions":
        return "Transaksi";
      case "/reports":
        return "Laporan";
      case "/suppliers":
        return "Supplier";
      default:
        return "Mao~Mao Store";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header title={getPageTitle()} />

      <div className="flex">
        {/* Sidebar - Desktop only */}
        {!isMobile && <Sidebar />}

        {/* Main content */}
        <main className={`flex-1 ${isMobile ? "pb-20" : "ml-64"} pt-16`}>
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Navigation - Mobile only */}
      {isMobile && <BottomNav />}
    </div>
  );
}
