import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Palette, Check, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUpdateStoreSettings, useStoreSettings } from "@/hooks/use-store-settings";
import { THEME_PRESETS, ThemePreset, previewTheme, resetTheme } from "@/hooks/use-theme-colors";

export default function ThemeColorPicker() {
  const { toast } = useToast();
  const { data: settings } = useStoreSettings();
  const updateMutation = useUpdateStoreSettings();
  
  const [selectedPreset, setSelectedPreset] = useState<ThemePreset>("pink");
  const [originalPreset, setOriginalPreset] = useState<ThemePreset>("pink");
  
  useEffect(() => {
    if (settings?.theme_preset) {
      const preset = settings.theme_preset as ThemePreset;
      if (THEME_PRESETS[preset]) {
        setSelectedPreset(preset);
        setOriginalPreset(preset);
      }
    }
  }, [settings]);
  
  const handlePresetClick = (preset: ThemePreset) => {
    setSelectedPreset(preset);
    previewTheme(preset);
  };
  
  const handleSave = () => {
    const theme = THEME_PRESETS[selectedPreset];
    
    updateMutation.mutate(
      {
        theme_preset: selectedPreset,
        primary_color: theme.primary,
        background_color: theme.background,
      } as any,
      {
        onSuccess: () => {
          setOriginalPreset(selectedPreset);
          toast({
            title: "Tema berhasil disimpan",
            description: `Tema ${theme.name} telah diterapkan`,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Gagal menyimpan tema",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };
  
  const handleReset = () => {
    setSelectedPreset(originalPreset);
    if (THEME_PRESETS[originalPreset]) {
      previewTheme(originalPreset);
    } else {
      resetTheme();
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Tema Warna
          </CardTitle>
          <CardDescription>
            Pilih tema warna untuk seluruh aplikasi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Presets Grid */}
          <div className="space-y-3">
            <Label>Pilih Tema</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.entries(THEME_PRESETS) as [ThemePreset, typeof THEME_PRESETS[ThemePreset]][]).map(
                ([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => handlePresetClick(key)}
                    className={`relative p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                      selectedPreset === key
                        ? "border-primary shadow-md"
                        : "border-transparent hover:border-muted"
                    }`}
                    style={{ backgroundColor: theme.preview.background }}
                  >
                    {/* Color preview circles */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-full shadow-sm"
                        style={{ backgroundColor: theme.preview.primary }}
                      />
                      <div
                        className="w-6 h-6 rounded-full shadow-sm opacity-60"
                        style={{ backgroundColor: theme.preview.primary }}
                      />
                    </div>
                    
                    {/* Theme name */}
                    <p className="text-xs font-medium text-center truncate">
                      {theme.name}
                    </p>
                    
                    {/* Selected indicator */}
                    {selectedPreset === key && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                  </button>
                )
              )}
            </div>
          </div>
          
          {/* Preview Box */}
          <div className="space-y-3">
            <Label>Preview</Label>
            <div
              className="p-4 rounded-xl transition-all"
              style={{ backgroundColor: THEME_PRESETS[selectedPreset].preview.background }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
                  style={{ backgroundColor: THEME_PRESETS[selectedPreset].preview.primary }}
                >
                  Aa
                </div>
                <div>
                  <p className="font-semibold">Contoh Tampilan</p>
                  <p className="text-sm text-muted-foreground">
                    Tema {THEME_PRESETS[selectedPreset].name}
                  </p>
                </div>
              </div>
              
              {/* Mini buttons preview */}
              <div className="flex gap-2 mt-4">
                <div
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: THEME_PRESETS[selectedPreset].preview.primary }}
                >
                  Tombol Utama
                </div>
                <div className="px-4 py-2 rounded-lg bg-white/80 text-sm font-medium border">
                  Tombol Sekunder
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || selectedPreset === originalPreset}
              className="flex-1"
            >
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Tema"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
