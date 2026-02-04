import AppLayout from "@/components/layout/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDateShort, formatDateTime } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Search,
  Copy,
  Check,
  Receipt,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Transaction {
  id: string;
  transaction_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_city: string | null;
  customer_address: string | null;
  courier: string;
  shipping_type: string;
  tracking_number: string | null;
  status: string;
  total_amount: number;
  total_profit: number;
  shipping_cost: number | null;
  notes: string | null;
  transaction_date: string;
}

interface TransactionItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  profit: number;
  products: {
    name: string;
    sku: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "Pending", icon: <Clock className="w-3 h-3" />, color: "bg-sky-light" },
  packing: { label: "Dikemas", icon: <Package className="w-3 h-3" />, color: "bg-lavender-light" },
  shipped: { label: "Dikirim", icon: <Truck className="w-3 h-3" />, color: "bg-peach-light" },
  completed: { label: "Selesai", icon: <CheckCircle className="w-3 h-3" />, color: "bg-mint-light" },
  cancelled: { label: "Batal", icon: <XCircle className="w-3 h-3" />, color: "bg-destructive/20" },
};

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);

  // Edit form states
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerCity, setEditCustomerCity] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editCourier, setEditCourier] = useState("");
  const [editShippingType, setEditShippingType] = useState("");
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editShippingCost, setEditShippingCost] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Shipping type and courier options
  const shippingTypes = ["instant", "same_day", "normal", "cargo"];
  const couriersByType: Record<string, string[]> = {
    instant: ["GoSend", "GrabExpress", "Lalamove"],
    same_day: ["JNE YES", "SiCepat BEST", "AnterAja Same Day"],
    normal: ["JNE REG", "JNE OKE", "SiCepat REG", "SiCepat HALU", "AnterAja REG", "J&T Express", "Ninja Express", "ID Express"],
    cargo: ["JNE Trucking", "SiCepat Cargo", "Indah Cargo", "J&T Cargo", "SPX Cargo", "Kargo Kilat"],
  };

  // Initialize edit form when editTransaction changes
  const openEditDialog = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setEditCustomerName(transaction.customer_name);
    setEditCustomerPhone(transaction.customer_phone || "");
    setEditCustomerCity(transaction.customer_city || "");
    setEditCustomerAddress(transaction.customer_address || "");
    setEditCourier(transaction.courier);
    setEditShippingType(transaction.shipping_type || "normal");
    setEditTrackingNumber(transaction.tracking_number || "");
    setEditShippingCost(transaction.shipping_cost?.toString() || "0");
    setEditNotes(transaction.notes || "");
  };

  // Query transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["sales-transactions", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("sales_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (dateFilter) {
        const startDate = new Date(dateFilter);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateFilter);
        endDate.setHours(23, 59, 59, 999);

        query = query
          .gte("transaction_date", startDate.toISOString())
          .lte("transaction_date", endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Query transaction items
  const { data: transactionItems } = useQuery({
    queryKey: ["transaction-items", selectedTransaction?.id],
    queryFn: async () => {
      if (!selectedTransaction) return [];
      const { data, error } = await supabase
        .from("transaction_items")
        .select("*, products(name, sku)")
        .eq("transaction_id", selectedTransaction.id);
      if (error) throw error;
      return data as TransactionItem[];
    },
    enabled: !!selectedTransaction,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, any> = { status };
      if (status === "shipped") updateData.shipped_date = new Date().toISOString();
      if (status === "completed") updateData.completed_date = new Date().toISOString();

      const { error } = await supabase
        .from("sales_transactions")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
      toast({
        title: "Status diperbarui",
        description: "Status transaksi berhasil diubah",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update transaction mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      customer_name: string;
      customer_phone: string | null;
      customer_city: string | null;
      customer_address: string | null;
      courier: string;
      shipping_type: string;
      tracking_number: string | null;
      shipping_cost: number;
      notes: string | null;
    }) => {
      const { error } = await supabase
        .from("sales_transactions")
        .update({
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_city: data.customer_city || null,
          customer_address: data.customer_address || null,
          courier: data.courier,
          shipping_type: data.shipping_type,
          tracking_number: data.tracking_number || null,
          shipping_cost: data.shipping_cost,
          notes: data.notes || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
      setEditTransaction(null);
      toast({
        title: "Transaksi diperbarui",
        description: "Data transaksi berhasil diperbarui",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete transaction mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: async (transaction: Transaction) => {
      // First get the transaction items to restore stock
      const { data: items, error: itemsError } = await supabase
        .from("transaction_items")
        .select("*, product_batches(id, remaining_quantity)")
        .eq("transaction_id", transaction.id);

      if (itemsError) throw itemsError;

      // Restore stock to batches (FIFO reverse)
      for (const item of items || []) {
        if (item.product_batch_id) {
          const currentQty = item.product_batches?.remaining_quantity || 0;
          await supabase
            .from("product_batches")
            .update({ remaining_quantity: currentQty + item.quantity })
            .eq("id", item.product_batch_id);
        }
      }

      // Delete transaction items first (foreign key constraint)
      const { error: deleteItemsError } = await supabase
        .from("transaction_items")
        .delete()
        .eq("transaction_id", transaction.id);

      if (deleteItemsError) throw deleteItemsError;

      // Then delete the transaction
      const { error: deleteError } = await supabase
        .from("sales_transactions")
        .delete()
        .eq("id", transaction.id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      setDeleteTransaction(null);
      toast({
        title: "Transaksi dihapus",
        description: "Transaksi berhasil dihapus dan stok dikembalikan",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveEdit = () => {
    if (!editTransaction) return;
    updateTransactionMutation.mutate({
      id: editTransaction.id,
      customer_name: editCustomerName.trim(),
      customer_phone: editCustomerPhone.trim() || null,
      customer_city: editCustomerCity.trim() || null,
      customer_address: editCustomerAddress.trim() || null,
      courier: editCourier,
      shipping_type: editShippingType,
      tracking_number: editTrackingNumber.trim() || null,
      shipping_cost: parseFloat(editShippingCost) || 0,
      notes: editNotes.trim() || null,
    });
  };

  const filteredTransactions = transactions?.filter((t) => {
    const matchesSearch =
      t.transaction_code.toLowerCase().includes(search.toLowerCase()) ||
      t.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      t.tracking_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Generate WhatsApp format for single transaction
  const generateWhatsAppMessage = (t: Transaction) => {
    return `🎁 Resi Pengiriman Mao~Mao Store
📦 ${t.customer_name}
📍 ${t.customer_city || "-"}
🚚 ${t.courier}: ${t.tracking_number || "-"}
✨ Terima kasih sudah belanja!`;
  };

  // Generate bulk WhatsApp messages
  const generateBulkMessages = () => {
    const shippedToday = filteredTransactions?.filter(
      (t) => t.status === "shipped" && t.tracking_number
    );
    if (!shippedToday?.length) return "";

    return shippedToday
      .map((t) => generateWhatsAppMessage(t))
      .join("\n\n---\n\n");
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Tersalin!",
      description: "Teks berhasil disalin ke clipboard",
    });
  };

  const getNextStatus = (current: string): string | null => {
    const flow = ["pending", "packing", "shipped", "completed"];
    const idx = flow.indexOf(current);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
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
            <h1 className="text-2xl font-bold">Transaksi Harian</h1>
            <p className="text-muted-foreground">
              {filteredTransactions?.length || 0} transaksi
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              const messages = generateBulkMessages();
              if (messages) {
                copyToClipboard(messages, "bulk");
              } else {
                toast({
                  title: "Tidak ada resi",
                  description: "Tidak ada transaksi shipped dengan nomor resi",
                  variant: "destructive",
                });
              }
            }}
          >
            {copied === "bulk" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Export Resi Grup
          </Button>
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
                    placeholder="Cari kode, nama, atau resi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pl-10 w-full sm:w-44"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="packing">Dikemas</SelectItem>
                    <SelectItem value="shipped">Dikirim</SelectItem>
                    <SelectItem value="completed">Selesai</SelectItem>
                    <SelectItem value="cancelled">Batal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transactions Table */}
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
                    <TableHead>Kode</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Ekspedisi</TableHead>
                    <TableHead>Resi</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
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
                  ) : filteredTransactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          Tidak ada transaksi
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions?.map((transaction) => {
                      const statusConfig = STATUS_CONFIG[transaction.status];
                      const nextStatus = getNextStatus(transaction.status);

                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <button
                              className="font-mono text-sm text-primary hover:underline"
                              onClick={() => setSelectedTransaction(transaction)}
                            >
                              {transaction.transaction_code}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {formatDateShort(transaction.transaction_date)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{transaction.customer_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {transaction.customer_city || "-"}
                            </p>
                          </TableCell>
                          <TableCell>{transaction.courier}</TableCell>
                          <TableCell>
                            {transaction.tracking_number ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-sm">
                                  {transaction.tracking_number}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    copyToClipboard(
                                      generateWhatsAppMessage(transaction),
                                      transaction.id
                                    )
                                  }
                                >
                                  {copied === transaction.id ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(transaction.total_amount)}
                          </TableCell>
                          <TableCell className="text-right text-success-foreground font-medium">
                            {formatCurrency(transaction.total_profit)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig.color}>
                              {statusConfig.icon}
                              <span className="ml-1">{statusConfig.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {nextStatus && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: transaction.id,
                                      status: nextStatus,
                                    })
                                  }
                                  disabled={updateStatusMutation.isPending}
                                >
                                  {STATUS_CONFIG[nextStatus].label}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => openEditDialog(transaction)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTransaction(transaction)}
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

      {/* Transaction Detail Dialog */}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={() => setSelectedTransaction(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Transaksi</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Kode</p>
                  <p className="font-mono font-medium">
                    {selectedTransaction.transaction_code}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="font-medium">
                    {formatDateTime(selectedTransaction.transaction_date)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedTransaction.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kota</p>
                  <p className="font-medium">
                    {selectedTransaction.customer_city || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ekspedisi</p>
                  <p className="font-medium">{selectedTransaction.courier}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Resi</p>
                  <p className="font-mono font-medium">
                    {selectedTransaction.tracking_number || "-"}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="border-t pt-4">
                <p className="font-semibold mb-2">Produk</p>
                <div className="space-y-2">
                  {transactionItems?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{item.products.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.products.sku} × {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                        <p className="text-xs text-success-foreground">
                          +{formatCurrency(item.profit)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">
                    {formatCurrency(selectedTransaction.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-success-foreground">
                  <span>Profit</span>
                  <span className="font-medium">
                    {formatCurrency(selectedTransaction.total_profit)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editTransaction} onOpenChange={() => setEditTransaction(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaksi</DialogTitle>
            <DialogDescription>
              Kode: <span className="font-mono">{editTransaction?.transaction_code}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nama Customer *</Label>
                <Input
                  id="edit-name"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="Nama customer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">No. Telepon</Label>
                <Input
                  id="edit-phone"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-city">Kota</Label>
                <Input
                  id="edit-city"
                  value={editCustomerCity}
                  onChange={(e) => setEditCustomerCity(e.target.value)}
                  placeholder="Kota tujuan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-shipping-cost">Ongkir</Label>
                <Input
                  id="edit-shipping-cost"
                  type="number"
                  value={editShippingCost}
                  onChange={(e) => setEditShippingCost(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">Alamat Lengkap</Label>
              <Textarea
                id="edit-address"
                value={editCustomerAddress}
                onChange={(e) => setEditCustomerAddress(e.target.value)}
                placeholder="Alamat lengkap pengiriman"
                rows={2}
              />
            </div>

            {/* Shipping Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipe Pengiriman</Label>
                <Select value={editShippingType} onValueChange={(val) => {
                  setEditShippingType(val);
                  // Reset courier if current not in new type's list
                  if (!couriersByType[val]?.includes(editCourier)) {
                    setEditCourier(couriersByType[val]?.[0] || "");
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === "instant" ? "Instant" : type === "same_day" ? "Same Day" : type === "normal" ? "Normal" : "Cargo"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kurir</Label>
                <Select value={editCourier} onValueChange={setEditCourier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {couriersByType[editShippingType]?.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tracking Number - Highlighted */}
            <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Label htmlFor="edit-tracking" className="text-primary font-medium">
                Nomor Resi 📦
              </Label>
              <Input
                id="edit-tracking"
                value={editTrackingNumber}
                onChange={(e) => setEditTrackingNumber(e.target.value)}
                placeholder="Masukkan nomor resi"
                className="font-mono"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Catatan</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditTransaction(null)}>
              Batal
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editCustomerName.trim() || updateTransactionMutation.isPending}
            >
              {updateTransactionMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTransaction} onOpenChange={() => setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Anda yakin ingin menghapus transaksi{" "}
                <span className="font-mono font-semibold text-foreground">
                  {deleteTransaction?.transaction_code}
                </span>
                ?
              </p>
              <p className="text-sm">
                Pelanggan: <span className="font-medium">{deleteTransaction?.customer_name}</span>
              </p>
              <p className="text-sm">
                Total: <span className="font-medium">{formatCurrency(deleteTransaction?.total_amount || 0)}</span>
              </p>
              <p className="text-sm">
                Profit: <span className="font-medium text-success-foreground">{formatCurrency(deleteTransaction?.total_profit || 0)}</span>
              </p>
              <p className="mt-3 text-warning-foreground text-sm font-medium">
                ⚠️ Stok produk akan dikembalikan secara otomatis.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTransaction && deleteTransactionMutation.mutate(deleteTransaction)}
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? "Menghapus..." : "Hapus Transaksi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
