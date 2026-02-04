import AppLayout from "@/components/layout/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  ShoppingCart,
  Package,
  Minus,
  Trash2,
  Percent,
  TrendingUp,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  sku: string;
  name: string;
  photo_url: string | null;
  selling_price: number;
  pcs_per_set: number;
  sets_per_karton: number;
  totalStock: number;
  avgCostPrice: number;
}

type UnitType = "pcs" | "set" | "karton";

interface CartItem {
  product: Product;
  quantity: number;
  unitType: UnitType;
  discount: number; // Discount percentage
  customPrice: number | null; // Custom price per pcs
}

const SHIPPING_TYPES = [
  { value: "instant", label: "Instant", description: "Pengiriman dalam kota (Gojek, Grab, dll)" },
  { value: "sameday", label: "Same Day", description: "Sampai hari yang sama" },
  { value: "normal", label: "Normal", description: "Ekspedisi reguler (JNE, SiCepat, dll)" },
  { value: "cargo", label: "Cargo", description: "Pengiriman besar/bulk" },
];

const COURIERS_BY_TYPE: Record<string, string[]> = {
  instant: ["Gojek", "Grab", "Lalamove", "Maxim", "InDriver"],
  sameday: ["Gojek", "Grab", "Lalamove", "AnterAja Same Day", "SiCepat Same Day"],
  normal: ["JNE", "SiCepat", "J&T", "SPX", "AnterAja", "Ninja", "ID Express", "Pos Indonesia"],
  cargo: ["Indah Cargo", "Dakota Cargo", "J&T Cargo", "Herona Express", "Pahala Express", "Sentral Cargo"],
};

const CUSTOM_OPTION = "__custom__";

// Helper to calculate total pcs
const calculateTotalPcs = (quantity: number, unitType: UnitType, pcsPerSet: number, setsPerKarton: number) => {
  switch (unitType) {
    case "set":
      return quantity * pcsPerSet;
    case "karton":
      return quantity * pcsPerSet * setsPerKarton;
    default:
      return quantity;
  }
};

// Helper to get effective price per pcs
const getEffectivePricePerPcs = (item: CartItem) => {
  const basePrice = item.customPrice ?? item.product.selling_price;
  const discountAmount = basePrice * (item.discount / 100);
  return basePrice - discountAmount;
};

// Helper to calculate item subtotal
const calculateItemSubtotal = (item: CartItem) => {
  const totalPcs = calculateTotalPcs(
    item.quantity,
    item.unitType,
    item.product.pcs_per_set,
    item.product.sets_per_karton
  );
  return getEffectivePricePerPcs(item) * totalPcs;
};

// Helper to calculate item profit
const calculateItemProfit = (item: CartItem) => {
  const totalPcs = calculateTotalPcs(
    item.quantity,
    item.unitType,
    item.product.pcs_per_set,
    item.product.sets_per_karton
  );
  const effectivePrice = getEffectivePricePerPcs(item);
  return (effectivePrice - item.product.avgCostPrice) * totalPcs;
};

