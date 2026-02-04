import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const SHIPPING_TYPES = [
  { value: "instant", label: "Instant" },
  { value: "sameday", label: "Same Day" },
  { value: "normal", label: "Normal" },
  { value: "cargo", label: "Cargo" },
];

const COURIERS_BY_TYPE: Record<string, string[]> = {
  instant: ["Gojek", "Grab", "Lalamove", "Maxim", "InDriver"],
  sameday: ["Gojek", "Grab", "Lalamove", "AnterAja Same Day", "SiCepat Same Day"],
  normal: ["JNE", "SiCepat", "J&T", "SPX", "AnterAja", "Ninja", "ID Express", "Pos Indonesia"],
  cargo: ["Indah Cargo", "Dakota Cargo", "J&T Cargo", "Herona Express", "Pahala Express"],
};

interface StockOutDialogProps {
  product: {
    id: string;
    name: string;
    sku: string;
    photo_url: string | null;
    selling_price: number;
    totalStock: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockOutDialog({ product, open, onOpenChange }: StockOutDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [quantity, setQuantity] = useState("1");
  const [customPrice, setCustomPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [shippingType, setShippingType] = useState("normal");
  const [courier, setCourier] = useState("JNE");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [isCustomCourier, setIsCustomCourier] = useState(false);
  const [customCourier, setCustomCourier] = useState("");

  const handleShippingTypeChange = (type: string) => {
    setShippingType(type);
    setCourier(COURIERS_BY_TYPE[type]?.[0] || "");
    setIsCustomCourier(false);
  };

  const handleCourierChange = (value: string) => {
    if (value === "__custom__") {
      setIsCustomCourier(true);
      setCourier("");
    } else {
      setIsCustomCourier(false);
      setCourier(value);
    }
  };

  const getFinalCourier = () => isCustomCourier ? customCourier : courier;

  const stockOutMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Produk tidak ditemukan");
      if (!customerName) throw new Error("Nama customer wajib diisi");

      const qty = parseInt(quantity);
      if (qty <= 0) throw new Error("Jumlah harus lebih dari 0");
      if (qty > product.totalStock) throw new Error("Stok tidak mencukupi");

      const unitPrice = customPrice ? parseFloat(customPrice) : product.selling_price;
      const shipping = parseFloat(shippingCost) || 0;
      const subtotal = unitPrice * qty;
      const total = subtotal + shipping;

      // Create transaction
      const { data: transaction, error: transactionError } = await supabase
        .from("sales_transactions")
        .insert({
          transaction_code: `MAO-${Date.now()}`,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          customer_city: customerCity || null,
          shipping_type: shippingType,
          courier: getFinalCourier(),
          tracking_number: trackingNumber || null,
          subtotal,
          shipping_cost: shipping,
          total_amount: total,
          total_profit: 0,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Process FIFO stock deduction
      let remainingQty = qty;
      let totalProfit = 0;

      const { data: batches, error: batchesError } = await supabase
        .from("product_batches")
        .select("*")
        .eq("product_id", product.id)
        .gt("remaining_quantity", 0)
        .order("received_at", { ascending: true });

      if (batchesError) throw batchesError;

      for (const batch of batches || []) {
        if (remainingQty <= 0) break;

        const takeQty = Math.min(remainingQty, batch.remaining_quantity);
        const itemSubtotal = takeQty * unitPrice;
        const itemProfit = itemSubtotal - takeQty * batch.cost_price;
        totalProfit += itemProfit;

        // Update batch
        await supabase
          .from("product_batches")
          .update({ remaining_quantity: batch.remaining_quantity - takeQty })
          .eq("id", batch.id);

        // Create transaction item
        await supabase.from("transaction_items").insert({
          transaction_id: transaction.id,
          product_id: product.id,
          product_batch_id: batch.id,
          quantity: takeQty,
          unit_price: unitPrice,
          cost_price: batch.cost_price,
          subtotal: itemSubtotal,
          profit: itemProfit,
        });

        remainingQty -= takeQty;
      }

      // Update transaction with profit
      await supabase
        .from("sales_transactions")
        .update({ total_profit: totalProfit })
        .eq("id", transaction.id);

      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["products-stock-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
      onOpenChange(false);
      resetForm();
      toast({
        title: "Stok keluar berhasil",
        description: "Transaksi penjualan telah disimpan",
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

  const resetForm = () => {
    setQuantity("1");
    setCustomPrice("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCity("");
    setShippingType("normal");
    setCourier("JNE");
    setTrackingNumber("");
    setShippingCost("");
    setIsCustomCourier(false);
    setCustomCourier("");
  };

  if (!product) return null;

  const unitPrice = customPrice ? parseFloat(customPrice) : product.selling_price;
  const qty = parseInt(quantity) || 0;
  const shipping = parseFloat(shippingCost) || 0;
  const subtotal = unitPrice * qty;
  const total = subtotal + shipping;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="w-5 h-5 text-orange-600" />
            Stok Keluar / Penjualan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center overflow-hidden">
              {product.photo_url ? (
                <img src={product.photo_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">{product.sku}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Stok: {product.totalStock}</p>
              <p className="font-medium text-primary">{formatCurrency(product.selling_price)}</p>
            </div>
          </div>

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jumlah *</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
                max={product.totalStock}
              />
            </div>
            <div className="space-y-2">
              <Label>Harga Jual (opsional)</Label>
              <Input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder={product.selling_price.toString()}
              />
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-2">
              <Label>Nama Customer *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* Shipping */}
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipe Pengiriman</Label>
                <Select value={shippingType} onValueChange={handleShippingTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIPPING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ekspedisi</Label>
                {isCustomCourier ? (
                  <div className="flex gap-1">
                    <Input
                      value={customCourier}
                      onChange={(e) => setCustomCourier(e.target.value)}
                      placeholder="Nama ekspedisi"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COURIERS_BY_TYPE[shippingType]?.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">+ Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>No. Resi</Label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Opsional"
                />
              </div>
              <div className="space-y-2">
                <Label>Ongkir (Rp)</Label>
                <Input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Subtotal ({qty} pcs)</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Ongkir</span>
              <span>{formatCurrency(shipping)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
              onClick={() => stockOutMutation.mutate()}
              disabled={stockOutMutation.isPending || !customerName || qty <= 0}
            >
              {stockOutMutation.isPending ? "Memproses..." : "Simpan Transaksi"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
