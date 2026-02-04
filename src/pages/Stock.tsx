import AppLayout from "@/components/layout/AppLayout";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Plus,
  Minus,
  Search,
  Edit,
  Trash2,
  Package,
  Upload,
  Link as LinkIcon,
  Sparkles,
  Truck,
  CheckCircle2,
  X,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  selling_price: number;
  pcs_per_set: number;
  sets_per_karton: number;
  low_stock_threshold: number;
  is_active: boolean;
  totalStock?: number;
}

interface NewProductFormData {
  name: string;
  sku: string;
  photo_url: string;
  uploadMethod: "url" | "file";
  pcs_per_set: number;
  sets_per_karton: number;
  purchaseUnit: "pcs" | "set" | "karton";
  purchaseQty: number;
  totalPurchasePrice: number;
  sellingPricePerPcs: number;
  sellingPricePerSet: number;
  sellingPricePerKarton: number;
}

const defaultNewProductForm: NewProductFormData = {
  name: "",
  sku: "",
  photo_url: "",
  uploadMethod: "url",
  pcs_per_set: 12,
  sets_per_karton: 12,
  purchaseUnit: "pcs",
  purchaseQty: 0,
  totalPurchasePrice: 0,
  sellingPricePerPcs: 0,
  sellingPricePerSet: 0,
  sellingPricePerKarton: 0,
};

type ActiveForm = "none" | "stok-masuk" | "stok-keluar" | "tambah-barang";
type StokMasukTab = "restock" | "new";

