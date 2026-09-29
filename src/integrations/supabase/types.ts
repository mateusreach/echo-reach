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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agency_events: {
        Row: {
          brand_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          notes: string | null
          organization_id: string | null
          responsible: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          responsible?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          responsible?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          job_title: string | null
          name: string | null
          organization_id: string | null
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          name?: string | null
          organization_id?: string | null
          permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          name?: string | null
          organization_id?: string | null
          permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_post_acks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_post_acks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "agency_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_posts: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          organization_id: string | null
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          organization_id?: string | null
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          organization_id?: string | null
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          accent_color: string | null
          agency_address: string | null
          agency_description: string | null
          agency_email: string | null
          agency_name: string | null
          agency_phone: string | null
          agency_site: string | null
          created_at: string
          default_theme: string
          favicon_url: string | null
          icon_url: string | null
          id: string
          invite_cliente_body: string | null
          invite_cliente_subject: string | null
          invite_colaborador_body: string | null
          invite_colaborador_subject: string | null
          loading_image_url: string | null
          logo_offset_x: number
          logo_offset_y: number
          logo_scale: number
          logo_secondary_url: string | null
          logo_url: string | null
          organization_id: string | null
          primary_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          agency_address?: string | null
          agency_description?: string | null
          agency_email?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agency_site?: string | null
          created_at?: string
          default_theme?: string
          favicon_url?: string | null
          icon_url?: string | null
          id?: string
          invite_cliente_body?: string | null
          invite_cliente_subject?: string | null
          invite_colaborador_body?: string | null
          invite_colaborador_subject?: string | null
          loading_image_url?: string | null
          logo_offset_x?: number
          logo_offset_y?: number
          logo_scale?: number
          logo_secondary_url?: string | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          agency_address?: string | null
          agency_description?: string | null
          agency_email?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agency_site?: string | null
          created_at?: string
          default_theme?: string
          favicon_url?: string | null
          icon_url?: string | null
          id?: string
          invite_cliente_body?: string | null
          invite_cliente_subject?: string | null
          invite_colaborador_body?: string | null
          invite_colaborador_subject?: string | null
          loading_image_url?: string | null
          logo_offset_x?: number
          logo_offset_y?: number
          logo_scale?: number
          logo_secondary_url?: string | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_categorias: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          pilar_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          pilar_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          pilar_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_categorias_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_categorias_pilar_id_fkey"
            columns: ["pilar_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_pilares"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_ideias: {
        Row: {
          attachments: Json
          brand_id: string
          campaign_id: string | null
          categoria_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          format: string | null
          id: string
          image_url: string | null
          initiative_id: string | null
          link: string | null
          notes: string | null
          order_index: number
          priority: string
          refs: Json
          responsible: string | null
          starred: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          brand_id: string
          campaign_id?: string | null
          categoria_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          format?: string | null
          id?: string
          image_url?: string | null
          initiative_id?: string | null
          link?: string | null
          notes?: string | null
          order_index?: number
          priority?: string
          refs?: Json
          responsible?: string | null
          starred?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          brand_id?: string
          campaign_id?: string | null
          categoria_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          format?: string | null
          id?: string
          image_url?: string | null
          initiative_id?: string | null
          link?: string | null
          notes?: string | null
          order_index?: number
          priority?: string
          refs?: Json
          responsible?: string | null
          starred?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_ideias_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_ideias_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "espaco360_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_ideias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_ideias_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "espaco360_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_pilares: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_pilares_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_access_logs: {
        Row: {
          brand_id: string
          context: string | null
          created_at: string
          event: string
          id: string
          status: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          brand_id: string
          context?: string | null
          created_at?: string
          event?: string
          id?: string
          status?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          brand_id?: string
          context?: string | null
          created_at?: string
          event?: string
          id?: string
          status?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_access_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_home_sections: {
        Row: {
          brand_id: string
          created_at: string
          fields: Json
          id: string
          order_index: number
          section_key: string
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          fields?: Json
          id?: string
          order_index?: number
          section_key: string
          stage: string
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          fields?: Json
          id?: string
          order_index?: number
          section_key?: string
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_home_sections_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identity_channel_color_refs: {
        Row: {
          channel_id: string
          color_id: string
        }
        Insert: {
          channel_id: string
          color_id: string
        }
        Update: {
          channel_id?: string
          color_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_identity_channel_color_refs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_identity_channel_color_refs_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_colors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identity_channels: {
        Row: {
          active: boolean
          brand_id: string
          created_at: string
          general_prompt: string | null
          id: string
          key: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand_id: string
          created_at?: string
          general_prompt?: string | null
          id?: string
          key: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_id?: string
          created_at?: string
          general_prompt?: string | null
          id?: string
          key?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_identity_channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identity_colors: {
        Row: {
          brand_id: string
          category: string
          channel_id: string | null
          cmyk: string | null
          created_at: string
          hex: string | null
          id: string
          name: string
          note: string | null
          order_index: number
          pantone: string | null
          rgb: string | null
          source: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          category?: string
          channel_id?: string | null
          cmyk?: string | null
          created_at?: string
          hex?: string | null
          id?: string
          name: string
          note?: string | null
          order_index?: number
          pantone?: string | null
          rgb?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category?: string
          channel_id?: string | null
          cmyk?: string | null
          created_at?: string
          hex?: string | null
          id?: string
          name?: string
          note?: string | null
          order_index?: number
          pantone?: string | null
          rgb?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_identity_colors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_identity_colors_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identity_master: {
        Row: {
          brand_id: string
          created_at: string
          general_rules: string | null
          graphic_elements: string | null
          icon_style: string | null
          manual_attachments: Json
          photo_direction: string | null
          typography: string | null
          updated_at: string
          visual_direction: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          general_rules?: string | null
          graphic_elements?: string | null
          icon_style?: string | null
          manual_attachments?: Json
          photo_direction?: string | null
          typography?: string | null
          updated_at?: string
          visual_direction?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          general_rules?: string | null
          graphic_elements?: string | null
          icon_style?: string | null
          manual_attachments?: Json
          photo_direction?: string | null
          typography?: string | null
          updated_at?: string
          visual_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_identity_master_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identity_models: {
        Row: {
          attachments: Json
          carousel_cover_structure: string | null
          carousel_cta: string | null
          carousel_final_page: string | null
          carousel_forbidden_elements: string | null
          carousel_hierarchy: string | null
          carousel_page_count: string | null
          carousel_pages_structure: string | null
          carousel_required_elements: string | null
          carousel_text_treatment: string | null
          carousel_title_treatment: string | null
          category: string | null
          channel_id: string
          created_at: string
          description: string | null
          format: string | null
          id: string
          name: string
          naming_pattern: string | null
          objective: string | null
          order_index: number
          preset_id: string | null
          prompt: string | null
          status: string
          structure: string | null
          updated_at: string
          visual_direction: string | null
        }
        Insert: {
          attachments?: Json
          carousel_cover_structure?: string | null
          carousel_cta?: string | null
          carousel_final_page?: string | null
          carousel_forbidden_elements?: string | null
          carousel_hierarchy?: string | null
          carousel_page_count?: string | null
          carousel_pages_structure?: string | null
          carousel_required_elements?: string | null
          carousel_text_treatment?: string | null
          carousel_title_treatment?: string | null
          category?: string | null
          channel_id: string
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          name: string
          naming_pattern?: string | null
          objective?: string | null
          order_index?: number
          preset_id?: string | null
          prompt?: string | null
          status?: string
          structure?: string | null
          updated_at?: string
          visual_direction?: string | null
        }
        Update: {
          attachments?: Json
          carousel_cover_structure?: string | null
          carousel_cta?: string | null
          carousel_final_page?: string | null
          carousel_forbidden_elements?: string | null
          carousel_hierarchy?: string | null
          carousel_page_count?: string | null
          carousel_pages_structure?: string | null
          carousel_required_elements?: string | null
          carousel_text_treatment?: string | null
          carousel_title_treatment?: string | null
          category?: string | null
          channel_id?: string
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          name?: string
          naming_pattern?: string | null
          objective?: string | null
          order_index?: number
          preset_id?: string | null
          prompt?: string | null
          status?: string
          structure?: string | null
          updated_at?: string
          visual_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_identity_models_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_identity_models_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identity_presets: {
        Row: {
          active: boolean
          attachments: Json
          channel_id: string
          composition_rules: string | null
          created_at: string
          dimension: string | null
          format: string | null
          graphic_elements: string | null
          hierarchy: string | null
          id: string
          image_treatment: string | null
          logo_position: string | null
          margins: string | null
          name: string
          notes: string | null
          order_index: number
          safe_area: string | null
          text_sizes: string | null
          typography: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          attachments?: Json
          channel_id: string
          composition_rules?: string | null
          created_at?: string
          dimension?: string | null
          format?: string | null
          graphic_elements?: string | null
          hierarchy?: string | null
          id?: string
          image_treatment?: string | null
          logo_position?: string | null
          margins?: string | null
          name: string
          notes?: string | null
          order_index?: number
          safe_area?: string | null
          text_sizes?: string | null
          typography?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          attachments?: Json
          channel_id?: string
          composition_rules?: string | null
          created_at?: string
          dimension?: string | null
          format?: string | null
          graphic_elements?: string | null
          hierarchy?: string | null
          id?: string
          image_treatment?: string | null
          logo_position?: string | null
          margins?: string | null
          name?: string
          notes?: string | null
          order_index?: number
          safe_area?: string | null
          text_sizes?: string | null
          typography?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_identity_presets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_invites: {
        Row: {
          accepted_at: string | null
          brand_id: string
          created_at: string
          email: string
          id: string
          invited_by: string | null
          is_admin: boolean
          member_role: string
          name: string | null
          organization_id: string | null
          permissions: string[]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          brand_id: string
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          is_admin?: boolean
          member_role?: string
          name?: string | null
          organization_id?: string | null
          permissions?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          brand_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          is_admin?: boolean
          member_role?: string
          name?: string | null
          organization_id?: string | null
          permissions?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_invites_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_members: {
        Row: {
          brand_id: string
          created_at: string
          is_admin: boolean
          member_role: string
          permissions: string[]
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          is_admin?: boolean
          member_role?: string
          permissions?: string[]
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          is_admin?: boolean
          member_role?: string
          permissions?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          contact_email: string | null
          contact_name: string | null
          contract_type: string | null
          cover_frame: Json | null
          cover_url: string | null
          created_at: string
          description: string | null
          favicon_url: string | null
          id: string
          is_example: boolean
          logo_frame: Json | null
          logo_url: string | null
          modules: Json
          name: string
          notes: string | null
          organization_id: string | null
          primary_color: string | null
          segment: string | null
          slug: string
          status: string
          suggested_palettes: Json | null
          updated_at: string
          workspace_client_id: string | null
          workspace_connected: boolean
          workspace_url: string | null
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contract_type?: string | null
          cover_frame?: Json | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          favicon_url?: string | null
          id?: string
          is_example?: boolean
          logo_frame?: Json | null
          logo_url?: string | null
          modules?: Json
          name: string
          notes?: string | null
          organization_id?: string | null
          primary_color?: string | null
          segment?: string | null
          slug: string
          status?: string
          suggested_palettes?: Json | null
          updated_at?: string
          workspace_client_id?: string | null
          workspace_connected?: boolean
          workspace_url?: string | null
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contract_type?: string | null
          cover_frame?: Json | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          favicon_url?: string | null
          id?: string
          is_example?: boolean
          logo_frame?: Json | null
          logo_url?: string | null
          modules?: Json
          name?: string
          notes?: string | null
          organization_id?: string | null
          primary_color?: string | null
          segment?: string | null
          slug?: string
          status?: string
          suggested_palettes?: Json | null
          updated_at?: string
          workspace_client_id?: string | null
          workspace_connected?: boolean
          workspace_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudos: {
        Row: {
          attachments: Json
          brand_id: string
          briefing: string | null
          campaign_id: string | null
          canal: string | null
          created_at: string
          cta: string | null
          formato: string | null
          id: string
          ideia_id: string | null
          image_url: string | null
          legenda: string | null
          notes: string | null
          publish_date: string | null
          published_link: string | null
          responsible: string | null
          roteiro: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          brand_id: string
          briefing?: string | null
          campaign_id?: string | null
          canal?: string | null
          created_at?: string
          cta?: string | null
          formato?: string | null
          id?: string
          ideia_id?: string | null
          image_url?: string | null
          legenda?: string | null
          notes?: string | null
          publish_date?: string | null
          published_link?: string | null
          responsible?: string | null
          roteiro?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          brand_id?: string
          briefing?: string | null
          campaign_id?: string | null
          canal?: string | null
          created_at?: string
          cta?: string | null
          formato?: string | null
          id?: string
          ideia_id?: string | null
          image_url?: string | null
          legenda?: string | null
          notes?: string | null
          publish_date?: string | null
          published_link?: string | null
          responsible?: string | null
          roteiro?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteudos_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "espaco360_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteudos_ideia_id_fkey"
            columns: ["ideia_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_ideias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteudos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "espaco360_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          brand_id: string
          campaign_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_type: string | null
          description: string | null
          due_date: string | null
          file_url: string | null
          id: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_type?: string | null
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_type?: string | null
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "espaco360_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "espaco360_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_calendar_events: {
        Row: {
          brand_id: string
          campaign_id: string | null
          created_at: string
          delivery_date: string | null
          delivery_title: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          responsible: string | null
          start_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_title?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string
          id?: string
          responsible?: string | null
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_title?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          responsible?: string | null
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_calendar_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_calendar_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "espaco360_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_campaigns: {
        Row: {
          brand_id: string
          channels: string[]
          context: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          initiative_id: string | null
          learnings: Json
          materials: Json
          message: string | null
          objective_id: string | null
          offer: string | null
          opportunity: string | null
          priority: string
          products: string | null
          quarter: string | null
          responsible: string | null
          stage: string
          start_date: string | null
          status: string
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          channels?: string[]
          context?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          initiative_id?: string | null
          learnings?: Json
          materials?: Json
          message?: string | null
          objective_id?: string | null
          offer?: string | null
          opportunity?: string | null
          priority?: string
          products?: string | null
          quarter?: string | null
          responsible?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          channels?: string[]
          context?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          initiative_id?: string | null
          learnings?: Json
          materials?: Json
          message?: string | null
          objective_id?: string | null
          offer?: string | null
          opportunity?: string | null
          priority?: string
          products?: string | null
          quarter?: string | null
          responsible?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_campaigns_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "espaco360_initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_campaigns_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_channels: {
        Row: {
          brand_id: string
          channel_type: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          status: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          channel_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          channel_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_initiatives: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          objective_id: string | null
          order_index: number
          priority: string
          semester: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          objective_id?: string | null
          order_index?: number
          priority?: string
          semester?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          objective_id?: string | null
          order_index?: number
          priority?: string
          semester?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_initiatives_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_initiatives_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_meeting_tasks: {
        Row: {
          assignee: string | null
          brand_id: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          meeting_id: string
          status: string
        }
        Insert: {
          assignee?: string | null
          brand_id: string
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          meeting_id: string
          status?: string
        }
        Update: {
          assignee?: string | null
          brand_id?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_meeting_tasks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_meeting_tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "espaco360_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_meetings: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          meeting_date: string
          notes: string | null
          participants: Json
          title: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          meeting_date: string
          notes?: string | null
          participants?: Json
          title: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          participants?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_meetings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_monthly_tracking: {
        Row: {
          brand_id: string
          created_at: string
          decisoes_tomadas: string | null
          id: string
          insights: string | null
          month_ref: string
          ponto_atencao: string | null
          resultados_internos: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          decisoes_tomadas?: string | null
          id?: string
          insights?: string | null
          month_ref: string
          ponto_atencao?: string | null
          resultados_internos?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          decisoes_tomadas?: string | null
          id?: string
          insights?: string | null
          month_ref?: string
          ponto_atencao?: string | null
          resultados_internos?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_monthly_tracking_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_notes: {
        Row: {
          brand_id: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note_date: string | null
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note_date?: string | null
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note_date?: string | null
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_notes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      espaco360_tasks: {
        Row: {
          assignee_id: string | null
          brand_id: string
          campaign_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          initiative_id: string | null
          is_required: boolean
          owner_scope: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          is_required?: boolean
          owner_scope?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          is_required?: boolean
          owner_scope?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espaco360_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_tasks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "espaco360_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espaco360_tasks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "espaco360_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          brand_id: string
          campaign_id: string | null
          created_at: string
          id: string
          name: string
          objective_id: string | null
          period_label: string | null
          responsible: string | null
          source: string
          target_value: number | null
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          name: string
          objective_id?: string | null
          period_label?: string | null
          responsible?: string | null
          source?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          name?: string
          objective_id?: string | null
          period_label?: string | null
          responsible?: string | null
          source?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpis_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "espaco360_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          brand_id: string
          created_at: string
          current_value: number | null
          description: string | null
          id: string
          order_index: number
          period_label: string | null
          period_type: string
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          order_index?: number
          period_label?: string | null
          period_type?: string
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          order_index?: number
          period_label?: string | null
          period_type?: string
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_templates: {
        Row: {
          active: boolean
          audience: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          objective: string | null
          organization_id: string | null
          sections: Json
          type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          objective?: string | null
          organization_id?: string | null
          sections?: Json
          type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          objective?: string | null
          organization_id?: string | null
          sections?: Json
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          job_title: string | null
          organization_id: string | null
          role: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          job_title?: string | null
          organization_id?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          organization_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referencia_categorias: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referencia_categorias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referencias: {
        Row: {
          active: boolean
          attachments: Json
          brand_id: string | null
          category: string
          channel_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          links: Json
          model_id: string | null
          organization_id: string | null
          purpose: string | null
          tags: string[]
          title: string
          updated_at: string
          usage_notes: string | null
          when_to_use: string | null
        }
        Insert: {
          active?: boolean
          attachments?: Json
          brand_id?: string | null
          category?: string
          channel_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          links?: Json
          model_id?: string | null
          organization_id?: string | null
          purpose?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          usage_notes?: string | null
          when_to_use?: string | null
        }
        Update: {
          active?: boolean
          attachments?: Json
          brand_id?: string | null
          category?: string
          channel_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          links?: Json
          model_id?: string | null
          organization_id?: string | null
          purpose?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          usage_notes?: string | null
          when_to_use?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referencias_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "brand_identity_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes: {
        Row: {
          brand_id: string
          campaign_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          initiative_id: string | null
          priority: string
          status: string
          task_id: string | null
          tipo: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          priority?: string
          status?: string
          task_id?: string | null
          tipo?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          priority?: string
          status?: string
          task_id?: string | null
          tipo?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "espaco360_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "espaco360_initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "espaco360_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          avatar_url: string | null
          brand_id: string | null
          created_at: string
          email: string | null
          id: string
          is_leader: boolean
          job_title: string | null
          kind: string
          name: string
          organization_id: string | null
          palette: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          brand_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_leader?: boolean
          job_title?: string | null
          kind?: string
          name: string
          organization_id?: string | null
          palette?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          brand_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_leader?: boolean
          job_title?: string | null
          kind?: string
          name?: string
          organization_id?: string | null
          palette?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_client_task_owners: {
        Row: {
          brand_id: string
          created_at: string
          days_before: number | null
          id: string
          owner_id: string | null
          owner_name: string | null
          task_title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          days_before?: number | null
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          task_title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          days_before?: number | null
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          task_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_client_task_owners_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_client_task_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_dispatches: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          external_id: string | null
          id: string
          origin: string
          payload: Json
          response: string | null
          source_id: string | null
          source_table: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          origin?: string
          payload?: Json
          response?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          origin?: string
          payload?: Json
          response?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_dispatches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_fronts: {
        Row: {
          approved_until: string | null
          brand_id: string
          created_at: string
          id: string
          lead_days: number
          name: string
          one_off_date: string | null
          order_index: number
          pending_end: string | null
          pending_start: string | null
          recurrence: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          approved_until?: string | null
          brand_id: string
          created_at?: string
          id?: string
          lead_days?: number
          name: string
          one_off_date?: string | null
          order_index?: number
          pending_end?: string | null
          pending_start?: string | null
          recurrence?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_until?: string | null
          brand_id?: string
          created_at?: string
          id?: string
          lead_days?: number
          name?: string
          one_off_date?: string | null
          order_index?: number
          pending_end?: string | null
          pending_start?: string | null
          recurrence?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_fronts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_fronts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workspace_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_goals: {
        Row: {
          active: boolean
          brand_id: string | null
          created_at: string
          created_by: string | null
          id: string
          member_id: string | null
          member_name: string | null
          metric: string
          organization_id: string
          recurring: boolean
          reward: string | null
          scope: string
          target: number
          task_title: string | null
          title: string
          updated_at: string
          week_start: string
        }
        Insert: {
          active?: boolean
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          member_name?: string | null
          metric?: string
          organization_id: string
          recurring?: boolean
          reward?: string | null
          scope: string
          target: number
          task_title?: string | null
          title: string
          updated_at?: string
          week_start: string
        }
        Update: {
          active?: boolean
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          member_name?: string | null
          metric?: string
          organization_id?: string
          recurring?: boolean
          reward?: string | null
          scope?: string
          target?: number
          task_title?: string | null
          title?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_goals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_notes: {
        Row: {
          author: string | null
          created_at: string
          created_by: string | null
          id: string
          likes: number
          organization_id: string | null
          text: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          likes?: number
          organization_id?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          likes?: number
          organization_id?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_reviews: {
        Row: {
          brand_id: string
          checklist: Json
          comment: string | null
          created_at: string
          decision: string
          id: string
          phrases: string[]
          reviewer_id: string | null
          reviewer_name: string | null
          scope: string
          task_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          checklist?: Json
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
          phrases?: string[]
          reviewer_id?: string | null
          reviewer_name?: string | null
          scope?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          checklist?: Json
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
          phrases?: string[]
          reviewer_id?: string | null
          reviewer_name?: string | null
          scope?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "workspace_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_sectors: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_sectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_task_sources: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          source_id: string
          source_module: string
          source_type: string
          source_url: string | null
          workspace_task_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          source_id: string
          source_module: string
          source_type: string
          source_url?: string | null
          workspace_task_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          source_id?: string
          source_module?: string
          source_type?: string
          source_url?: string | null
          workspace_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_task_sources_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_task_sources_workspace_task_id_fkey"
            columns: ["workspace_task_id"]
            isOneToOne: false
            referencedRelation: "workspace_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_tasks: {
        Row: {
          attachments: Json
          brand_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          event_time: string | null
          front_id: string | null
          highlighted: boolean
          id: string
          location: string | null
          month: string | null
          note: string | null
          owner_id: string | null
          owner_name: string | null
          pinned: boolean
          priority: number
          requires_review: boolean
          review_checklist: string | null
          review_text: string | null
          sector: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          urgency: string | null
          work_order_id: string | null
        }
        Insert: {
          attachments?: Json
          brand_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          event_time?: string | null
          front_id?: string | null
          highlighted?: boolean
          id?: string
          location?: string | null
          month?: string | null
          note?: string | null
          owner_id?: string | null
          owner_name?: string | null
          pinned?: boolean
          priority?: number
          requires_review?: boolean
          review_checklist?: string | null
          review_text?: string | null
          sector?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string | null
          work_order_id?: string | null
        }
        Update: {
          attachments?: Json
          brand_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          event_time?: string | null
          front_id?: string | null
          highlighted?: boolean
          id?: string
          location?: string | null
          month?: string | null
          note?: string | null
          owner_id?: string | null
          owner_name?: string | null
          pinned?: boolean
          priority?: number
          requires_review?: boolean
          review_checklist?: string | null
          review_text?: string | null
          sector?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_tasks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_tasks_front_id_fkey"
            columns: ["front_id"]
            isOneToOne: false
            referencedRelation: "workspace_fronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_tasks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "workspace_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          organization_id: string | null
          tasks: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          organization_id?: string | null
          tasks?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          organization_id?: string | null
          tasks?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_work_order_sources: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          source_id: string
          source_module: string
          source_type: string
          source_url: string | null
          work_order_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          source_id: string
          source_module: string
          source_type: string
          source_url?: string | null
          work_order_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          source_id?: string
          source_module?: string
          source_type?: string
          source_url?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_work_order_sources_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_work_order_sources_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "workspace_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_work_orders: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          description: string | null
          front_id: string | null
          id: string
          internal_due_date: string | null
          kind: string
          period_end: string | null
          period_start: string | null
          priority: number
          requested_due_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          front_id?: string | null
          id?: string
          internal_due_date?: string | null
          kind?: string
          period_end?: string | null
          period_start?: string | null
          priority?: number
          requested_due_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          front_id?: string | null
          id?: string
          internal_due_date?: string | null
          kind?: string
          period_end?: string | null
          period_start?: string | null
          priority?: number
          requested_due_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_work_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_work_orders_front_id_fkey"
            columns: ["front_id"]
            isOneToOne: false
            referencedRelation: "workspace_fronts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      brand_identity_channel_brand: {
        Args: { target_channel_id: string }
        Returns: string
      }
      current_organization_id: { Args: never; Returns: string }
      dispatch_brand_item_to_work_order: {
        Args: {
          p_brand_id: string
          p_description?: string
          p_internal_due_date?: string
          p_kind?: string
          p_priority?: number
          p_requested_due_date?: string
          p_source_id: string
          p_source_module: string
          p_source_type: string
          p_source_url?: string
          p_title: string
        }
        Returns: {
          created: boolean
          work_order_id: string
        }[]
      }
      dispatch_brand_item_to_workspace: {
        Args: {
          p_brand_id: string
          p_description?: string
          p_due_date?: string
          p_note?: string
          p_owner_id?: string
          p_owner_name?: string
          p_priority?: number
          p_sector?: string
          p_source_id: string
          p_source_module: string
          p_source_type: string
          p_source_url?: string
          p_title: string
        }
        Returns: {
          created: boolean
          workspace_task_id: string
        }[]
      }
      ensure_front_work_order: {
        Args: {
          p_front_id: string
          p_internal_due_date?: string
          p_period_end: string
          p_period_start: string
          p_title?: string
        }
        Returns: {
          created: boolean
          work_order_id: string
        }[]
      }
      has_brand_permission: {
        Args: { perm: string; target_brand_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agency: { Args: never; Returns: boolean }
      is_agency_admin: { Args: never; Returns: boolean }
      is_agency_admin_org: { Args: { target_org_id: string }; Returns: boolean }
      is_agency_for_brand: {
        Args: { target_brand_id: string }
        Returns: boolean
      }
      is_agency_org: { Args: { target_org_id: string }; Returns: boolean }
      is_brand_admin: { Args: { target_brand_id: string }; Returns: boolean }
      is_brand_member: { Args: { target_brand_id: string }; Returns: boolean }
      is_client_admin_for_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      provision_reach_client_roster: {
        Args: { p_organization_id: string }
        Returns: {
          clients_created: number
          fronts_created: number
          fronts_updated: number
        }[]
      }
      restore_fina_fragrancia_archive: {
        Args: { p_brand_id: string }
        Returns: Json
      }
      submit_client_request_to_workspace: {
        Args: {
          p_source_id: string
          p_source_type: string
          p_source_url?: string
        }
        Returns: {
          created: boolean
          work_order_id: string
        }[]
      }
      sync_work_order_completion: {
        Args: { p_work_order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "agency_admin" | "agency_member" | "client"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["agency_admin", "agency_member", "client"],
    },
  },
} as const
