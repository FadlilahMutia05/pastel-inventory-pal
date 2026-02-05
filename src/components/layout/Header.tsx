import { Bell, TrendingUp, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { useStoreSettings } from "@/hooks/use-store-settings";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  // Query for low stock products
  const { data: lowStockProducts } = useQuery({
    queryKey: ["low-stock-products"],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, sku, low_stock_threshold")
        .eq("is_active", true);

      if (error) throw error;

      // Get total stock per product from batches
      const productsWithStock = await Promise.all(
        (products || []).map(async (product) => {
          const { data: batches } = await supabase
            .from("product_batches")
            .select("remaining_quantity")
            .eq("product_id", product.id);

          const totalStock = (batches || []).reduce(
            (sum, b) => sum + (b.remaining_quantity || 0),
            0
          );

          return {
            ...product,
            totalStock,
            isLow: totalStock <= product.low_stock_threshold,
          };
        })
      );

      return productsWithStock.filter((p) => p.isLow);
    },
  });

  // Query for today's profit
  const { data: todayProfit } = useQuery({
    queryKey: ["today-profit"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("sales_transactions")
        .select("total_profit")
        .gte("transaction_date", today.toISOString())
        .not("status", "eq", "cancelled");

      if (error) throw error;

      return (data || []).reduce((sum, t) => sum + (t.total_profit || 0), 0);
    },
  });

  const lowStockCount = lowStockProducts?.length || 0;
  const { data: settings } = useStoreSettings();

  const storeName = settings?.store_name || "Mao~Mao Store";
  const logoUrl = settings?.logo_url;
  const logoEmoji = settings?.logo_emoji || "🎁";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-lavender-light border-b border-border backdrop-blur-lg bg-opacity-90">
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        {/* Left - Logo & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-xl bg-white shadow-soft flex items-center justify-center overflow-hidden hover:shadow-card transition-shadow cursor-pointer"
            title="Kembali ke Beranda"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">{logoEmoji}</span>
            )}
          </button>
          <div className="hidden sm:block">
            <h1 className="font-display font-bold text-lg text-foreground">
              {storeName}
            </h1>
          </div>
        </div>

        {/* Right - Stats & Notifications */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Today's Profit - Desktop */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-mint-light">
            <TrendingUp className="w-4 h-4 text-success-foreground" />
            <span className="text-sm font-medium text-success-foreground">
              Profit Hari Ini
            </span>
            <span className="font-bold text-success-foreground">
              {formatCurrency(todayProfit || 0)}
            </span>
          </div>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-xl bg-white shadow-soft hover:bg-white/80"
              >
                <Bell className="w-5 h-5 text-foreground" />
                {lowStockCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
                  >
                    {lowStockCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Notifikasi</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {lowStockCount > 0 ? (
                  <div className="divide-y divide-border">
                    {lowStockProducts?.map((product) => (
                      <div
                        key={product.id}
                        className="p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-warning-light flex items-center justify-center">
                            <span>⚠️</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Stok Menipis</p>
                            <p className="text-sm text-muted-foreground">
                              {product.name} ({product.sku}) - Sisa{" "}
                              {product.totalStock} pcs
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>Tidak ada notifikasi</p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
