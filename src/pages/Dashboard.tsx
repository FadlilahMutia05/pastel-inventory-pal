import AppLayout from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Package,
  Archive,
  Truck,
  TrendingUp,
  Calendar,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Ship,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay: number;
}

const StatCard = ({ title, value, icon, color, delay }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1, duration: 0.5 }}
  >
    <Card className={`glass-card hover:shadow-glow transition-all duration-300 hover:-translate-y-1 ${color}`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-xl md:text-2xl font-bold">{value}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const CHART_COLORS = [
  "hsl(340, 80%, 70%)", // pink
  "hsl(270, 60%, 80%)", // lavender
  "hsl(165, 60%, 75%)", // mint
  "hsl(200, 80%, 80%)", // sky
  "hsl(25, 90%, 85%)", // peach
];

export default function Dashboard() {
  // Query: Total products
  const { data: totalProducts } = useQuery({
    queryKey: ["total-products"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count || 0;
    },
  });

  // Query: Total stock
  const { data: totalStock } = useQuery({
    queryKey: ["total-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_batches")
        .select("remaining_quantity");
      if (error) throw error;
      return (data || []).reduce((sum, b) => sum + (b.remaining_quantity || 0), 0);
    },
  });

  // Query: Floating asset (value of OTW cargo)
  const { data: floatingAsset } = useQuery({
    queryKey: ["floating-asset"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargo_shipments")
        .select("total_value")
        .in("status", ["ordered", "shipped", "customs"]);
      if (error) throw error;
      return (data || []).reduce((sum, c) => sum + (c.total_value || 0), 0);
    },
  });

  // Query: Today's profit
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

  // Query: This month's profit
  const { data: monthProfit } = useQuery({
    queryKey: ["month-profit"],
    queryFn: async () => {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("sales_transactions")
        .select("total_profit")
        .gte("transaction_date", firstDay.toISOString())
        .not("status", "eq", "cancelled");
      if (error) throw error;
      return (data || []).reduce((sum, t) => sum + (t.total_profit || 0), 0);
    },
  });

  // Query: Today's sales count
  const { data: todaySales } = useQuery({
    queryKey: ["today-sales"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("sales_transactions")
        .select("*", { count: "exact", head: true })
        .gte("transaction_date", today.toISOString())
        .not("status", "eq", "cancelled");
      if (error) throw error;
      return count || 0;
    },
  });

  // Query: Pending shipments
  const { data: pendingShipments } = useQuery({
    queryKey: ["pending-shipments"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sales_transactions")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "packing"]);
      if (error) throw error;
      return count || 0;
    },
  });

  // Query: Low stock count
  const { data: lowStockCount } = useQuery({
    queryKey: ["low-stock-count"],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, low_stock_threshold")
        .eq("is_active", true);
      if (error) throw error;

      let count = 0;
      for (const product of products || []) {
        const { data: batches } = await supabase
          .from("product_batches")
          .select("remaining_quantity")
          .eq("product_id", product.id);
        const totalStock = (batches || []).reduce(
          (sum, b) => sum + (b.remaining_quantity || 0),
          0
        );
        if (totalStock <= product.low_stock_threshold) count++;
      }
      return count;
    },
  });

  // Query: Cargo OTW count
  const { data: cargoOTW } = useQuery({
    queryKey: ["cargo-otw"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cargo_shipments")
        .select("*", { count: "exact", head: true })
        .in("status", ["ordered", "shipped", "customs"]);
      if (error) throw error;
      return count || 0;
    },
  });

  // Query: Top seller
  const { data: topSeller } = useQuery({
    queryKey: ["top-seller"],
    queryFn: async () => {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);

      const { data: items, error } = await supabase
        .from("transaction_items")
        .select(`
          quantity,
          product_id,
          products (name)
        `)
        .gte("created_at", firstDay.toISOString());

      if (error) throw error;

      // Aggregate by product
      const productSales: Record<string, { name: string; qty: number }> = {};
      for (const item of items || []) {
        const pid = item.product_id;
        if (!productSales[pid]) {
          productSales[pid] = { name: (item.products as any)?.name || "Unknown", qty: 0 };
        }
        productSales[pid].qty += item.quantity;
      }

      // Find top
      let top = { name: "-", qty: 0 };
      for (const key of Object.keys(productSales)) {
        if (productSales[key].qty > top.qty) {
          top = productSales[key];
        }
      }
      return top.name;
    },
  });

  // Query: Sales last 7 days
  const { data: salesChart } = useQuery({
    queryKey: ["sales-chart-7days"],
    queryFn: async () => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const { data, error } = await supabase
          .from("sales_transactions")
          .select("total_amount")
          .gte("transaction_date", date.toISOString())
          .lt("transaction_date", nextDate.toISOString())
          .not("status", "eq", "cancelled");

        if (error) throw error;

        const total = (data || []).reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const dayName = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);

        days.push({ name: dayName, sales: total });
      }
      return days;
    },
  });

  // Query: Sales by category
  const { data: categoryChart } = useQuery({
    queryKey: ["category-chart"],
    queryFn: async () => {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);

      const { data: items, error } = await supabase
        .from("transaction_items")
        .select(`
          quantity,
          subtotal,
          products (category)
        `)
        .gte("created_at", firstDay.toISOString());

      if (error) throw error;

      const categories: Record<string, number> = {};
      for (const item of items || []) {
        const cat = (item.products as any)?.category || "Lainnya";
        categories[cat] = (categories[cat] || 0) + (item.subtotal || 0);
      }

      return Object.entries(categories).map(([name, value]) => ({ name, value }));
    },
  });

  const stats = [
    {
      title: "Total Produk",
      value: formatNumber(totalProducts || 0),
      icon: <Package className="w-5 h-5 text-pink" />,
      color: "bg-pink-light",
    },
    {
      title: "Stok Ready",
      value: `${formatNumber(totalStock || 0)} pcs`,
      icon: <Archive className="w-5 h-5 text-lavender" />,
      color: "bg-lavender-light",
    },
    {
      title: "Floating Asset",
      value: formatCurrency(floatingAsset || 0),
      icon: <Ship className="w-5 h-5 text-sky" />,
      color: "bg-sky-light",
    },
    {
      title: "Profit Hari Ini",
      value: formatCurrency(todayProfit || 0),
      icon: <TrendingUp className="w-5 h-5 text-mint" />,
      color: "bg-mint-light",
    },
    {
      title: "Profit Bulan Ini",
      value: formatCurrency(monthProfit || 0),
      icon: <Calendar className="w-5 h-5 text-mint" />,
      color: "bg-mint-light",
    },
    {
      title: "Penjualan Hari Ini",
      value: formatNumber(todaySales || 0),
      icon: <ShoppingCart className="w-5 h-5 text-pink" />,
      color: "bg-pink-light",
    },
    {
      title: "Pending Kirim",
      value: formatNumber(pendingShipments || 0),
      icon: <Clock className="w-5 h-5 text-peach" />,
      color: "bg-peach-light",
    },
    {
      title: "Stok Menipis",
      value: formatNumber(lowStockCount || 0),
      icon: <AlertTriangle className="w-5 h-5 text-warning-foreground" />,
      color: "bg-peach-light",
    },
    {
      title: "Kargo OTW",
      value: formatNumber(cargoOTW || 0),
      icon: <Truck className="w-5 h-5 text-sky" />,
      color: "bg-sky-light",
    },
    {
      title: "Top Seller",
      value: topSeller || "-",
      icon: <Trophy className="w-5 h-5 text-pink" />,
      color: "bg-pink-light",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((stat, index) => (
            <StatCard key={stat.title} {...stat} delay={index} />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart - Sales 7 Days */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Card className="glass-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Penjualan 7 Hari Terakhir</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesChart || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                      />
                      <Bar dataKey="sales" fill="hsl(340, 80%, 70%)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pie Chart - Category */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Card className="glass-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Penjualan per Kategori</h3>
                <div className="h-64">
                  {(categoryChart?.length || 0) > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChart}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                        >
                          {(categoryChart || []).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Belum ada data penjualan bulan ini
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
