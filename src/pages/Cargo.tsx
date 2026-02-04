import AppLayout from "@/components/layout/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Truck,
  Package,
  CheckCircle,
  Ship,
  Clock,
  AlertCircle,
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

interface CargoShipment {
  id: string;
  supplier_id: string | null;
  tracking_number: string | null;
  status: string;
  total_value: number;
  shipping_cost: number | null;
  notes: string | null;
  order_date: string;
  shipped_date: string | null;
  customs_date: string | null;
  arrived_date: string | null;
  received_date: string | null;
  suppliers?: { name: string } | null;
}

interface CargoFormData {
  supplier_id: string;
  shipping_type: string;
  courier_name: string;
  tracking_number: string;
  total_value: number;
  shipping_cost: number;
  notes: string;
}

const defaultFormData: CargoFormData = {
  supplier_id: "",
  shipping_type: "cargo",
  courier_name: "",
  tracking_number: "",
  total_value: 0,
  shipping_cost: 0,
  notes: "",
};

const SHIPPING_TYPES = [
  { value: "cargo", label: "Cargo" },
  { value: "normal", label: "Normal" },
  { value: "sameday", label: "Same Day" },
  { value: "instant", label: "Instant" },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ordered: { label: "Ordered", icon: <Clock className="w-4 h-4" />, color: "bg-sky-light text-sky-foreground" },
  shipped: { label: "Shipped", icon: <Ship className="w-4 h-4" />, color: "bg-lavender-light text-lavender-foreground" },
  customs: { label: "Customs", icon: <AlertCircle className="w-4 h-4" />, color: "bg-peach-light text-warning-foreground" },
  arrived: { label: "Arrived", icon: <Package className="w-4 h-4" />, color: "bg-mint-light text-success-foreground" },
  received: { label: "Received", icon: <CheckCircle className="w-4 h-4" />, color: "bg-pink-light text-pink-foreground" },
};

