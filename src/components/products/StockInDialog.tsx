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
import { useToast } from "@/hooks/use-toast";
import { Package, Plus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/format";

type UnitType = "pcs" | "set" | "karton";

interface StockInDialogProps {
  product: {
    id: string;
    name: string;
    sku: string;
    photo_url: string | null;
    pcs_per_set?: number;
    sets_per_karton?: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockInDialog({ product, open, onOpenChange }: StockInDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("pcs");
  const [costPrice, setCostPrice] = useState("");
  const [notes, setNotes] = useState("");

  const pcsPerSet = product?.pcs_per_set || 1;
  const setsPerKarton = product?.sets_per_karton || 1;
  const pcsPerKarton = pcsPerSet * setsPerKarton;

  // Calculate total pcs based on unit type
  const calculateTotalPcs = () => {
    const qty = parseInt(quantity) || 0;
    switch (unitType) {
      case "set":
        return qty * pcsPerSet;
      case "karton":
        return qty * pcsPerKarton;
      default:
        return qty;
    }
  };

  // Calculate cost per pcs
  const calculateCostPerPcs = () => {
    const cost = parseFloat(costPrice) || 0;
    const qty = parseInt(quantity) || 0;
    if (qty <= 0 || cost <= 0) return 0;
    
    const totalPcs = calculateTotalPcs();
    return cost / totalPcs;
  };

  const totalPcs = calculateTotalPcs();
  const costPerPcs = calculateCostPerPcs();

  const addStockMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Produk tidak ditemukan");
      
      if (totalPcs <= 0) throw new Error("Jumlah harus lebih dari 0");

      const { error } = await supabase.from("product_batches").insert({
        product_id: product.id,
        quantity: totalPcs,
        remaining_quantity: totalPcs,
        cost_price: costPerPcs,
        batch_code: `IN-${Date.now()}`,
        notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["products-stock-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["products-for-sale"] });
      onOpenChange(false);
      resetForm();
      toast({
        title: "Stok masuk berhasil",
        description: `${totalPcs} pcs telah ditambahkan ke inventory`,
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
    setQuantity("");
    setUnitType("pcs");
    setCostPrice("");
    setNotes("");
  };

  if (!product) return null;

  const getUnitLabel = () => {
    switch (unitType) {
      case "set":
        return `Set (${pcsPerSet} pcs/set)`;
      case "karton":
        return `Karton (${pcsPerKarton} pcs/karton)`;
      default:
        return "Pcs";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Stok Masuk
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
          </div>

          {/* Unit Type Selection */}
          <div className="space-y-2">
            <Label>Satuan</Label>
            <RadioGroup
              value={unitType}
              onValueChange={(v) => setUnitType(v as UnitType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pcs" id="pcs" />
                <Label htmlFor="pcs" className="cursor-pointer">Pcs</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="set" id="set" />
                <Label htmlFor="set" className="cursor-pointer">
                  Set <span className="text-xs text-muted-foreground">({pcsPerSet} pcs)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="karton" id="karton" />
                <Label htmlFor="karton" className="cursor-pointer">
                  Karton <span className="text-xs text-muted-foreground">({pcsPerKarton} pcs)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Jumlah ({getUnitLabel()}) *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Masukkan jumlah"
              min={1}
            />
            {totalPcs > 0 && unitType !== "pcs" && (
              <p className="text-sm text-muted-foreground">
                = <span className="font-medium text-foreground">{totalPcs}</span> pcs
              </p>
            )}
          </div>

          {/* Cost Price */}
          <div className="space-y-2">
            <Label>Total Harga Modal (Rp)</Label>
            <Input
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="Total biaya pembelian"
            />
            {costPerPcs > 0 && (
              <p className="text-sm text-muted-foreground">
                = <span className="font-medium text-foreground">{formatCurrency(costPerPcs)}</span> per pcs
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan opsional"
            />
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
              onClick={() => addStockMutation.mutate()}
              disabled={addStockMutation.isPending || totalPcs <= 0}
            >
              {addStockMutation.isPending ? "Menyimpan..." : "Tambah Stok"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
