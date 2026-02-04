import AppLayout from "@/components/layout/AppLayout";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Plus,
  Minus,
} from "lucide-react";
import { StockInDialog } from "@/components/products/StockInDialog";
import { StockOutDialog } from "@/components/products/StockOutDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";

interface ProductStock {
  id: string;
  sku: string;
  name: string;
  series: string | null;
  brand: string | null;
  category: string;
  photo_url: string | null;
  selling_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  totalStock: number;
  totalValue: number;
  avgCostPrice: number;
  potentialProfit: number;
}

export default function Stock() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Stock dialogs state
  const [stockInProduct, setStockInProduct] = useState<ProductStock | null>(null);
  const [stockOutProduct, setStockOutProduct] = useState<ProductStock | null>(null);

  // Query products with stock and value calculations
  const { data: products, isLoading } = useQuery({
    queryKey: ["products-stock-monitoring"],
    queryFn: async () => {
      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const productsWithStock = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: batches } = await supabase
            .from("product_batches")
            .select("remaining_quantity, cost_price")
            .eq("product_id", product.id)
            .gt("remaining_quantity", 0);

          const totalStock = (batches || []).reduce(
            (sum, b) => sum + (b.remaining_quantity || 0),
            0
          );

          const totalValue = (batches || []).reduce(
            (sum, b) => sum + (b.remaining_quantity || 0) * (b.cost_price || 0),
            0
          );

          const avgCostPrice = totalStock > 0 ? totalValue / totalStock : 0;
          const potentialRevenue = totalStock * product.selling_price;
          const potentialProfit = potentialRevenue - totalValue;

          return {
            ...product,
            totalStock,
            totalValue,
            avgCostPrice,
            potentialProfit,
          } as ProductStock;
        })
      );

      return productsWithStock;
    },
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!products) return {
      totalProducts: 0,
      totalStock: 0,
      totalAssetValue: 0,
      totalPotentialProfit: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      healthyStockCount: 0,
    };

    return {
      totalProducts: products.length,
      totalStock: products.reduce((sum, p) => sum + p.totalStock, 0),
      totalAssetValue: products.reduce((sum, p) => sum + p.totalValue, 0),
      totalPotentialProfit: products.reduce((sum, p) => sum + p.potentialProfit, 0),
      lowStockCount: products.filter(p => p.totalStock > 0 && p.totalStock <= p.low_stock_threshold).length,
      outOfStockCount: products.filter(p => p.totalStock === 0).length,
      healthyStockCount: products.filter(p => p.totalStock > p.low_stock_threshold).length,
    };
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products?.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.series && p.series.toLowerCase().includes(search.toLowerCase()));

      const matchesType = filterType === "all" || p.category === filterType;

      let matchesStatus = true;
      if (filterStatus === "low") {
        matchesStatus = p.totalStock > 0 && p.totalStock <= p.low_stock_threshold;
      } else if (filterStatus === "out") {
        matchesStatus = p.totalStock === 0;
      } else if (filterStatus === "healthy") {
        matchesStatus = p.totalStock > p.low_stock_threshold;
      }

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [products, search, filterType, filterStatus]);

  const getStockStatus = (product: ProductStock) => {
    if (product.totalStock === 0) {
      return { label: "Habis", variant: "destructive" as const, icon: XCircle };
    }
    if (product.totalStock <= product.low_stock_threshold) {
      return { label: "Menipis", variant: "warning" as const, icon: AlertTriangle };
    }
    return { label: "Aman", variant: "default" as const, icon: CheckCircle };
  };

  return (
    <AppLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold">Kelola Stok</h1>
          <p className="text-muted-foreground">
            Pantau dan atur stok produk dengan sistem FIFO
          </p>
        </div>
        <Link to="/products">
          <Button variant="outline" className="gap-2">
            <Package className="w-4 h-4" />
            Kelola Produk
          </Button>
        </Link>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Stok</p>
                  <p className="text-xl font-bold">{formatNumber(stats.totalStock)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-100">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nilai Asset</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalAssetValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-100">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Potensi Laba</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(stats.totalPotentialProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-100">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stok Menipis</p>
                  <p className="text-xl font-bold text-orange-600">{stats.lowStockCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Stock Status Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <Card
          className={`cursor-pointer transition-all ${filterStatus === "healthy" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "healthy" ? "all" : "healthy")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Aman</span>
            </div>
            <Badge variant="secondary">{stats.healthyStockCount}</Badge>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${filterStatus === "low" ? "ring-2 ring-orange-500" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "low" ? "all" : "low")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium">Menipis</span>
            </div>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              {stats.lowStockCount}
            </Badge>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${filterStatus === "out" ? "ring-2 ring-red-500" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "out" ? "all" : "out")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium">Habis</span>
            </div>
            <Badge variant="destructive">{stats.outOfStockCount}</Badge>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk atau SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Semua Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="Blindbox">Blind Box</SelectItem>
            <SelectItem value="Figure">Figure</SelectItem>
            <SelectItem value="Plush">Plush</SelectItem>
            <SelectItem value="Accessories">Accessories</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="healthy">Stok Aman</SelectItem>
            <SelectItem value="low">Menipis</SelectItem>
            <SelectItem value="out">Habis</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Products Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
                <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Produk</TableHead>
                  <TableHead>Seri</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right">Nilai Asset</TableHead>
                  <TableHead className="text-right">Potensi Laba</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <div className="animate-shimmer h-12 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts?.map((product) => {
                    const status = getStockStatus(product);
                    const StatusIcon = status.icon;
                    const profitMargin = product.totalStock > 0 
                      ? ((product.selling_price - product.avgCostPrice) / product.avgCostPrice * 100)
                      : 0;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                              {product.photo_url ? (
                                <img
                                  src={product.photo_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {product.series || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(product.totalStock)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.totalValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className={`font-medium ${product.potentialProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(product.potentialProfit)}
                            </p>
                            {product.totalStock > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {profitMargin > 0 ? "+" : ""}{profitMargin.toFixed(0)}%
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={status.variant === "warning" ? "secondary" : status.variant}
                            className={`gap-1 ${status.variant === "warning" ? "bg-orange-100 text-orange-700" : ""}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => setStockInProduct(product)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => setStockOutProduct(product)}
                              disabled={product.totalStock === 0}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stock Dialogs */}
      <StockInDialog
        product={stockInProduct}
        open={!!stockInProduct}
        onOpenChange={(open) => !open && setStockInProduct(null)}
      />
      <StockOutDialog
        product={stockOutProduct}
        open={!!stockOutProduct}
        onOpenChange={(open) => !open && setStockOutProduct(null)}
      />
    </AppLayout>
  );
}
