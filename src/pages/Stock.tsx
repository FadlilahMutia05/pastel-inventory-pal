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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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

interface CartItem {
  product: Product;
  quantity: number;
  unit: "pcs" | "set";
  customPrice: number | null; // null means use default price
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

const COURIERS = ["JNE", "SiCepat", "J&T", "AnterAja", "Ninja", "ID Express", "Pos Indonesia", "Manual"];

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
  
  // Stok Keluar form - buyer info & cart
  const [stokKeluarCart, setStokKeluarCart] = useState<CartItem[]>([]);
  const [buyerName, setBuyerName] = useState<string>("");
  const [buyerPhone, setBuyerPhone] = useState<string>("");
  const [buyerCity, setBuyerCity] = useState<string>("");
  const [buyerAddress, setBuyerAddress] = useState<string>("");
  const [courier, setCourier] = useState<string>("JNE");
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [productSearchKeluar, setProductSearchKeluar] = useState<string>("");
  
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

  // Remove stock mutation with sales transaction - supports multiple products with units and custom pricing
  const removeStockMutation = useMutation({
    mutationFn: async ({ 
      cart, 
      customerName, 
      customerPhone,
      customerCity,
      customerAddress,
      courierName,
      resi 
    }: { 
      cart: CartItem[]; 
      customerName: string; 
      customerPhone: string;
      customerCity: string;
      customerAddress: string;
      courierName: string;
      resi: string;
    }) => {
      if (cart.length === 0) throw new Error("Keranjang kosong");
      
      // Helper to get effective price
      const getItemPrice = (item: CartItem) => {
        if (item.customPrice !== null) return item.customPrice;
        if (item.unit === "set") {
          return item.product.selling_price * item.product.pcs_per_set;
        }
        return item.product.selling_price;
      };
      
      // Helper to get pcs equivalent
      const getItemPcs = (item: CartItem) => {
        return item.unit === "set" ? item.quantity * item.product.pcs_per_set : item.quantity;
      };
      
      // Calculate subtotal with custom prices
      const subtotal = cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
      
      // Create sales transaction
      const { data: transaction, error: transactionError } = await supabase
        .from("sales_transactions")
        .insert({
          transaction_code: `MAO-${Date.now()}`,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          customer_city: customerCity || null,
          customer_address: customerAddress || null,
          courier: courierName,
          tracking_number: resi || null,
          subtotal: subtotal,
          shipping_cost: 0,
          total_amount: subtotal,
          total_profit: 0,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      let totalProfit = 0;

      // Process each cart item with FIFO
      for (const item of cart) {
        const pcsToDeduct = getItemPcs(item);
        const unitPrice = getItemPrice(item) / (item.unit === "set" ? item.product.pcs_per_set : 1); // Price per pcs
        let remainingQty = pcsToDeduct;
        
        // Get batches using FIFO
        const { data: batches, error: batchError } = await supabase
          .from("product_batches")
          .select("*")
          .eq("product_id", item.product.id)
          .gt("remaining_quantity", 0)
          .order("received_at", { ascending: true });

        if (batchError) throw batchError;

        // Check if sufficient stock
        const totalAvailable = (batches || []).reduce((sum, b) => sum + b.remaining_quantity, 0);
        if (totalAvailable < pcsToDeduct) {
          throw new Error(`Stok ${item.product.name} tidak mencukupi (tersedia: ${totalAvailable} pcs, dibutuhkan: ${pcsToDeduct} pcs)`);
        }

        for (const batch of batches || []) {
          if (remainingQty <= 0) break;

          const deduct = Math.min(batch.remaining_quantity, remainingQty);
          const itemSubtotal = deduct * unitPrice;
          const itemProfit = itemSubtotal - (deduct * batch.cost_price);
          totalProfit += itemProfit;

          // Update batch
          const { error: updateError } = await supabase
            .from("product_batches")
            .update({ remaining_quantity: batch.remaining_quantity - deduct })
            .eq("id", batch.id);

          if (updateError) throw updateError;

          // Create transaction item
          const { error: itemError } = await supabase
            .from("transaction_items")
            .insert({
              transaction_id: transaction.id,
              product_id: item.product.id,
              product_batch_id: batch.id,
              quantity: deduct,
              unit_price: unitPrice,
              cost_price: batch.cost_price,
              subtotal: itemSubtotal,
              profit: itemProfit,
            });

          if (itemError) throw itemError;
          remainingQty -= deduct;
        }
      }

      // Update transaction with total profit
      await supabase
        .from("sales_transactions")
        .update({ total_profit: totalProfit })
        .eq("id", transaction.id);

      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
      setActiveForm("none");
      resetStokKeluarForm();
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

  // Reset stok keluar form
  const resetStokKeluarForm = () => {
    setStokKeluarCart([]);
    setBuyerName("");
    setBuyerPhone("");
    setBuyerCity("");
    setBuyerAddress("");
    setCourier("JNE");
    setTrackingNumber("");
    setProductSearchKeluar("");
  };

  // Add product to stok keluar cart
  const addToStokKeluarCart = (product: Product) => {
    setStokKeluarCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && item.unit === "pcs");
      if (existing) {
        if (existing.quantity >= (product.totalStock || 0)) {
          toast({
            title: "Stok tidak cukup",
            description: `Stok tersedia: ${product.totalStock} pcs`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id && item.unit === "pcs"
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, unit: "pcs" as const, customPrice: null }];
    });
    setProductSearchKeluar("");
  };

  // Update cart item quantity
  const updateCartQuantity = (productId: string, unit: "pcs" | "set", delta: number) => {
    setStokKeluarCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.unit === unit) {
            const newQty = item.quantity + delta;
            const pcsNeeded = unit === "set" ? newQty * item.product.pcs_per_set : newQty;
            if (pcsNeeded > (item.product.totalStock || 0)) {
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

  // Update cart item unit
  const updateCartUnit = (productId: string, currentUnit: "pcs" | "set", newUnit: "pcs" | "set") => {
    setStokKeluarCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId && item.unit === currentUnit) {
          // Reset quantity to 1 when switching units
          const pcsNeeded = newUnit === "set" ? item.product.pcs_per_set : 1;
          if (pcsNeeded > (item.product.totalStock || 0)) {
            toast({
              title: "Stok tidak cukup untuk 1 set",
              description: `Stok tersedia: ${item.product.totalStock} pcs`,
              variant: "destructive",
            });
            return item;
          }
          return { ...item, unit: newUnit, quantity: 1 };
        }
        return item;
      })
    );
  };

  // Update cart item custom price
  const updateCartCustomPrice = (productId: string, unit: "pcs" | "set", price: string) => {
    const numPrice = price === "" ? null : parseFloat(price);
    setStokKeluarCart((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.unit === unit
          ? { ...item, customPrice: numPrice }
          : item
      )
    );
  };

  // Get effective price for cart item
  const getEffectivePrice = (item: CartItem) => {
    if (item.customPrice !== null) return item.customPrice;
    if (item.unit === "set") {
      return item.product.selling_price * item.product.pcs_per_set;
    }
    return item.product.selling_price;
  };

  // Get pcs equivalent for stock deduction
  const getPcsEquivalent = (item: CartItem) => {
    return item.unit === "set" ? item.quantity * item.product.pcs_per_set : item.quantity;
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setStokKeluarCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Filter products for stok keluar search
  const filteredProductsKeluar = products?.filter(
    (p) =>
      (p.totalStock || 0) > 0 &&
      (p.name.toLowerCase().includes(productSearchKeluar.toLowerCase()) ||
       p.sku.toLowerCase().includes(productSearchKeluar.toLowerCase()))
  );

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

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      name: string; 
      sku: string; 
      selling_price: number; 
      pcs_per_set: number; 
      sets_per_karton: number; 
      low_stock_threshold: number;
      photo_url: string | null;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({
          name: data.name,
          sku: data.sku,
          selling_price: data.selling_price,
          pcs_per_set: data.pcs_per_set,
          sets_per_karton: data.sets_per_karton,
          low_stock_threshold: data.low_stock_threshold,
          photo_url: data.photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      setEditingProduct(null);
      toast({
        title: "Produk diperbarui",
        description: "Data produk berhasil diperbarui",
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
    if (stokKeluarCart.length === 0 || !buyerName) return;
    removeStockMutation.mutate({
      cart: stokKeluarCart,
      customerName: buyerName,
      customerPhone: buyerPhone,
      customerCity: buyerCity,
      customerAddress: buyerAddress,
      courierName: courier,
      resi: trackingNumber,
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
    resetStokKeluarForm();
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
                <CardTitle className="text-lg font-semibold">Stok Keluar / Penjualan Manual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Search & Add */}
                <div className="space-y-2">
                  <Label>Cari & Tambah Produk</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari produk..."
                      value={productSearchKeluar}
                      onChange={(e) => setProductSearchKeluar(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {productSearchKeluar && filteredProductsKeluar && filteredProductsKeluar.length > 0 && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto bg-background">
                      {filteredProductsKeluar.slice(0, 5).map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addToStokKeluarCart(product)}
                          className="w-full flex items-center justify-between p-2 hover:bg-muted text-left"
                        >
                          <div className="flex items-center gap-2">
                            {product.photo_url ? (
                              <img src={product.photo_url} alt="" className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.sku}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(product.selling_price)}</p>
                            <Badge variant="secondary" className="text-xs">Stok: {product.totalStock}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cart Items */}
                {stokKeluarCart.length > 0 && (
                  <div className="space-y-2">
                    <Label>Produk Dipilih ({stokKeluarCart.length})</Label>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {stokKeluarCart.map((item, idx) => (
                        <div
                          key={`${item.product.id}-${item.unit}-${idx}`}
                          className="p-3 rounded-lg bg-muted/50 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {item.product.photo_url ? (
                                <img src={item.product.photo_url} alt="" className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                  <Package className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{item.product.name}</p>
                                <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          {/* Unit & Quantity Row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select 
                              value={item.unit} 
                              onValueChange={(val: "pcs" | "set") => updateCartUnit(item.product.id, item.unit, val)}
                            >
                              <SelectTrigger className="w-24 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pcs">Pcs</SelectItem>
                                <SelectItem value="set">Set ({item.product.pcs_per_set} pcs)</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartQuantity(item.product.id, item.unit, -1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value) || 0;
                                  const delta = newQty - item.quantity;
                                  if (delta !== 0) updateCartQuantity(item.product.id, item.unit, delta);
                                }}
                                className="w-16 h-8 text-center text-sm"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartQuantity(item.product.id, item.unit, 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            <span className="text-xs text-muted-foreground">
                              = {getPcsEquivalent(item)} pcs
                            </span>
                          </div>
                          
                          {/* Price Row */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Harga per {item.unit === "set" ? "Set" : "Pcs"}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder={formatNumber(item.unit === "set" ? item.product.selling_price * item.product.pcs_per_set : item.product.selling_price)}
                                  value={item.customPrice ?? ""}
                                  onChange={(e) => updateCartCustomPrice(item.product.id, item.unit, e.target.value)}
                                  className="h-8 text-sm"
                                />
                                {item.customPrice !== null && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs px-2"
                                    onClick={() => updateCartCustomPrice(item.product.id, item.unit, "")}
                                  >
                                    Reset
                                  </Button>
                                )}
                              </div>
                              {item.customPrice !== null && (
                                <p className="text-xs text-orange-500 mt-0.5">
                                  Harga normal: {formatCurrency(item.unit === "set" ? item.product.selling_price * item.product.pcs_per_set : item.product.selling_price)}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <Label className="text-xs text-muted-foreground">Subtotal</Label>
                              <p className="font-semibold text-sm">
                                {formatCurrency(getEffectivePrice(item) * item.quantity)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span>Total</span>
                      <span className="text-primary">
                        {formatCurrency(stokKeluarCart.reduce((sum, item) => sum + getEffectivePrice(item) * item.quantity, 0))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Customer Info */}
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base font-semibold">Informasi Pembeli</Label>
                  
                  <div className="space-y-2">
                    <Label>Nama Pembeli *</Label>
                    <Input
                      placeholder="Nama lengkap pembeli"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>No. HP</Label>
                      <Input
                        placeholder="08xxxxxxxxxx"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kota</Label>
                      <Input
                        placeholder="Kota tujuan"
                        value={buyerCity}
                        onChange={(e) => setBuyerCity(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Alamat Lengkap</Label>
                    <Textarea
                      placeholder="Alamat lengkap pembeli..."
                      value={buyerAddress}
                      onChange={(e) => setBuyerAddress(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Ekspedisi</Label>
                      <Select value={courier} onValueChange={setCourier}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COURIERS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>No. Resi</Label>
                      <Input
                        placeholder="Opsional"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSaveStokKeluar}
                    disabled={removeStockMutation.isPending || stokKeluarCart.length === 0 || !buyerName}
                    className="flex-1 rounded-full"
                    style={{ background: "hsl(165, 60%, 45%)", color: "white" }}
                  >
                    {removeStockMutation.isPending ? "Menyimpan..." : "Simpan Transaksi"}
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

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Produk</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <EditProductForm 
              product={editingProduct} 
              onSave={(data) => updateProductMutation.mutate(data)}
              onCancel={() => setEditingProduct(null)}
              isLoading={updateProductMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Edit Product Form Component
function EditProductForm({ 
  product, 
  onSave, 
  onCancel,
  isLoading 
}: { 
  product: Product; 
  onSave: (data: { 
    id: string; 
    name: string; 
    sku: string; 
    selling_price: number; 
    pcs_per_set: number; 
    sets_per_karton: number; 
    low_stock_threshold: number;
    photo_url: string | null;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [sellingPrice, setSellingPrice] = useState(product.selling_price.toString());
  const [pcsPerSet, setPcsPerSet] = useState(product.pcs_per_set.toString());
  const [setsPerKarton, setSetsPerKarton] = useState(product.sets_per_karton.toString());
  const [lowStockThreshold, setLowStockThreshold] = useState(product.low_stock_threshold.toString());
  const [photoUrl, setPhotoUrl] = useState(product.photo_url || "");
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url");

  // Auto-calculated prices
  const pricePerPcs = parseFloat(sellingPrice) || 0;
  const pcsPerSetNum = parseInt(pcsPerSet) || 1;
  const setsPerKartonNum = parseInt(setsPerKarton) || 1;
  const pricePerSet = pricePerPcs * pcsPerSetNum;
  const pricePerKarton = pricePerSet * setsPerKartonNum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: product.id,
      name,
      sku,
      selling_price: pricePerPcs,
      pcs_per_set: pcsPerSetNum,
      sets_per_karton: setsPerKartonNum,
      low_stock_threshold: parseInt(lowStockThreshold) || 5,
      photo_url: photoUrl || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nama Produk */}
      <div className="space-y-2">
        <Label>Nama Produk *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama produk"
          required
          className="bg-primary/5 border-primary/20"
        />
      </div>

      {/* SKU */}
      <div className="space-y-2">
        <Label>SKU (Kode Produk) *</Label>
        <Input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
          required
          className="bg-primary/5 border-primary/20"
        />
      </div>

      {/* Stok Ready Info */}
      <div className="space-y-2">
        <Label>Stok Ready (pcs)</Label>
        <Input
          value={product.totalStock?.toString() || "0"}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">Stok yang siap dijual (dalam satuan pcs)</p>
      </div>

      {/* Upload Foto Produk */}
      <div className="space-y-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
        <div className="flex items-center gap-2">
          <span className="text-blue-500">📷</span>
          <Label className="font-medium">Upload Foto Produk</Label>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Metode Upload</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUploadMethod("url")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all border ${
                uploadMethod === "url"
                  ? "bg-white border-primary/30 text-foreground shadow-sm"
                  : "bg-transparent border-transparent text-muted-foreground"
              }`}
            >
              🔗 URL
            </button>
            <button
              type="button"
              onClick={() => setUploadMethod("file")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all border ${
                uploadMethod === "file"
                  ? "bg-white border-primary/30 text-foreground shadow-sm"
                  : "bg-transparent border-transparent text-muted-foreground"
              }`}
            >
              📁 File
            </button>
          </div>
        </div>

        {uploadMethod === "url" ? (
          <div className="space-y-2">
            <Label className="text-sm">Masukkan URL Foto Produk</Label>
            <Input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Contoh: https://example.com/photo.jpg"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-sm">Upload dari File</Label>
            <p className="text-xs text-muted-foreground">Upload file tidak tersedia dalam mode edit. Gunakan URL.</p>
          </div>
        )}

        {photoUrl && (
          <div className="mt-2">
            <Label className="text-sm">Preview</Label>
            <img 
              src={photoUrl} 
              alt="Preview" 
              className="w-20 h-20 object-cover rounded-lg border mt-1"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Konfigurasi Unit */}
      <div className="space-y-3 p-3 rounded-lg bg-purple-50/50 border border-purple-100">
        <div className="flex items-center gap-2">
          <span className="text-purple-500">⚙️</span>
          <Label className="font-medium">Konfigurasi Unit</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm">1 Set = <span className="text-primary">berapa pcs?</span></Label>
            <Input
              type="number"
              min="1"
              value={pcsPerSet}
              onChange={(e) => setPcsPerSet(e.target.value)}
              placeholder="Contoh: 12"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">1 Karton = <span className="text-primary">berapa pcs?</span></Label>
            <Input
              type="number"
              min="1"
              value={setsPerKarton}
              onChange={(e) => setSetsPerKarton(e.target.value)}
              placeholder="Contoh: 144"
            />
          </div>
        </div>
      </div>

      {/* Harga Jual */}
      <div className="space-y-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
        <div className="flex items-center gap-2">
          <span className="text-green-500">💰</span>
          <Label className="font-medium">Harga Jual</Label>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm">Harga Jual per pcs (Rp) *</Label>
          <Input
            type="number"
            min="0"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            className="bg-yellow-50 border-yellow-200"
            required
          />
          {pricePerPcs > 0 && (
            <p className="text-xs text-muted-foreground">
              Laba: <span className="text-green-600">Dihitung dari harga modal batch</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm">Harga Jual per set (Rp) <span className="text-muted-foreground text-xs">opsional</span></Label>
            <Input
              type="number"
              value={pricePerSet.toString()}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Harga Jual per karton (Rp) <span className="text-muted-foreground text-xs">opsional</span></Label>
            <Input
              type="number"
              value={pricePerKarton.toString()}
              disabled
              className="bg-muted"
            />
          </div>
        </div>
      </div>

      {/* Batas Stok */}
      <div className="space-y-2">
        <Label>Batas Stok Menipis (pcs)</Label>
        <Input
          type="number"
          min="0"
          value={lowStockThreshold}
          onChange={(e) => setLowStockThreshold(e.target.value)}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <Button 
          type="submit" 
          disabled={isLoading} 
          className="flex-1 gap-2"
          style={{ background: "linear-gradient(135deg, hsl(165, 60%, 45%) 0%, hsl(180, 50%, 45%) 100%)" }}
        >
          ✨ {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel} 
          className="flex-1 gap-2"
        >
          ❌ Batal
        </Button>
      </div>
    </form>
  );
}
