export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string | null
          username: string
          executive_role: string | null
          committees: string[] | null
          role: string
          status: string
          created_at: string
          approved: boolean
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          username: string
          executive_role?: string | null
          committees?: string[] | null
          role?: string
          status?: string
          created_at?: string
          approved?: boolean
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          username?: string
          executive_role?: string | null
          committees?: string[] | null
          role?: string
          status?: string
          created_at?: string
          approved?: boolean
        }
      }
      [key: string]: any
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
