import AppLayout from "@/components/layout/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Upload,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface ProductFormData {
  sku: string;
  name: string;
  category: string;
  description: string;
  photo_url: string;
  selling_price: number;
  pcs_per_set: number;
  sets_per_karton: number;
  low_stock_threshold: number;
}

const defaultFormData: ProductFormData = {
  sku: "",
  name: "",
  category: "Blindbox",
  description: "",
  photo_url: "",
  selling_price: 0,
  pcs_per_set: 1,
  sets_per_karton: 12,
  low_stock_threshold: 5,
};

const CATEGORIES = ["Blindbox", "Figure", "Plush", "Accessories", "Limited Edition", "Lainnya"];

export default function Stock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [uploadTab, setUploadTab] = useState<"url" | "file">("url");
  const [uploading, setUploading] = useState(false);

  // Query products with stock
  const { data: products, isLoading } = useQuery({
    queryKey: ["products-with-stock"],
    queryFn: async () => {
      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;

      // Get stock for each product
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

  // Create/Update product mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProductFormData & { id?: string }) => {
      if (data.id) {
        // Update
        const { error } = await supabase
          .from("products")
          .update({
            sku: data.sku,
            name: data.name,
            category: data.category,
            description: data.description || null,
            photo_url: data.photo_url || null,
            selling_price: data.selling_price,
            pcs_per_set: data.pcs_per_set,
            sets_per_karton: data.sets_per_karton,
            low_stock_threshold: data.low_stock_threshold,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase.from("products").insert({
          sku: data.sku,
          name: data.name,
          category: data.category,
          description: data.description || null,
          photo_url: data.photo_url || null,
          selling_price: data.selling_price,
          pcs_per_set: data.pcs_per_set,
          sets_per_karton: data.sets_per_karton,
          low_stock_threshold: data.low_stock_threshold,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
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

      setFormData((prev) => ({ ...prev, photo_url: data.publicUrl }));
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

  // Filter products
  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.is_active) ||
      (statusFilter === "inactive" && !product.is_active) ||
      (statusFilter === "low" && (product.totalStock || 0) <= product.low_stock_threshold);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      description: product.description || "",
      photo_url: product.photo_url || "",
      selling_price: product.selling_price,
      pcs_per_set: product.pcs_per_set,
      sets_per_karton: product.sets_per_karton,
      low_stock_threshold: product.low_stock_threshold,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingProduct?.id,
    });
  };

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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold">Kelola Stok</h1>
            <p className="text-muted-foreground">
              {products?.length || 0} produk terdaftar
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                Tambah Produk
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo upload */}
                <div className="space-y-2">
                  <Label>Foto Produk</Label>
                  <Tabs value={uploadTab} onValueChange={(v) => setUploadTab(v as "url" | "file")}>
                    <TabsList className="w-full">
                      <TabsTrigger value="url" className="flex-1 gap-2">
                        <LinkIcon className="w-4 h-4" />
                        URL
                      </TabsTrigger>
                      <TabsTrigger value="file" className="flex-1 gap-2">
                        <Upload className="w-4 h-4" />
                        Upload
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="url" className="mt-2">
                      <Input
                        placeholder="https://example.com/photo.jpg"
                        value={formData.photo_url}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, photo_url: e.target.value }))
                        }
                      />
                    </TabsContent>
                    <TabsContent value="file" className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </TabsContent>
                  </Tabs>
                  {formData.photo_url && (
                    <div className="mt-2">
                      <img
                        src={formData.photo_url}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sku: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
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
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nama Produk *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="selling_price">Harga Jual (Rp) *</Label>
                    <Input
                      id="selling_price"
                      type="number"
                      value={formData.selling_price}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          selling_price: Number(e.target.value),
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">Threshold Stok Rendah</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      value={formData.low_stock_threshold}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          low_stock_threshold: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pcs_per_set">Pcs per Set</Label>
                    <Input
                      id="pcs_per_set"
                      type="number"
                      value={formData.pcs_per_set}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          pcs_per_set: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sets_per_karton">Set per Karton</Label>
                    <Input
                      id="sets_per_karton"
                      type="number"
                      value={formData.sets_per_karton}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sets_per_karton: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari SKU atau nama produk..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                    <SelectItem value="low">Stok Rendah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Products Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Foto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="animate-shimmer h-8 w-full rounded" />
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          {search || categoryFilter !== "all" || statusFilter !== "all"
                            ? "Tidak ada produk yang sesuai filter"
                            : "Belum ada produk. Tambahkan produk pertama Anda!"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts?.map((product) => {
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
                          <TableCell>{product.category}</TableCell>
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
                                onClick={() => openEditDialog(product)}
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
                    })
                  )}
                </TableBody>
              </Table>
            </div>
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
