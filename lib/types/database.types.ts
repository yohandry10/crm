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
    }
  }
}