export default function Cargo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<CargoShipment | null>(null);
  const [formData, setFormData] = useState<CargoFormData>(defaultFormData);
  const [deleteCargo, setDeleteCargo] = useState<CargoShipment | null>(null);

  // Query suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Query cargo shipments
  const { data: cargos, isLoading } = useQuery({
    queryKey: ["cargo-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargo_shipments")
        .select("*, suppliers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CargoShipment[];
    },
  });

  // Calculate floating asset
  const floatingAsset = cargos
    ?.filter((c) => ["ordered", "shipped", "customs"].includes(c.status))
    .reduce((sum, c) => sum + (c.total_value || 0), 0) || 0;

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CargoFormData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("cargo_shipments")
          .update({
            supplier_id: data.supplier_id || null,
            shipping_type: data.shipping_type,
            courier_name: data.courier_name || null,
            tracking_number: data.tracking_number || null,
            total_value: data.total_value,
            shipping_cost: data.shipping_cost || null,
            notes: data.notes || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cargo_shipments").insert({
          supplier_id: data.supplier_id || null,
          shipping_type: data.shipping_type,
          courier_name: data.courier_name || null,
          tracking_number: data.tracking_number || null,
          total_value: data.total_value,
          shipping_cost: data.shipping_cost || null,
          notes: data.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargo-shipments"] });
      setIsDialogOpen(false);
      setEditingCargo(null);
      setFormData(defaultFormData);
      toast({
        title: editingCargo ? "Kargo diperbarui" : "Kargo ditambahkan",
        description: "Data kargo berhasil disimpan",
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

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, any> = { status };
      const now = new Date().toISOString();

      if (status === "shipped") updateData.shipped_date = now;
      if (status === "customs") updateData.customs_date = now;
      if (status === "arrived") updateData.arrived_date = now;
      if (status === "received") updateData.received_date = now;

      const { error } = await supabase
        .from("cargo_shipments")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargo-shipments"] });
      toast({
        title: "Status diperbarui",
        description: "Status kargo berhasil diubah",
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cargo_shipments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargo-shipments"] });
      setDeleteCargo(null);
      toast({
        title: "Kargo dihapus",
        description: "Data kargo berhasil dihapus",
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

  const filteredCargos = cargos?.filter((cargo) => {
    const matchesSearch =
      cargo.tracking_number?.toLowerCase().includes(search.toLowerCase()) ||
      cargo.suppliers?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || cargo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openEditDialog = (cargo: CargoShipment) => {
    setEditingCargo(cargo);
    setFormData({
      supplier_id: cargo.supplier_id || "",
      shipping_type: (cargo as any).shipping_type || "cargo",
      courier_name: (cargo as any).courier_name || "",
      tracking_number: cargo.tracking_number || "",
      total_value: cargo.total_value,
      shipping_cost: cargo.shipping_cost || 0,
      notes: cargo.notes || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCargo(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingCargo?.id });
  };

  const getNextStatus = (current: string): string | null => {
    const flow = ["ordered", "shipped", "customs", "arrived", "received"];
    const idx = flow.indexOf(current);
    return idx < flow.length - 1 ? flow[idx + 1] : null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header with floating asset */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold">Kargo Masuk</h1>
            <p className="text-muted-foreground">
              Floating Asset: <span className="font-bold text-primary">{formatCurrency(floatingAsset)}</span>
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                Tambah Kargo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCargo ? "Edit Kargo" : "Tambah Kargo Baru"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, supplier_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipe Ekspedisi</Label>
                  <Select
                    value={formData.shipping_type}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, shipping_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tipe ekspedisi" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIPPING_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nama Ekspedisi</Label>
                  <Input
                    value={formData.courier_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, courier_name: e.target.value }))
                    }
                    placeholder="Contoh: JNE, SiCepat, J&T"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nomor Resi</Label>
                  <Input
                    value={formData.tracking_number}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tracking_number: e.target.value }))
                    }
                    placeholder="Nomor tracking/resi"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Nilai (Rp)</Label>
                    <Input
                      type="number"
                      value={formData.total_value}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, total_value: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ongkir (Rp)</Label>
                    <Input
                      type="number"
                      value={formData.shipping_cost}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, shipping_cost: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                  />
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
                  <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
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
                    placeholder="Cari resi atau supplier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="customs">Customs</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cargo Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-6">
                  <div className="animate-shimmer h-32 rounded" />
                </CardContent>
              </Card>
            ))
          ) : filteredCargos?.length === 0 ? (
            <Card className="glass-card col-span-full">
              <CardContent className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {search || statusFilter !== "all"
                    ? "Tidak ada kargo yang sesuai filter"
                    : "Belum ada kargo. Tambahkan kargo pertama!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCargos?.map((cargo, index) => {
              const statusConfig = STATUS_CONFIG[cargo.status];
              const nextStatus = getNextStatus(cargo.status);

              return (
                <motion.div
                  key={cargo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass-card hover:shadow-glow transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <Badge className={statusConfig.color}>
                          {statusConfig.icon}
                          <span className="ml-1">{statusConfig.label}</span>
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(cargo)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteCargo(cargo)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="font-semibold">{cargo.suppliers?.name || "Unknown Supplier"}</p>
                        {cargo.tracking_number && (
                          <p className="text-sm font-mono text-muted-foreground">
                            {cargo.tracking_number}
                          </p>
                        )}
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(cargo.total_value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Order: {formatDateShort(cargo.order_date)}
                        </p>
                      </div>

                      {nextStatus && (
                        <Button
                          size="sm"
                          className="w-full mt-4"
                          onClick={() => updateStatusMutation.mutate({ id: cargo.id, status: nextStatus })}
                          disabled={updateStatusMutation.isPending}
                        >
                          Update ke {STATUS_CONFIG[nextStatus].label}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteCargo} onOpenChange={() => setDeleteCargo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kargo?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kargo ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCargo && deleteMutation.mutate(deleteCargo.id)}
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
