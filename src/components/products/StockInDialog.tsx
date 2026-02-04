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

interface StockInDialogProps {
  product: {
    id: string;
    name: string;
    sku: string;
    photo_url: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockInDialog({ product, open, onOpenChange }: StockInDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [notes, setNotes] = useState("");

  const addStockMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Produk tidak ditemukan");
      
      const qty = parseInt(quantity);
      const cost = parseFloat(costPrice) || 0;

      if (qty <= 0) throw new Error("Jumlah harus lebih dari 0");

      const { error } = await supabase.from("product_batches").insert({
        product_id: product.id,
        quantity: qty,
        remaining_quantity: qty,
        cost_price: cost,
        batch_code: `IN-${Date.now()}`,
        notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["products-stock-monitoring"] });
      onOpenChange(false);
      setQuantity("");
      setCostPrice("");
      setNotes("");
      toast({
        title: "Stok masuk berhasil",
        description: `${quantity} pcs telah ditambahkan ke inventory`,
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

  if (!product) return null;

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
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">{product.sku}</p>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Jumlah (pcs) *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Masukkan jumlah"
              min={1}
            />
          </div>

          {/* Cost Price */}
          <div className="space-y-2">
            <Label>Harga Modal per Pcs (Rp)</Label>
            <Input
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="Opsional - untuk kalkulasi profit"
            />
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
              disabled={addStockMutation.isPending || !quantity}
            >
              {addStockMutation.isPending ? "Menyimpan..." : "Tambah Stok"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
