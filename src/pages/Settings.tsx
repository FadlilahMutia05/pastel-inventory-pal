import AppLayout from "@/components/layout/AppLayout";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Upload, Smile, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useStoreSettings,
  useUpdateStoreSettings,
  useUploadLogo,
} from "@/hooks/use-store-settings";

const EMOJI_OPTIONS = ["🎁", "🎀", "🛍️", "✨", "🌸", "💖", "🎈", "🎊", "🧸", "🎭", "🎨", "🌟"];

export default function Settings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: settings, isLoading } = useStoreSettings();
  const updateMutation = useUpdateStoreSettings();
  const uploadMutation = useUploadLogo();

  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoEmoji, setLogoEmoji] = useState("🎁");
  const [logoType, setLogoType] = useState<"emoji" | "image">("emoji");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Initialize form when settings load
  useState(() => {
    if (settings) {
      setStoreName(settings.store_name || "");
      setTagline(settings.tagline || "");
      setLogoEmoji(settings.logo_emoji || "🎁");
      setLogoType(settings.logo_url ? "image" : "emoji");
      setPreviewUrl(settings.logo_url);
    }
  });

  // Update form when settings change
  if (settings && storeName === "" && settings.store_name) {
    setStoreName(settings.store_name);
    setTagline(settings.tagline || "");
    setLogoEmoji(settings.logo_emoji || "🎁");
    setLogoType(settings.logo_url ? "image" : "emoji");
    setPreviewUrl(settings.logo_url);
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setLogoType("image");

      uploadMutation.mutate(file, {
        onSuccess: (url) => {
          setPreviewUrl(url);
          toast({
            title: "Logo berhasil diupload",
            description: "Logo toko telah diperbarui",
          });
        },
        onError: (error: any) => {
          toast({
            title: "Gagal upload logo",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    }
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        store_name: storeName,
        tagline,
        logo_emoji: logoType === "emoji" ? logoEmoji : null,
        logo_url: logoType === "image" ? previewUrl : null,
      },
      {
        onSuccess: () => {
          toast({
            title: "Pengaturan disimpan",
            description: "Profil toko telah diperbarui",
          });
        },
        onError: (error: any) => {
          toast({
            title: "Gagal menyimpan",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUseEmoji = () => {
    setLogoType("emoji");
    setPreviewUrl(null);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Pengaturan
        </h1>
        <p className="text-muted-foreground">Kelola profil dan branding toko</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card sticky top-20">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Tampilan logo dan nama toko</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Preview */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-2xl bg-white shadow-card flex items-center justify-center overflow-hidden">
                  {logoType === "image" && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">{logoEmoji}</span>
                  )}
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-display font-bold bg-gradient-to-r from-pink to-lavender bg-clip-text text-transparent">
                    {storeName || "Nama Toko"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tagline || "Tagline toko"}
                  </p>
                </div>
              </div>

              {/* Mini Sidebar Preview */}
              <div className="p-4 rounded-xl bg-sidebar border border-sidebar-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-soft flex items-center justify-center overflow-hidden">
                    {logoType === "image" && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">{logoEmoji}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm">
                      {storeName || "Nama Toko"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tagline || "Tagline"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Settings Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Profil Toko</CardTitle>
              <CardDescription>
                Edit nama, tagline, dan logo toko Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Store Name */}
              <div className="space-y-2">
                <Label>Nama Toko</Label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Masukkan nama toko"
                />
              </div>

              {/* Tagline */}
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Tagline atau deskripsi singkat"
                />
              </div>

              {/* Logo Section */}
              <div className="space-y-4">
                <Label>Logo Toko</Label>
                <Tabs value={logoType} onValueChange={(v) => setLogoType(v as "emoji" | "image")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="emoji" className="flex items-center gap-2">
                      <Smile className="w-4 h-4" />
                      Emoji
                    </TabsTrigger>
                    <TabsTrigger value="image" className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Gambar
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="emoji" className="mt-4">
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setLogoEmoji(emoji)}
                          className={`p-3 rounded-xl text-2xl transition-all hover:scale-110 ${
                            logoEmoji === emoji
                              ? "bg-primary/20 ring-2 ring-primary"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="image" className="mt-4">
                    <div className="space-y-4">
                      {previewUrl ? (
                        <div className="relative inline-block">
                          <img
                            src={previewUrl}
                            alt="Logo preview"
                            className="w-24 h-24 rounded-xl object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 w-6 h-6"
                            onClick={handleUseEmoji}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : null}

                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadMutation.isPending}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadMutation.isPending ? "Mengupload..." : "Pilih Gambar"}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Format: JPG, PNG, WEBP. Max 2MB
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
