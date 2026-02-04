import { useState, useRef } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileImage, FileText, Download, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStoreSettings } from "@/hooks/use-store-settings";

interface Transaction {
  id: string;
  transaction_code: string;
  customer_name: string;
  customer_city: string | null;
  courier: string;
  tracking_number: string | null;
  total_amount: number;
  status: string;
  transaction_date: string;
}

interface DailyRecapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
}

export function DailyRecapDialog({
  open,
  onOpenChange,
  transactions,
}: DailyRecapDialogProps) {
  const { toast } = useToast();
  const { data: storeSettings } = useStoreSettings();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const recapRef = useRef<HTMLDivElement>(null);

  const storeName = storeSettings?.store_name || "Mao~Mao Store";
  const logoEmoji = storeSettings?.logo_emoji || "🎁";

  // Filter transactions for selected date with tracking numbers
  const filteredTransactions = transactions.filter((t) => {
    const transactionDate = new Date(t.transaction_date)
      .toISOString()
      .split("T")[0];
    return (
      transactionDate === selectedDate &&
      t.tracking_number &&
      t.status !== "cancelled"
    );
  });

  const formattedDate = format(new Date(selectedDate), "EEEE, d MMMM yyyy", {
    locale: localeId,
  });

  const generatePDF = async () => {
    if (!recapRef.current) return;
    setIsGenerating(true);

    try {
      const canvas = await html2canvas(recapRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`rekap-resi-${selectedDate}.pdf`);

      toast({
        title: "PDF berhasil dibuat",
        description: `Rekap resi ${formattedDate} telah diunduh`,
      });
    } catch (error) {
      toast({
        title: "Gagal membuat PDF",
        description: "Terjadi kesalahan saat membuat file",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateJPEG = async () => {
    if (!recapRef.current) return;
    setIsGenerating(true);

    try {
      const canvas = await html2canvas(recapRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `rekap-resi-${selectedDate}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();

      toast({
        title: "Gambar berhasil dibuat",
        description: `Rekap resi ${formattedDate} telah diunduh`,
      });
    } catch (error) {
      toast({
        title: "Gagal membuat gambar",
        description: "Terjadi kesalahan saat membuat file",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Rekap Resi Harian
          </DialogTitle>
          <DialogDescription>
            Export daftar resi pengiriman menjadi file PDF atau gambar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Pilih Tanggal</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>

          {/* Preview */}
          <div className="border rounded-lg overflow-hidden bg-white">
            <div
              ref={recapRef}
              className="p-6 bg-white text-black min-h-[400px]"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {/* Header */}
              <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
                <div className="text-4xl mb-2">{logoEmoji}</div>
                <h1 className="text-xl font-bold text-gray-800">{storeName}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Rekap Resi Pengiriman
                </p>
                <p className="text-lg font-semibold text-gray-700 mt-2">
                  {formattedDate}
                </p>
              </div>

              {/* Summary */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Total Pengiriman:{" "}
                  <span className="font-bold text-gray-800">
                    {filteredTransactions.length} paket
                  </span>
                </p>
              </div>

              {/* Tracking List */}
              {filteredTransactions.length > 0 ? (
                <div className="space-y-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-2 px-1 font-semibold text-gray-700">
                          No
                        </th>
                        <th className="text-left py-2 px-1 font-semibold text-gray-700">
                          Customer
                        </th>
                        <th className="text-left py-2 px-1 font-semibold text-gray-700">
                          Kota
                        </th>
                        <th className="text-left py-2 px-1 font-semibold text-gray-700">
                          Kurir
                        </th>
                        <th className="text-left py-2 px-1 font-semibold text-gray-700">
                          No. Resi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((t, index) => (
                        <tr
                          key={t.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-2 px-1 text-gray-600">
                            {index + 1}
                          </td>
                          <td className="py-2 px-1 font-medium text-gray-800">
                            {t.customer_name}
                          </td>
                          <td className="py-2 px-1 text-gray-600">
                            {t.customer_city || "-"}
                          </td>
                          <td className="py-2 px-1 text-gray-600">
                            {t.courier}
                          </td>
                          <td className="py-2 px-1 font-mono text-gray-800">
                            {t.tracking_number}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Tidak ada resi untuk tanggal ini</p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">
                  Dibuat otomatis oleh {storeName} • {format(new Date(), "HH:mm")}
                </p>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={generateJPEG}
              disabled={isGenerating || filteredTransactions.length === 0}
              className="gap-2"
            >
              <FileImage className="w-4 h-4" />
              Download JPEG
            </Button>
            <Button
              onClick={generatePDF}
              disabled={isGenerating || filteredTransactions.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