export default function Stock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "available">("all");
  const [activeForm, setActiveForm] = useState<ActiveForm>("none");
  const [stokMasukTab, setStokMasukTab] = useState<StokMasukTab>("restock");
  
  // Stok Masuk (Restock) form
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [deliveryStatus, setDeliveryStatus] = useState<"received" | "otw">("received");
  
  // Tambah Barang Baru form
  const [newProductForm, setNewProductForm] = useState<NewProductFormData>(defaultNewProductForm);
  const [uploading, setUploading] = useState(false);
  
  // Delete dialog
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  
  // Edit mode
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Query products with stock
  const { data: products, isLoading } = useQuery({
    queryKey: ["products-with-stock"],
    queryFn: async () => {
      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;

      const productsWithStock = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: batches } = await supabase
            .from("product_batches")
            .select("remaining_quantity")
            .eq("product_id", product.id);

          const totalStock = (batches || []).reduce(
            (sum, b) => sum + (b.remaining_quantity || 0),
            0
          );

          return { ...product, totalStock } as Product;
        })
      );

      return productsWithStock;
    },
  });

  // Filter products based on search and stock filter
  const filteredProducts = useMemo(() => {
    return products?.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase());
      
      if (stockFilter === "low") {
        return matchesSearch && (product.totalStock || 0) <= product.low_stock_threshold;
      }
      if (stockFilter === "available") {
        return matchesSearch && (product.totalStock || 0) > 0;
      }
      return matchesSearch;
    });
  }, [products, search, stockFilter]);

  // Count stats
  const stats = useMemo(() => {
    const all = products?.length || 0;
    const low = products?.filter(p => (p.totalStock || 0) <= p.low_stock_threshold).length || 0;
    const available = products?.filter(p => (p.totalStock || 0) > 0).length || 0;
    return { all, low, available };
  }, [products]);

  // Create new product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: NewProductFormData) => {
      // Calculate cost per pcs
      let totalPcs = data.purchaseQty;
      if (data.purchaseUnit === "set") {
        totalPcs = data.purchaseQty * data.pcs_per_set;
      } else if (data.purchaseUnit === "karton") {
        totalPcs = data.purchaseQty * data.sets_per_karton * data.pcs_per_set;
      }
      const costPerPcs = totalPcs > 0 ? data.totalPurchasePrice / totalPcs : 0;

      // Create product
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          name: data.name,
          sku: data.sku,
          photo_url: data.photo_url || null,
          pcs_per_set: data.pcs_per_set || 1,
          sets_per_karton: data.sets_per_karton || 1,
          selling_price: data.sellingPricePerPcs,
          category: "Blindbox",
          low_stock_threshold: 5,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Create initial batch if quantity > 0
      if (totalPcs > 0) {
        const { error: batchError } = await supabase
          .from("product_batches")
          .insert({
            product_id: product.id,
            quantity: totalPcs,
            remaining_quantity: totalPcs,
            cost_price: costPerPcs,
            batch_code: `INIT-${Date.now()}`,
          });

        if (batchError) throw batchError;
      }

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      setActiveForm("none");
      setNewProductForm(defaultNewProductForm);
      toast({
        title: "Produk berhasil ditambahkan",
        description: "Produk baru telah ditambahkan ke inventori",
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

  // Add stock (restock) mutation
  const addStockMutation = useMutation({
    mutationFn: async ({ productId, qty, status }: { productId: string; qty: number; status: "received" | "otw" }) => {
      if (status === "received") {
        // Add directly to inventory
        const { error } = await supabase
          .from("product_batches")
          .insert({
            product_id: productId,
            quantity: qty,
            remaining_quantity: qty,
            cost_price: 0,
            batch_code: `RESTOCK-${Date.now()}`,
          });

        if (error) throw error;
      } else {
        // Create cargo shipment for OTW
        const { error } = await supabase
          .from("cargo_shipments")
          .insert({
            status: "ordered",
            total_value: 0,
            notes: `Restock produk`,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      setActiveForm("none");
      setSelectedProductId("");
      setQuantity("");
      toast({
        title: "Stok berhasil ditambahkan",
        description: deliveryStatus === "received" 
          ? "Stok langsung ditambahkan ke inventory"
          : "Kargo OTW telah dicatat",
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

  // Remove stock mutation
  const removeStockMutation = useMutation({
    mutationFn: async ({ productId, qty }: { productId: string; qty: number }) => {
      // Get batches using FIFO
      const { data: batches, error: batchError } = await supabase
        .from("product_batches")
        .select("*")
        .eq("product_id", productId)
        .gt("remaining_quantity", 0)
        .order("received_at", { ascending: true });

      if (batchError) throw batchError;

      let remaining = qty;
      for (const batch of batches || []) {
        if (remaining <= 0) break;

        const deduct = Math.min(batch.remaining_quantity, remaining);
        const { error } = await supabase
          .from("product_batches")
          .update({ remaining_quantity: batch.remaining_quantity - deduct })
          .eq("id", batch.id);

        if (error) throw error;
        remaining -= deduct;
      }

      if (remaining > 0) {
        throw new Error("Stok tidak mencukupi");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      setActiveForm("none");
      setSelectedProductId("");
      setQuantity("");
      toast({
        title: "Stok berhasil dikurangi",
        description: "Stok telah dikurangi dari inventory",
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

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      setDeleteProduct(null);
      toast({
        title: "Produk dihapus",
        description: "Produk berhasil dihapus dari sistem",
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

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-photos")
        .getPublicUrl(filePath);

      setNewProductForm((prev) => ({ ...prev, photo_url: data.publicUrl }));
      toast({
        title: "Upload berhasil",
        description: "Foto produk berhasil diupload",
      });
    } catch (error: any) {
      toast({
        title: "Upload gagal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveStokMasuk = () => {
    if (!selectedProductId || !quantity) return;
    addStockMutation.mutate({
      productId: selectedProductId,
      qty: parseInt(quantity),
      status: deliveryStatus,
    });
  };

  const handleSaveStokKeluar = () => {
    if (!selectedProductId || !quantity) return;
    removeStockMutation.mutate({
      productId: selectedProductId,
      qty: parseInt(quantity),
    });
  };

  const handleSaveNewProduct = () => {
    if (!newProductForm.name || !newProductForm.sku) return;
    createProductMutation.mutate(newProductForm);
  };

  const resetForms = () => {
    setSelectedProductId("");
    setQuantity("");
    setDeliveryStatus("received");
    setNewProductForm(defaultNewProductForm);
    setStokMasukTab("restock");
  };

  const handleFormToggle = (form: ActiveForm) => {
    if (activeForm === form) {
      setActiveForm("none");
    } else {
      resetForms();
      setActiveForm(form);
    }
  };

  // Auto-calculate set and karton prices
  const autoCalculatedSetPrice = newProductForm.sellingPricePerPcs * newProductForm.pcs_per_set;
  const autoCalculatedKartonPrice = autoCalculatedSetPrice * newProductForm.sets_per_karton;

  const getStockStatus = (product: Product) => {
    const stock = product.totalStock || 0;
    if (stock === 0) return { label: "Habis", variant: "destructive" as const };
    if (stock <= product.low_stock_threshold)
      return { label: "Menipis", variant: "secondary" as const };
    return { label: "Ready", variant: "default" as const };
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-3"
        >
          <Button
            onClick={() => handleFormToggle("tambah-barang")}
            className="gap-2 bg-gradient-primary hover:opacity-90 text-white rounded-full px-5"
            variant={activeForm === "tambah-barang" ? "default" : "outline"}
            style={activeForm !== "tambah-barang" ? { 
              background: "linear-gradient(135deg, hsl(340, 80%, 70%) 0%, hsl(280, 70%, 75%) 100%)",
              color: "white",
              border: "none"
            } : {}}
          >
            <Sparkles className="w-4 h-4" />
            Tambah Barang Baru
          </Button>
          <Button
            onClick={() => handleFormToggle("stok-masuk")}
            className="gap-2 rounded-full px-5"
            style={{ 
              background: activeForm === "stok-masuk" ? "hsl(165, 60%, 45%)" : "hsl(165, 60%, 75%)",
              color: activeForm === "stok-masuk" ? "white" : "hsl(165, 50%, 20%)",
              border: "none"
            }}
          >
            <Plus className="w-4 h-4" />
            Tambah Stok Masuk
          </Button>
          <Button
            onClick={() => handleFormToggle("stok-keluar")}
            className="gap-2 rounded-full px-5"
            style={{ 
              background: activeForm === "stok-keluar" ? "hsl(0, 70%, 55%)" : "hsl(0, 70%, 65%)",
              color: "white",
              border: "none"
            }}
          >
            <Minus className="w-4 h-4" />
            Tambah Stok Keluar
          </Button>
        </motion.div>

        {/* Stok Keluar Form */}
        {activeForm === "stok-keluar" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Stok Keluar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Pilih Produk</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <Input
                    type="number"
                    placeholder="Masukkan jumlah"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveStokKeluar}
                    disabled={removeStockMutation.isPending || !selectedProductId || !quantity}
                    className="flex-1 rounded-full"
                    style={{ background: "hsl(165, 60%, 45%)", color: "white" }}
                  >
                    {removeStockMutation.isPending ? "Menyimpan..." : "Simpan"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveForm("none")}
                    className="flex-1 rounded-full"
                  >
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stok Masuk Form */}
        {activeForm === "stok-masuk" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Stok Masuk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tab Toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-xl">
                  <button
                    onClick={() => setStokMasukTab("restock")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      stokMasukTab === "restock"
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={stokMasukTab === "restock" ? { 
                      border: "2px solid hsl(165, 60%, 75%)"
                    } : {}}
                  >
                    <CheckCircle2 className="w-4 h-4" style={{ color: "hsl(165, 60%, 45%)" }} />
                    Restock Barang Existing
                  </button>
                  <button
                    onClick={() => {
                      setStokMasukTab("new");
                      setActiveForm("tambah-barang");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      stokMasukTab === "new"
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" style={{ color: "hsl(340, 80%, 70%)" }} />
                    Tambah Barang Baru
                  </button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Pilih produk yang sudah ada untuk menambah stok
                </p>

                <div className="space-y-2">
                  <Label>Pilih Produk</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <Input
                    type="number"
                    placeholder="Masukkan jumlah"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                {/* Delivery Status */}
                <div className="space-y-2">
                  <Label>Status Pengiriman</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeliveryStatus("received")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                        deliveryStatus === "received"
                          ? "border-transparent text-white"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                      }`}
                      style={deliveryStatus === "received" ? { 
                        background: "hsl(165, 60%, 45%)",
                      } : {}}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Received (Sudah Diterima)
                    </button>
                    <button
                      onClick={() => setDeliveryStatus("otw")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                        deliveryStatus === "otw"
                          ? "border-transparent text-white bg-warning"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      OTW (On The Way)
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {deliveryStatus === "received" 
                      ? "Stok akan langsung ditambahkan ke inventory"
                      : "Stok akan masuk ke daftar kargo OTW"}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveStokMasuk}
                    disabled={addStockMutation.isPending || !selectedProductId || !quantity}
                    className="flex-1 rounded-full"
                    style={{ background: "hsl(165, 60%, 45%)", color: "white" }}
                  >
                    {addStockMutation.isPending ? "Menyimpan..." : "Simpan"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveForm("none")}
                    className="flex-1 rounded-full"
                  >
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tambah Barang Baru Form */}
        {activeForm === "tambah-barang" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Tambah Barang Baru</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Nama Produk */}
                <div className="space-y-2">
                  <Label>Nama Produk</Label>
                  <Input
                    placeholder="Contoh: Blindbox One Piece Series 5"
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {/* SKU */}
                <div className="space-y-2">
                  <Label>SKU (Kode Produk)</Label>
                  <Input
                    placeholder="Contoh: BB-OPS"
                    value={newProductForm.sku}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, sku: e.target.value }))}
                  />
                </div>

                {/* Upload Foto */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    📸 Upload Foto Produk <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">Metode Upload</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewProductForm(prev => ({ ...prev, uploadMethod: "url" }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                        newProductForm.uploadMethod === "url"
                          ? "border-transparent bg-gradient-primary text-white"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <LinkIcon className="w-4 h-4" />
                      URL
                    </button>
                    <button
                      onClick={() => setNewProductForm(prev => ({ ...prev, uploadMethod: "file" }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                        newProductForm.uploadMethod === "file"
                          ? "border-transparent bg-gradient-primary text-white"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      File
                    </button>
                  </div>
                  {newProductForm.uploadMethod === "url" ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Masukkan URL Gambar</p>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={newProductForm.photo_url}
                        onChange={(e) => setNewProductForm(prev => ({ ...prev, photo_url: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  )}
                  {newProductForm.photo_url && (
                    <img
                      src={newProductForm.photo_url}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  )}
                </div>

                {/* Konfigurasi Unit */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    📦 Konfigurasi Unit <span className="text-muted-foreground text-xs">(isi sesuai kebutuhan)</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        1 Set = <span className="text-primary underline cursor-pointer">berapa pcs?</span>
                      </p>
                      <Input
                        type="number"
                        placeholder="Contoh: 12"
                        value={newProductForm.pcs_per_set || ""}
                        onChange={(e) => setNewProductForm(prev => ({ ...prev, pcs_per_set: parseInt(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground">Opsional - kosongkan jika tidak ada</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        1 Karton = <span className="text-primary underline cursor-pointer">berapa pcs?</span>
                      </p>
                      <Input
                        type="number"
                        placeholder="Contoh: 144"
                        value={newProductForm.sets_per_karton ? newProductForm.sets_per_karton * newProductForm.pcs_per_set : ""}
                        onChange={(e) => {
                          const pcsPerKarton = parseInt(e.target.value) || 0;
                          const setsPerKarton = newProductForm.pcs_per_set > 0 ? Math.ceil(pcsPerKarton / newProductForm.pcs_per_set) : 1;
                          setNewProductForm(prev => ({ ...prev, sets_per_karton: setsPerKarton }));
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Opsional - kosongkan jika tidak ada</p>
                    </div>
                  </div>
                </div>

                {/* Info Pembelian (Modal) */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    💰 Info Pembelian (Modal)
                  </Label>
                  <p className="text-sm text-muted-foreground">Beli dalam unit apa?</p>
                  <div className="flex gap-2">
                    {(["pcs", "set", "karton"] as const).map((unit) => (
                      <button
                        key={unit}
                        onClick={() => setNewProductForm(prev => ({ ...prev, purchaseUnit: unit }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                          newProductForm.purchaseUnit === unit
                            ? "border-transparent text-white"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                        style={newProductForm.purchaseUnit === unit ? { 
                          background: "hsl(165, 60%, 45%)",
                        } : {}}
                      >
                        📦 {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Jumlah {newProductForm.purchaseUnit.charAt(0).toUpperCase() + newProductForm.purchaseUnit.slice(1)}</Label>
                      <Input
                        type="number"
                        placeholder="Contoh: 10"
                        value={newProductForm.purchaseQty || ""}
                        onChange={(e) => setNewProductForm(prev => ({ ...prev, purchaseQty: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Harga Total Pembelian (Rp)</Label>
                      <Input
                        type="number"
                        placeholder="Contoh: 1440000"
                        value={newProductForm.totalPurchasePrice || ""}
                        onChange={(e) => setNewProductForm(prev => ({ ...prev, totalPurchasePrice: parseInt(e.target.value) || 0 }))}
                        className="bg-peach-light"
                      />
                    </div>
                  </div>
                </div>

                {/* Harga Jual */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    💵 Harga Jual
                  </Label>
                  <div className="space-y-1">
                    <Label>Harga Jual per pcs (Rp) *</Label>
                    <Input
                      type="number"
                      placeholder="Contoh: 15000"
                      value={newProductForm.sellingPricePerPcs || ""}
                      onChange={(e) => setNewProductForm(prev => ({ ...prev, sellingPricePerPcs: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Harga Jual per set (Rp) <span className="text-muted-foreground text-xs">optional</span></Label>
                      <Input
                        type="number"
                        placeholder="Auto"
                        value={newProductForm.sellingPricePerSet || autoCalculatedSetPrice || ""}
                        onChange={(e) => setNewProductForm(prev => ({ ...prev, sellingPricePerSet: parseInt(e.target.value) || 0 }))}
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Harga Jual per karton (Rp) <span className="text-muted-foreground text-xs">optional</span></Label>
                      <Input
                        type="number"
                        placeholder="Auto"
                        value={newProductForm.sellingPricePerKarton || autoCalculatedKartonPrice || ""}
                        onChange={(e) => setNewProductForm(prev => ({ ...prev, sellingPricePerKarton: parseInt(e.target.value) || 0 }))}
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveNewProduct}
                    disabled={createProductMutation.isPending || !newProductForm.name || !newProductForm.sku}
                    className="flex-1 rounded-full gap-2"
                    style={{ background: "hsl(165, 60%, 45%)", color: "white" }}
                  >
                    🐱 {createProductMutation.isPending ? "Menyimpan..." : "Simpan Produk Baru"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveForm("none")}
                    className="flex-1 rounded-full gap-2"
                  >
                    <X className="w-4 h-4" />
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Daftar Stok Barang */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Daftar Stok Barang</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari produk atau SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 rounded-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={stockFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStockFilter("all")}
                    className="rounded-full"
                    style={stockFilter === "all" ? { 
                      background: "hsl(165, 60%, 45%)",
                      color: "white"
                    } : {}}
                  >
                    Semua ({stats.all})
                  </Button>
                  <Button
                    variant={stockFilter === "low" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStockFilter("low")}
                    className="rounded-full"
                  >
                    Stok Rendah ({stats.low})
                  </Button>
                  <Button
                    variant={stockFilter === "available" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStockFilter("available")}
                    className="rounded-full"
                  >
                    Tersedia ({stats.available})
                  </Button>
                </div>
              </div>

              {/* Product Table / Empty State */}
              {isLoading ? (
                <div className="py-12 text-center">
                  <div className="animate-shimmer h-8 w-48 mx-auto rounded" />
                </div>
              ) : filteredProducts?.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium">Belum ada stok barang</p>
                  <p className="text-sm text-muted-foreground">
                    Klik "Tambah Barang Baru" untuk memulai
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Foto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nama Produk</TableHead>
                        <TableHead className="text-right">Stok</TableHead>
                        <TableHead className="text-right">Harga</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts?.map((product) => {
                        const status = getStockStatus(product);
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              {product.photo_url ? (
                                <img
                                  src={product.photo_url}
                                  alt={product.name}
                                  className="w-12 h-12 object-cover rounded-lg"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                  <Package className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {product.sku}
                            </TableCell>
                            <TableCell className="font-medium">
                              {product.name}
                            </TableCell>
                            <TableCell className="text-right">
                              <div>
                                <span className="font-medium">
                                  {formatNumber(product.totalStock || 0)} pcs
                                </span>
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  {Math.floor(
                                    (product.totalStock || 0) / product.pcs_per_set
                                  )}{" "}
                                  set
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(product.selling_price)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingProduct(product)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteProduct(product)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus produk "{deleteProduct?.name}"? Tindakan
              ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProduct && deleteMutation.mutate(deleteProduct.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