export default function Sales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [shippingType, setShippingType] = useState("normal");
  const [courier, setCourier] = useState("JNE");
  const [isCustomCourier, setIsCustomCourier] = useState(false);
  const [customCourierName, setCustomCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCost, setShippingCost] = useState(0);

  // Update courier when shipping type changes
  const handleShippingTypeChange = (type: string) => {
    setShippingType(type);
    setCourier(COURIERS_BY_TYPE[type]?.[0] || "");
    setIsCustomCourier(false);
    setCustomCourierName("");
  };

  // Handle courier selection
  const handleCourierChange = (value: string) => {
    if (value === CUSTOM_OPTION) {
      setIsCustomCourier(true);
      setCourier("");
    } else {
      setIsCustomCourier(false);
      setCourier(value);
    }
  };

  // Get the final courier name
  const getFinalCourier = () => isCustomCourier ? customCourierName : courier;

  // Query products with stock and cost price
  const { data: products, isLoading } = useQuery({
    queryKey: ["products-for-sale"],
    queryFn: async () => {
      const { data: productsData, error } = await supabase
        .from("products")
        .select("id, sku, name, photo_url, selling_price, pcs_per_set, sets_per_karton")
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

          return { 
            ...product, 
            totalStock, 
            avgCostPrice,
            pcs_per_set: product.pcs_per_set || 1,
            sets_per_karton: product.sets_per_karton || 1,
          } as Product;
        })
      );

      return productsWithStock.filter((p) => p.totalStock > 0);
    },
  });

  // Create sale mutation with FIFO logic
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!customerName || cart.length === 0) {
        throw new Error("Nama customer dan produk wajib diisi");
      }

      // Calculate totals
      const subtotal = cart.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
      const totalAmount = subtotal + shippingCost;

      // Create transaction
      const { data: transaction, error: transactionError } = await supabase
        .from("sales_transactions")
        .insert([{
          transaction_code: `MAO-${Date.now()}`,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          customer_city: customerCity || null,
          customer_address: customerAddress || null,
          shipping_type: shippingType,
          courier: getFinalCourier(),
          tracking_number: trackingNumber || null,
          subtotal,
          shipping_cost: shippingCost,
          total_amount: totalAmount,
          total_profit: 0,
        }])
        .select()
        .single();

      if (transactionError) throw transactionError;

      let totalProfit = 0;

      // Process each cart item with FIFO
      for (const item of cart) {
        const totalPcs = calculateTotalPcs(
          item.quantity,
          item.unitType,
          item.product.pcs_per_set,
          item.product.sets_per_karton
        );
        const effectivePricePerPcs = getEffectivePricePerPcs(item);
        
        let remainingQty = totalPcs;

        // Get batches ordered by received_at (FIFO)
        const { data: batches, error: batchesError } = await supabase
          .from("product_batches")
          .select("*")
          .eq("product_id", item.product.id)
          .gt("remaining_quantity", 0)
          .order("received_at", { ascending: true });

        if (batchesError) throw batchesError;

        for (const batch of batches || []) {
          if (remainingQty <= 0) break;

          const takeQty = Math.min(remainingQty, batch.remaining_quantity);
          const itemSubtotal = takeQty * effectivePricePerPcs;
          const itemProfit = itemSubtotal - takeQty * batch.cost_price;
          totalProfit += itemProfit;

          // Update batch remaining quantity
          const { error: updateError } = await supabase
            .from("product_batches")
            .update({ remaining_quantity: batch.remaining_quantity - takeQty })
            .eq("id", batch.id);

          if (updateError) throw updateError;

          // Create transaction item
          const { error: itemError } = await supabase.from("transaction_items").insert({
            transaction_id: transaction.id,
            product_id: item.product.id,
            product_batch_id: batch.id,
            quantity: takeQty,
            unit_price: effectivePricePerPcs,
            cost_price: batch.cost_price,
            subtotal: itemSubtotal,
            profit: itemProfit,
          });

          if (itemError) throw itemError;

          remainingQty -= takeQty;
        }

        if (remainingQty > 0) {
          // Not enough stock - create item with 0 cost
          const itemSubtotal = remainingQty * effectivePricePerPcs;
          const { error: itemError } = await supabase.from("transaction_items").insert({
            transaction_id: transaction.id,
            product_id: item.product.id,
            quantity: remainingQty,
            unit_price: effectivePricePerPcs,
            cost_price: 0,
            subtotal: itemSubtotal,
            profit: itemSubtotal,
          });

          if (itemError) throw itemError;
          totalProfit += itemSubtotal;
        }
      }

      // Update transaction with total profit
      const { error: updateTransactionError } = await supabase
        .from("sales_transactions")
        .update({ total_profit: totalProfit })
        .eq("id", transaction.id);

      if (updateTransactionError) throw updateTransactionError;

      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["products-stock-monitoring"] });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerCity("");
      setCustomerAddress("");
      setShippingType("normal");
      setCourier("JNE");
      setIsCustomCourier(false);
      setCustomCourierName("");
      setTrackingNumber("");
      setShippingCost(0);
      toast({
        title: "Penjualan berhasil",
        description: "Transaksi telah disimpan dengan kalkulasi FIFO",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newTotalPcs = calculateTotalPcs(
          existing.quantity + 1,
          existing.unitType,
          product.pcs_per_set,
          product.sets_per_karton
        );
        if (newTotalPcs > product.totalStock) {
          toast({
            title: "Stok tidak cukup",
            description: `Stok tersedia: ${product.totalStock} pcs`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        product, 
        quantity: 1, 
        unitType: "pcs" as UnitType, 
        discount: 0,
        customPrice: null,
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            const newTotalPcs = calculateTotalPcs(
              newQty,
              item.unitType,
              item.product.pcs_per_set,
              item.product.sets_per_karton
            );
            if (newTotalPcs > item.product.totalStock) {
              toast({
                title: "Stok tidak cukup",
                description: `Stok tersedia: ${item.product.totalStock} pcs`,
                variant: "destructive",
              });
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateUnitType = (productId: string, unitType: UnitType) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const newTotalPcs = calculateTotalPcs(
            item.quantity,
            unitType,
            item.product.pcs_per_set,
            item.product.sets_per_karton
          );
          if (newTotalPcs > item.product.totalStock) {
            toast({
              title: "Stok tidak cukup",
              description: `Stok tersedia: ${item.product.totalStock} pcs`,
              variant: "destructive",
            });
            return item;
          }
          return { ...item, unitType };
        }
        return item;
      })
    );
  };

  const updateDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, discount: Math.max(0, Math.min(100, discount)) }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const filteredProducts = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const subtotal = cart.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  const totalDiscount = cart.reduce((sum, item) => {
    const totalPcs = calculateTotalPcs(
      item.quantity,
      item.unitType,
      item.product.pcs_per_set,
      item.product.sets_per_karton
    );
    const basePrice = item.customPrice ?? item.product.selling_price;
    return sum + (basePrice * (item.discount / 100) * totalPcs);
  }, 0);
  const estimatedProfit = cart.reduce((sum, item) => sum + calculateItemProfit(item), 0);
  const total = subtotal + shippingCost;

  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl font-bold mb-4">Penjualan</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="glass-card">
                  <CardContent className="p-3">
                    <div className="animate-shimmer h-24 rounded" />
                  </CardContent>
                </Card>
              ))
            ) : filteredProducts?.length === 0 ? (
              <Card className="glass-card col-span-full">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {search ? "Produk tidak ditemukan" : "Tidak ada produk dengan stok"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredProducts?.map((product, index) => {
                const inCart = cart.find((item) => item.product.id === product.id);
                const profitMargin = product.avgCostPrice > 0 
                  ? ((product.selling_price - product.avgCostPrice) / product.avgCostPrice * 100)
                  : 0;
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <Card
                      className={`glass-card cursor-pointer transition-all hover:shadow-glow hover:-translate-y-1 ${
                        inCart ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-3">
                        {product.photo_url ? (
                          <img
                            src={product.photo_url}
                            alt={product.name}
                            className="w-full h-20 object-cover rounded-lg mb-2"
                          />
                        ) : (
                          <div className="w-full h-20 rounded-lg bg-muted flex items-center justify-center mb-2">
                            <Package className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div>
                            <p className="font-bold text-sm text-primary">
                              {formatCurrency(product.selling_price)}
                            </p>
                            {product.avgCostPrice > 0 && (
                              <p className="text-xs text-green-600 flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3" />
                                +{profitMargin.toFixed(0)}%
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {product.totalStock}
                          </Badge>
                        </div>
                        {inCart && (
                          <Badge className="w-full mt-2 justify-center">
                            {calculateTotalPcs(
                              inCart.quantity,
                              inCart.unitType,
                              product.pcs_per_set,
                              product.sets_per_karton
                            )} pcs
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="glass-card sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Keranjang
                  {cart.length > 0 && (
                    <Badge variant="secondary">{cart.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cart items */}
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Keranjang kosong
                  </p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {cart.map((item) => {
                      const totalPcs = calculateTotalPcs(
                        item.quantity,
                        item.unitType,
                        item.product.pcs_per_set,
                        item.product.sets_per_karton
                      );
                      const itemSubtotal = calculateItemSubtotal(item);
                      const itemProfit = calculateItemProfit(item);
                      
                      return (
                        <div
                          key={item.product.id}
                          className="p-3 rounded-lg bg-muted/50 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(getEffectivePricePerPcs(item))}/pcs
                                {item.discount > 0 && (
                                  <span className="text-destructive ml-1">(-{item.discount}%)</span>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive shrink-0"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          {/* Unit Type Selection */}
                          <div className="flex items-center gap-2">
                            <Select 
                              value={item.unitType} 
                              onValueChange={(v) => updateUnitType(item.product.id, v as UnitType)}
                            >
                              <SelectTrigger className="h-8 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pcs">Pcs</SelectItem>
                                <SelectItem value="set">
                                  Set ({item.product.pcs_per_set}pcs)
                                </SelectItem>
                                <SelectItem value="karton">
                                  Karton ({item.product.pcs_per_set * item.product.sets_per_karton}pcs)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex items-center gap-1 flex-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.product.id, -1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.product.id, 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Discount Input */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <Percent className="w-3 h-3 text-muted-foreground" />
                              <Input
                                type="number"
                                value={item.discount || ""}
                                onChange={(e) => updateDiscount(item.product.id, Number(e.target.value))}
                                placeholder="0"
                                className="h-7 text-xs w-16"
                                min={0}
                                max={100}
                              />
                              <span className="text-xs text-muted-foreground">diskon</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{formatCurrency(itemSubtotal)}</p>
                              <p className="text-xs text-muted-foreground">({totalPcs} pcs)</p>
                            </div>
                          </div>
                          
                          {/* Profit indicator */}
                          {item.product.avgCostPrice > 0 && (
                            <div className={`text-xs flex items-center gap-1 ${itemProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                              <TrendingUp className="w-3 h-3" />
                              Laba: {formatCurrency(itemProfit)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Customer info */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Nama Customer *</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nama lengkap"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>No. HP</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="08xxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kota</Label>
                      <Input
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        placeholder="Kota tujuan"
                      />
                    </div>
                  </div>
                  {/* Shipping Type Selection */}
                  <div className="space-y-2">
                    <Label>Tipe Pengiriman</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SHIPPING_TYPES.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => handleShippingTypeChange(type.value)}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            shippingType === type.value
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="font-medium text-sm">{type.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{type.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Nama Ekspedisi</Label>
                      {isCustomCourier ? (
                        <div className="flex gap-1">
                          <Input
                            value={customCourierName}
                            onChange={(e) => setCustomCourierName(e.target.value)}
                            placeholder="Nama ekspedisi..."
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() => {
                              setIsCustomCourier(false);
                              setCourier(COURIERS_BY_TYPE[shippingType]?.[0] || "");
                            }}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Select value={courier} onValueChange={handleCourierChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih ekspedisi" />
                          </SelectTrigger>
                          <SelectContent>
                            {COURIERS_BY_TYPE[shippingType]?.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_OPTION} className="text-primary">
                              + Lainnya (custom)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>No. Resi</Label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Opsional"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ongkir (Rp)</Label>
                    <Input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Total Diskon</span>
                      <span>-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Ongkir</span>
                    <span>{formatCurrency(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                  {estimatedProfit !== 0 && (
                    <div className={`flex justify-between text-sm ${estimatedProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Est. Laba
                      </span>
                      <span>{formatCurrency(estimatedProfit)}</span>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => createSaleMutation.mutate()}
                  disabled={cart.length === 0 || !customerName || createSaleMutation.isPending}
                >
                  {createSaleMutation.isPending ? "Memproses..." : "Simpan Transaksi"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
