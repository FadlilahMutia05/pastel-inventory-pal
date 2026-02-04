import AppLayout from "@/components/layout/AppLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber, formatDateShort } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Download,
  Calendar,
  TrendingUp,
  ShoppingCart,
  Package,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = [
  "hsl(340, 80%, 70%)",
  "hsl(270, 60%, 80%)",
  "hsl(165, 60%, 75%)",
  "hsl(200, 80%, 80%)",
  "hsl(25, 90%, 85%)",
];

type PeriodType = "daily" | "weekly" | "monthly" | "custom";

export default function Reports() {
  const { toast } = useToast();
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Calculate date range based on period type
  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end = new Date();

    switch (periodType) {
      case "daily":
        start = new Date();
        start.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        start = new Date();
        start.setDate(start.getDate() - 7);
        break;
      case "monthly":
        start = new Date();
        start.setDate(1);
        break;
      case "custom":
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default:
        start = new Date();
        start.setDate(1);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  };

  const { start, end } = getDateRange();

  // Query transactions for period
  const { data: transactions } = useQuery({
    queryKey: ["report-transactions", periodType, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_transactions")
        .select("*")
        .gte("transaction_date", start.toISOString())
        .lte("transaction_date", end.toISOString())
        .not("status", "eq", "cancelled");

      if (error) throw error;
      return data;
    },
  });

  // Query transaction items for top products
  const { data: topProducts } = useQuery({
    queryKey: ["report-top-products", periodType, startDate, endDate],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("transaction_items")
        .select(`
          quantity,
          subtotal,
          profit,
          products (id, name, sku)
        `)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (error) throw error;

      // Aggregate by product
      const productSales: Record<
        string,
        { name: string; sku: string; qty: number; revenue: number; profit: number }
      > = {};

      for (const item of items || []) {
        const pid = (item.products as any)?.id;
        if (!pid) continue;

        if (!productSales[pid]) {
          productSales[pid] = {
            name: (item.products as any)?.name || "Unknown",
            sku: (item.products as any)?.sku || "",
            qty: 0,
            revenue: 0,
            profit: 0,
          };
        }
        productSales[pid].qty += item.quantity;
        productSales[pid].revenue += item.subtotal;
        productSales[pid].profit += item.profit;
      }

      return Object.values(productSales)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
    },
  });

  // Query daily sales for chart
  const { data: dailySalesChart } = useQuery({
    queryKey: ["report-daily-chart", periodType, startDate, endDate],
    queryFn: async () => {
      const days: { date: string; sales: number; profit: number }[] = [];
      const current = new Date(start);

      while (current <= end) {
        const dayStart = new Date(current);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(current);
        dayEnd.setHours(23, 59, 59, 999);

        const { data } = await supabase
          .from("sales_transactions")
          .select("total_amount, total_profit")
          .gte("transaction_date", dayStart.toISOString())
          .lte("transaction_date", dayEnd.toISOString())
          .not("status", "eq", "cancelled");

        const sales = (data || []).reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const profit = (data || []).reduce((sum, t) => sum + (t.total_profit || 0), 0);

        days.push({
          date: current.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
          sales,
          profit,
        });

        current.setDate(current.getDate() + 1);
      }

      return days;
    },
  });

  // Query category distribution
  const { data: categoryChart } = useQuery({
    queryKey: ["report-category-chart", periodType, startDate, endDate],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("transaction_items")
        .select(`
          subtotal,
          products (category)
        `)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (error) throw error;

      const categories: Record<string, number> = {};
      for (const item of items || []) {
        const cat = (item.products as any)?.category || "Lainnya";
        categories[cat] = (categories[cat] || 0) + (item.subtotal || 0);
      }

      return Object.entries(categories).map(([name, value]) => ({ name, value }));
    },
  });

  // Calculate summary
  const summary = {
    totalTransactions: transactions?.length || 0,
    totalSales: transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0,
    totalProfit: transactions?.reduce((sum, t) => sum + (t.total_profit || 0), 0) || 0,
    averageMargin: 0,
  };

  if (summary.totalSales > 0) {
    summary.averageMargin = (summary.totalProfit / summary.totalSales) * 100;
  }

  // Export to CSV
  const exportCSV = () => {
    if (!transactions?.length) {
      toast({
        title: "Tidak ada data",
        description: "Tidak ada transaksi untuk periode ini",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Kode",
      "Tanggal",
      "Customer",
      "Kota",
      "Ekspedisi",
      "Resi",
      "Subtotal",
      "Ongkir",
      "Total",
      "Profit",
      "Status",
    ];

    const rows = transactions.map((t) => [
      t.transaction_code,
      formatDateShort(t.transaction_date),
      t.customer_name,
      t.customer_city || "",
      t.courier,
      t.tracking_number || "",
      t.subtotal,
      t.shipping_cost || 0,
      t.total_amount,
      t.total_profit,
      t.status,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${periodType}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export berhasil",
      description: "File CSV berhasil diunduh",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold">Laporan Periodik</h1>
            <p className="text-muted-foreground">
              {formatDateShort(start)} - {formatDateShort(end)}
            </p>
          </div>
          <Button onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </motion.div>

        {/* Period Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2">
                  <Label>Periode</Label>
                  <Select
                    value={periodType}
                    onValueChange={(v) => setPeriodType(v as PeriodType)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Hari Ini</SelectItem>
                      <SelectItem value="weekly">7 Hari Terakhir</SelectItem>
                      <SelectItem value="monthly">Bulan Ini</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {periodType === "custom" && (
                  <>
                    <div className="space-y-2">
                      <Label>Dari</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sampai</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card bg-pink-light">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-pink" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transaksi</p>
                    <p className="text-xl font-bold">{formatNumber(summary.totalTransactions)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="glass-card bg-lavender-light">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-lavender" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Penjualan</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.totalSales)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card bg-mint-light">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-mint" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Profit</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.totalProfit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="glass-card bg-sky-light">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
                    <Package className="w-5 h-5 text-sky" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Margin Rata-rata</p>
                    <p className="text-xl font-bold">{summary.averageMargin.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart - Sales Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Trend Penjualan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailySalesChart || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                      />
                      <Line type="monotone" dataKey="sales" stroke="hsl(340, 80%, 70%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="profit" stroke="hsl(165, 60%, 60%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pie Chart - Category */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Penjualan per Kategori</CardTitle>
              </CardHeader>
              <CardContent>
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
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {(categoryChart || []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
                      Belum ada data
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Top Produk</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada data
                      </TableCell>
                    </TableRow>
                  ) : (
                    topProducts?.map((product, index) => (
                      <TableRow key={product.sku}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(product.qty)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                        <TableCell className="text-right text-success-foreground">
                          {formatCurrency(product.profit)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
