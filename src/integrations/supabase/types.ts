export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cargo_shipment_items: {
        Row: {
          cargo_shipment_id: string
          cost_price: number
          created_at: string
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          cargo_shipment_id: string
          cost_price?: number
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          cargo_shipment_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cargo_shipment_items_cargo_shipment_id_fkey"
            columns: ["cargo_shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_shipment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_shipments: {
        Row: {
          arrived_date: string | null
          courier_name: string | null
          created_at: string
          customs_date: string | null
          id: string
          notes: string | null
          order_date: string
          received_date: string | null
          shipped_date: string | null
          shipping_cost: number | null
          shipping_type: string
          status: string
          supplier_id: string | null
          total_value: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          arrived_date?: string | null
          courier_name?: string | null
          created_at?: string
          customs_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          received_date?: string | null
          shipped_date?: string | null
          shipping_cost?: number | null
          shipping_type?: string
          status?: string
          supplier_id?: string | null
          total_value?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          arrived_date?: string | null
          courier_name?: string | null
          created_at?: string
          customs_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          received_date?: string | null
          shipped_date?: string | null
          shipping_cost?: number | null
          shipping_type?: string
          status?: string
          supplier_id?: string | null
          total_value?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_shipments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_code: string | null
          cargo_shipment_id: string | null
          cost_price: number
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          received_at: string
          remaining_quantity: number
          supplier_id: string | null
        }
        Insert: {
          batch_code?: string | null
          cargo_shipment_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          received_at?: string
          remaining_quantity?: number
          supplier_id?: string | null
        }
        Update: {
          batch_code?: string | null
          cargo_shipment_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          received_at?: string
          remaining_quantity?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_batches_cargo"
            columns: ["cargo_shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          pcs_per_set: number
          photo_url: string | null
          selling_price: number
          series: string | null
          sets_per_karton: number
          sku: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          pcs_per_set?: number
          photo_url?: string | null
          selling_price?: number
          series?: string | null
          sets_per_karton?: number
          sku: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          pcs_per_set?: number
          photo_url?: string | null
          selling_price?: number
          series?: string | null
          sets_per_karton?: number
          sku?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_transactions: {
        Row: {
          completed_date: string | null
          courier: string
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          shipped_date: string | null
          shipping_cost: number | null
          shipping_type: string
          status: string
          subtotal: number
          total_amount: number
          total_profit: number
          tracking_number: string | null
          transaction_code: string
          transaction_date: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          courier?: string
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          shipped_date?: string | null
          shipping_cost?: number | null
          shipping_type?: string
          status?: string
          subtotal?: number
          total_amount?: number
          total_profit?: number
          tracking_number?: string | null
          transaction_code: string
          transaction_date?: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          courier?: string
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          shipped_date?: string | null
          shipping_cost?: number | null
          shipping_type?: string
          status?: string
          subtotal?: number
          total_amount?: number
          total_profit?: number
          tracking_number?: string | null
          transaction_code?: string
          transaction_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          background_color: string | null
          created_at: string
          id: string
          logo_emoji: string | null
          logo_url: string | null
          primary_color: string | null
          store_name: string
          tagline: string | null
          theme_preset: string | null
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          id?: string
          logo_emoji?: string | null
          logo_url?: string | null
          primary_color?: string | null
          store_name?: string
          tagline?: string | null
          theme_preset?: string | null
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          created_at?: string
          id?: string
          logo_emoji?: string | null
          logo_url?: string | null
          primary_color?: string | null
          store_name?: string
          tagline?: string | null
          theme_preset?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          rating: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          product_batch_id: string | null
          product_id: string
          profit: number
          quantity: number
          subtotal: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          product_batch_id?: string | null
          product_id: string
          profit?: number
          quantity?: number
          subtotal?: number
          transaction_id: string
          unit_price?: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          product_batch_id?: string | null
          product_id?: string
          profit?: number
          quantity?: number
          subtotal?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_batch_id_fkey"
            columns: ["product_batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
