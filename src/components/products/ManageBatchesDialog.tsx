import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Package, Pencil, Trash2, Layers, Save, X } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface ProductBatch {
  id: string;
  batch_code: string | null;
  quantity: number;
  remaining_quantity: number;
  cost_price: number;
  notes: string | null;
  received_at: string;
}

interface ManageBatchesDialogProps {
  product: {
    id: string;
    name: string;
    sku: string;
    photo_url: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageBatchesDialog({ product, open, onOpenChange }: ManageBatchesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleteConfirmBatch, setDeleteConfirmBatch] = useState<ProductBatch | null>(null);

  // Fetch batches for product
  const { data: batches, isLoading } = useQuery({
    queryKey: ["product-batches", product?.id],
    queryFn: async () => {
      if (!product) return [];
      const { data, error } = await supabase
        .from("product_batches")
        .select("*")
        .eq("product_id", product.id)
        .order("received_at", { ascending: true });
      
      if (error) throw error;
      return data as ProductBatch[];
    },
    enabled: !!product && open,
  });

  // Update batch mutation
  const updateBatchMutation = useMutation({
    mutationFn: async (data: { id: string; remaining_quantity: number; cost_price: number; notes: string | null }) => {
      const { error } = await supabase
        .from("product_batches")
        .update({
          remaining_quantity: data.remaining_quantity,
          cost_price: data.cost_price,
          notes: data.notes,
        })
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-batches", product?.id] });
      queryClient.invalidateQueries({ queryKey: ["products-stock-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      setEditingBatch(null);
      toast({
        title: "Batch diperbarui",
        description: "Data batch berhasil diubah",
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

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase
        .from("product_batches")
        .delete()
        .eq("id", batchId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-batches", product?.id] });
      queryClient.invalidateQueries({ queryKey: ["products-stock-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      setDeleteConfirmBatch(null);
      toast({
        title: "Batch dihapus",
        description: "Batch stok berhasil dihapus",
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

  const startEdit = (batch: ProductBatch) => {
    setEditingBatch(batch);
    setEditQuantity(batch.remaining_quantity.toString());
    setEditCostPrice(batch.cost_price.toString());
    setEditNotes(batch.notes || "");
  };

  const cancelEdit = () => {
    setEditingBatch(null);
    setEditQuantity("");
    setEditCostPrice("");
    setEditNotes("");
  };

  const saveEdit = () => {
    if (!editingBatch) return;
    
    const qty = parseInt(editQuantity) || 0;
    const cost = parseFloat(editCostPrice) || 0;
    
    if (qty < 0) {
      toast({
        title: "Error",
        description: "Jumlah tidak boleh negatif",
        variant: "destructive",
      });
      return;
    }

    updateBatchMutation.mutate({
      id: editingBatch.id,
      remaining_quantity: qty,
      cost_price: cost,
      notes: editNotes || null,
    });
  };

  const totalStock = batches?.reduce((sum, b) => sum + b.remaining_quantity, 0) || 0;
  const totalValue = batches?.reduce((sum, b) => sum + (b.remaining_quantity * b.cost_price), 0) || 0;

  if (!product) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Kelola Batch Stok
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
                <p className="text-sm text-muted-foreground">Total Stok</p>
                <p className="font-bold text-lg">{formatNumber(totalStock)} pcs</p>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <p className="text-xs text-muted-foreground">Jumlah Batch</p>
                <p className="font-bold">{batches?.length || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                <p className="text-xs text-muted-foreground">Total Nilai Asset</p>
                <p className="font-bold">{formatCurrency(totalValue)}</p>
              </div>
            </div>

            {/* Batches List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Daftar Batch (FIFO - terlama di atas)</Label>
              
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Memuat data batch...
                </div>
              ) : batches?.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Tidak ada batch stok</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {batches?.map((batch, index) => (
                    <div
                      key={batch.id}
                      className={`p-3 rounded-lg border ${
                        batch.remaining_quantity === 0 
                          ? "bg-muted/50 opacity-60" 
                          : "bg-background"
                      } ${editingBatch?.id === batch.id ? "ring-2 ring-primary" : ""}`}
                    >
                      {editingBatch?.id === batch.id ? (
                        // Edit Mode
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Batch #{index + 1} - {batch.batch_code || "N/A"}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                className="h-7 w-7 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                disabled={updateBatchMutation.isPending}
                                className="h-7 px-2"
                              >
                                <Save className="w-4 h-4 mr-1" />
                                {updateBatchMutation.isPending ? "..." : "Simpan"}
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Sisa Stok (pcs)</Label>
                              <Input
                                type="number"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                min={0}
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Harga Modal/pcs</Label>
                              <Input
                                type="number"
                                value={editCostPrice}
                                onChange={(e) => setEditCostPrice(e.target.value)}
                                min={0}
                                className="h-8"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Catatan</Label>
                            <Input
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Catatan opsional"
                              className="h-8"
                            />
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                #{index + 1}
                              </span>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                {batch.batch_code || "Manual"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(batch.received_at), "d MMM yyyy", { locale: localeId })}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-sm">
                              <span>
                                <span className="font-bold">{formatNumber(batch.remaining_quantity)}</span>
                                <span className="text-muted-foreground">/{batch.quantity} pcs</span>
                              </span>
                              <span className="text-muted-foreground">@</span>
                              <span className="font-medium">{formatCurrency(batch.cost_price)}</span>
                            </div>
                            {batch.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{batch.notes}</p>
                            )}
                          </div>
                          
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(batch)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmBatch(batch)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmBatch} onOpenChange={() => setDeleteConfirmBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Batch Stok?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus batch dengan {formatNumber(deleteConfirmBatch?.remaining_quantity || 0)} pcs stok.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmBatch && deleteBatchMutation.mutate(deleteConfirmBatch.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBatchMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
