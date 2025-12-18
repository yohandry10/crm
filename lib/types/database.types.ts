// Tipos de TypeScript para Supabase
// Estos tipos se pueden regenerar usando: supabase gen types typescript

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string | null
          phone: string | null
          ruc: string | null
          company: string | null
          position: string | null
          address: string | null
          city: string | null
          country: string | null
          lead_score: number | null
          lead_status: string | null
          source: string | null
          tags: string[] | null
          notes: string | null
          last_interaction: string | null
          interactions_count: number | null
          total_purchases: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          ruc?: string | null
          company?: string | null
          position?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          lead_score?: number | null
          lead_status?: string | null
          source?: string | null
          tags?: string[] | null
          notes?: string | null
          last_interaction?: string | null
          interactions_count?: number | null
          total_purchases?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          ruc?: string | null
          company?: string | null
          position?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          lead_score?: number | null
          lead_status?: string | null
          source?: string | null
          tags?: string[] | null
          notes?: string | null
          last_interaction?: string | null
          interactions_count?: number | null
          total_purchases?: number | null
          created_at?: string
          updated_at?: string
        }
      }


      ai_predictions: {
        Row: {
          id: string
          contact_id: string
          prediction_type: string
          predicted_value: number
          confidence: number
          factors: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          prediction_type: string
          predicted_value: number
          confidence: number
          factors?: Json | null
          created_at?: string
        }
        Update: {
          contact_id?: string
          prediction_type?: string
          predicted_value?: number
          confidence?: number
          factors?: Json | null
          created_at?: string
        }
      }

      // ✅ CRÍTICO-005 FIX: Adding critical missing tables
      organizations: {
        Row: {
          id: string
          name: string
          slug: string | null
          ruc: string | null
          legal_name: string | null
          industry: string | null
          website: string | null
          phone: string | null
          email: string | null
          address: string | null
          city: string
          country: string
          timezone: string
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          ruc?: string | null
          legal_name?: string | null
          industry?: string | null
          website?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string
          country?: string
          timezone?: string
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          ruc?: string | null
          legal_name?: string | null
          industry?: string | null
          website?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string
          country?: string
          timezone?: string
          currency?: string
          updated_at?: string
        }
      }

      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          organization_id: string | null
          role: string
          is_platform_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          organization_id?: string | null
          role?: string
          is_platform_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          organization_id?: string | null
          role?: string
          is_platform_admin?: boolean
          updated_at?: string
        }
      }

      invoices: {
        Row: {
          id: string
          organization_id: string
          contact_id: string
          invoice_number: string
          status: string
          issue_date: string
          due_date: string | null
          subtotal: number
          tax: number
          total: number
          currency: string
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          organization_id: string
          contact_id: string
          invoice_number?: string
          status?: string
          issue_date?: string
          due_date?: string | null
          subtotal?: number
          tax?: number
          total?: number
          currency?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          contact_id?: string
          status?: string
          issue_date?: string
          due_date?: string | null
          notes?: string | null
          updated_at?: string
        }
      }

      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          total: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          description: string
          quantity: number
          unit_price: number
          tax_rate?: number
          total?: number
          created_at?: string
        }
        Update: {
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          total?: number
        }
      }

      payments: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string
          amount: number
          payment_method: string
          gateway: string
          transaction_id: string | null
          status: string
          paid_at: string | null
          idempotency_key: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_id: string
          amount: number
          payment_method: string
          gateway: string
          transaction_id?: string | null
          status?: string
          paid_at?: string | null
          idempotency_key: string
          created_at?: string
          created_by: string
        }
        Update: {
          status?: string
          paid_at?: string | null
        }
      }

      opportunities: {
        Row: {
          id: string
          organization_id: string
          contact_id: string | null
          stage_id: string | null
          name: string
          expected_revenue: number
          expected_close_date: string | null
          description: string | null
          probability: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          contact_id?: string | null
          stage_id?: string | null
          name: string
          expected_revenue?: number
          expected_close_date?: string | null
          description?: string | null
          probability?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          stage_id?: string | null
          name?: string
          expected_revenue?: number
          expected_close_date?: string | null
          description?: string | null
          probability?: number
          status?: string
          updated_at?: string
        }
      }

      pipeline_stages: {
        Row: {
          id: string
          organization_id: string
          name: string
          position: number
          win_probability: number
          color: string
          is_default: boolean
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          position: number
          win_probability: number
          color?: string
          is_default?: boolean
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          position?: number
          win_probability?: number
          color?: string
          is_default?: boolean
          active?: boolean
        }
      }

      products: {
        Row: {
          id: string
          organization_id: string
          sku: string | null
          name: string
          description: string | null
          category_id: string | null
          unit_price: number
          cost_price: number | null
          currency: string
          tax_rate: number
          is_service: boolean
          is_active: boolean
          stock_quantity: number
          min_stock: number
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          sku?: string | null
          name: string
          description?: string | null
          category_id?: string | null
          unit_price: number
          cost_price?: number | null
          currency?: string
          tax_rate?: number
          is_service?: boolean
          is_active?: boolean
          stock_quantity?: number
          min_stock?: number
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          sku?: string | null
          name?: string
          description?: string | null
          category_id?: string | null
          unit_price?: number
          cost_price?: number | null
          currency?: string
          tax_rate?: number
          is_service?: boolean
          is_active?: boolean
          stock_quantity?: number
          min_stock?: number
          image_url?: string | null
          updated_at?: string
        }
      }

      workflows: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          trigger_type: string
          trigger_conditions: Json | null
          actions: Json
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          trigger_type: string
          trigger_conditions?: Json | null
          actions?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          name?: string
          description?: string | null
          trigger_type?: string
          trigger_conditions?: Json | null
          actions?: Json
          is_active?: boolean
          updated_at?: string
        }
      }

      workflow_executions: {
        Row: {
          id: string
          workflow_id: string
          contact_id: string | null
          status: string
          started_at: string
          completed_at: string | null
          error: string | null
          result: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          contact_id?: string | null
          status?: string
          started_at?: string
          completed_at?: string | null
          error?: string | null
          result?: Json | null
          created_at?: string
        }
        Update: {
          status?: string
          completed_at?: string | null
          error?: string | null
          result?: Json | null
        }
      }

      tasks: {
        Row: {
          id: string
          organization_id: string
          title: string
          description: string | null
          contact_id: string | null
          workflow_id: string | null
          status: string
          priority: string
          due_date: string | null
          completed_at: string | null
          assigned_to: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          description?: string | null
          contact_id?: string | null
          workflow_id?: string | null
          status?: string
          priority?: string
          due_date?: string | null
          completed_at?: string | null
          assigned_to?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          contact_id?: string | null
          status?: string
          priority?: string
          due_date?: string | null
          completed_at?: string | null
          assigned_to?: string | null
          metadata?: Json | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      lead_status: 'cold' | 'warm' | 'hot' | 'converted' | 'lost'
      invoice_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
      payment_status: 'pending' | 'completed' | 'failed' | 'refunded'
      user_role: 'admin' | 'user' | 'viewer'
      task_status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
      task_priority: 'low' | 'medium' | 'high' | 'urgent'
      workflow_execution_status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    }
  }
}

// ✅ Helper types for better DX
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Commonly used types
export type Contact = Tables<'contacts'>
export type Organization = Tables<'organizations'>
export type Profile = Tables<'profiles'>
export type Invoice = Tables<'invoices'>
export type InvoiceItem = Tables<'invoice_items'>
export type Payment = Tables<'payments'>
export type Opportunity = Tables<'opportunities'>
export type PipelineStage = Tables<'pipeline_stages'>
export type Product = Tables<'products'>
export type Workflow = Tables<'workflows'>
export type WorkflowExecution = Tables<'workflow_executions'>
export type Task = Tables<'tasks'>
