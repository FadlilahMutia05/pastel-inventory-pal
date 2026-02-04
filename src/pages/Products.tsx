import AppLayout from "@/components/layout/AppLayout";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  Upload,
  Link as LinkIcon,
  X,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const PRODUCT_TYPES = [
  { value: "Blindbox", label: "Blind Box" },
  { value: "Figure", label: "Figure" },
  { value: "Plush", label: "Plush" },
  { value: "Accessories", label: "Accessories" },
  { value: "Other", label: "Lainnya" },
];

interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  brand: string;
  series: string;
  description: string;
  selling_price: number;
  pcs_per_set: number;
  low_stock_threshold: number;
  photo_url: string;
}

const defaultFormData: ProductFormData = {
  name: "",
  sku: "",
  category: "Blindbox",
  brand: "",
  series: "",
  description: "",
  selling_price: 0,
  pcs_per_set: 12,
  low_stock_threshold: 5,
  photo_url: "",
};

export default function Products() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);
  const [imageTab, setImageTab] = useState<"url" | "upload">("url");
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Query products with stock
  const { data: products, isLoading } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;

      // Get total stock per product
      const productsWithStock = await Promise.all(
        (data || []).map(async (product) => {
          const { data: batches } = await supabase
            .from("product_batches")
            .select("remaining_quantity")
            .eq("product_id", product.id);

          const totalStock = (batches || []).reduce(
            (sum, b) => sum + (b.remaining_quantity || 0),
            0
          );

          return { ...product, totalStock };
        })
      );

      return productsWithStock;
    },
  });

  // Create/Update product mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update({
            name: data.name,
            sku: data.sku,
            category: data.category,
            brand: data.brand || null,
            series: data.series || null,
            description: data.description || null,
            selling_price: data.selling_price,
            pcs_per_set: data.pcs_per_set,
            low_stock_threshold: data.low_stock_threshold,
            photo_url: data.photo_url || null,
          })
          .eq("id", editingProduct);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert([{
          name: data.name,
          sku: data.sku,
          category: data.category,
          brand: data.brand || null,
          series: data.series || null,
          description: data.description || null,
          selling_price: data.selling_price,
          pcs_per_set: data.pcs_per_set,
          low_stock_threshold: data.low_stock_threshold,
          photo_url: data.photo_url || null,
        }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["products-for-sale"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      setFormData(defaultFormData);
      toast({
        title: editingProduct ? "Produk diperbarui" : "Produk ditambahkan",
        description: "Data produk berhasil disimpan",
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
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      setDeleteProductId(null);
      toast({
        title: "Produk dinonaktifkan",
        description: "Produk telah dinonaktifkan",
      });
    },
  });

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `product-${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("product-photos")
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, photo_url: urlData.publicUrl }));
      toast({ title: "Gambar berhasil diupload" });
    } catch (error: any) {
      toast({
        title: "Gagal upload gambar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openAddDialog = () => {
    setEditingProduct(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product.id);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      brand: product.brand || "",
      series: product.series || "",
      description: product.description || "",
      selling_price: product.selling_price,
      pcs_per_set: product.pcs_per_set,
      low_stock_threshold: product.low_stock_threshold,
      photo_url: product.photo_url || "",
    });
    setIsDialogOpen(true);
  };

  const filteredProducts = products?.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.series && p.series.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === "all" || p.category === filterType;
    return matchesSearch && matchesType && p.is_active;
  });

  return (
    <AppLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold">Produk</h1>
          <p className="text-muted-foreground">Kelola daftar produk blind box</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Tambah Produk
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Semua Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            {PRODUCT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-4">
                <div className="animate-shimmer aspect-square rounded-lg mb-3" />
                <div className="animate-shimmer h-4 rounded mb-2" />
                <div className="animate-shimmer h-3 rounded w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : filteredProducts?.length === 0 ? (
          <Card className="glass-card col-span-full">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {search ? "Produk tidak ditemukan" : "Belum ada produk"}
              </p>
              <p className="text-muted-foreground mb-4">
                {search
                  ? "Coba kata kunci lain"
                  : "Tambahkan produk pertama Anda"}
              </p>
              {!search && (
                <Button onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Produk
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredProducts?.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <Card className="glass-card group hover:shadow-glow transition-all">
                <CardContent className="p-4">
                  {/* Product Image */}
                  <div className="aspect-square rounded-lg bg-muted mb-3 overflow-hidden relative">
                    {product.photo_url ? (
                      <img
                        src={product.photo_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={() => setDeleteProductId(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Product Info */}
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {product.sku}
                  </p>
                  {product.series && (
                    <p className="text-xs text-muted-foreground truncate">
                      {product.series}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="font-bold text-sm text-primary">
                      {formatCurrency(product.selling_price)}
                    </p>
                    <Badge
                      variant={
                        product.totalStock <= product.low_stock_threshold
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {product.totalStock}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Product Info */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Informasi Produk</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nama Produk *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Contoh: Labubu Forest Fairy"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Seri *</Label>
                      <Input
                        value={formData.series}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, series: e.target.value }))
                        }
                        placeholder="Contoh: Labubu, Dimoo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Brand *</Label>
                      <Input
                        value={formData.brand}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, brand: e.target.value }))
                        }
                        placeholder="Contoh: Pop Mart, 52Toys"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipe Produk *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(v) =>
                          setFormData((prev) => ({ ...prev, category: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>SKU *</Label>
                      <Input
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, sku: e.target.value }))
                        }
                        placeholder="Contoh: LBB-FF-001"
                      />
                      <p className="text-xs text-muted-foreground">
                        Kode unik produk
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Deskripsi produk (opsional)"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Harga & Stok</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Harga Jual (IDR) *</Label>
                      <Input
                        type="number"
                        value={formData.selling_price}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            selling_price: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pcs per Box</Label>
                      <Input
                        type="number"
                        value={formData.pcs_per_set}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            pcs_per_set: Number(e.target.value),
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Jumlah pcs dalam 1 box
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Stok Minimum</Label>
                      <Input
                        type="number"
                        value={formData.low_stock_threshold}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            low_stock_threshold: Number(e.target.value),
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Alert jika stok rendah
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Product Image */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Gambar Produk</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Image Preview */}
                  <div className="aspect-square rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                    {formData.photo_url ? (
                      <img
                        src={formData.photo_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">Belum ada gambar</p>
                      </div>
                    )}
                  </div>

                  {/* Image Tabs */}
                  <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as "url" | "upload")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="url" className="gap-2">
                        <LinkIcon className="w-4 h-4" />
                        URL
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Upload
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="url" className="mt-4">
                      <Input
                        value={formData.photo_url}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            photo_url: e.target.value,
                          }))
                        }
                        placeholder="https://example.com/image.jpg"
                      />
                    </TabsContent>

                    <TabsContent value="upload" className="mt-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploading ? "Mengupload..." : "Pilih Gambar"}
                      </Button>
                    </TabsContent>
                  </Tabs>

                  {formData.photo_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, photo_url: "" }))
                      }
                    >
                      <X className="w-4 h-4 mr-2" />
                      Hapus Gambar
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={
                saveMutation.isPending || !formData.name || !formData.sku
              }
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteProductId}
        onOpenChange={() => setDeleteProductId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk akan dinonaktifkan dan tidak muncul di daftar penjualan.
              Data stok dan transaksi tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProductId && deleteMutation.mutate(deleteProductId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
