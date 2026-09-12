export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_key: string;
          id: string;
          progress_value: number | null;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          achievement_key: string;
          id?: string;
          progress_value?: number | null;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_key?: string;
          id?: string;
          progress_value?: number | null;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_suggestion_cache: {
        Row: {
          carbs_bucket: number;
          created_at: string;
          date: string;
          expires_at: string;
          fat_bucket: number;
          id: string;
          kcal_bucket: number;
          meal_slot: string;
          protein_bucket: number;
          suggestions: Json;
          user_id: string;
        };
        Insert: {
          carbs_bucket: number;
          created_at?: string;
          date: string;
          expires_at?: string;
          fat_bucket: number;
          id?: string;
          kcal_bucket: number;
          meal_slot: string;
          protein_bucket: number;
          suggestions: Json;
          user_id: string;
        };
        Update: {
          carbs_bucket?: number;
          created_at?: string;
          date?: string;
          expires_at?: string;
          fat_bucket?: number;
          id?: string;
          kcal_bucket?: number;
          meal_slot?: string;
          protein_bucket?: number;
          suggestions?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          body_fat_percent: number | null;
          created_at: string;
          date: string;
          id: string;
          note: string | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          body_fat_percent?: number | null;
          created_at?: string;
          date: string;
          id?: string;
          note?: string | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          body_fat_percent?: number | null;
          created_at?: string;
          date?: string;
          id?: string;
          note?: string | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          created_at: string;
          id: string;
          is_published: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_published?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_published?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      component_variants: {
        Row: {
          component_id: string;
          created_at: string;
          id: string;
          is_default: boolean;
          label: string;
          sort_order: number;
        };
        Insert: {
          component_id: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label: string;
          sort_order?: number;
        };
        Update: {
          component_id?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "component_variants_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "recipe_components";
            referencedColumns: ["id"];
          },
        ];
      };
      cookbook_members: {
        Row: {
          added_at: string;
          cookbook_id: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          cookbook_id: string;
          id?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          cookbook_id?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cookbook_members_cookbook_id_fkey";
            columns: ["cookbook_id"];
            isOneToOne: false;
            referencedRelation: "cookbooks";
            referencedColumns: ["id"];
          },
        ];
      };
      cookbook_recipes: {
        Row: {
          cookbook_id: string;
          created_at: string;
          id: string;
          recipe_id: string;
          sort_order: number;
        };
        Insert: {
          cookbook_id: string;
          created_at?: string;
          id?: string;
          recipe_id: string;
          sort_order?: number;
        };
        Update: {
          cookbook_id?: string;
          created_at?: string;
          id?: string;
          recipe_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cookbook_recipes_cookbook_id_fkey";
            columns: ["cookbook_id"];
            isOneToOne: false;
            referencedRelation: "cookbooks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cookbook_recipes_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      cookbooks: {
        Row: {
          cover_image_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          share_token: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          share_token?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          share_token?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          created_at: string;
          id: string;
          recipe_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          recipe_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          recipe_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      friend_requests: {
        Row: {
          created_at: string;
          id: string;
          receiver_id: string;
          responded_at: string | null;
          sender_id: string;
          sender_seen_at: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          receiver_id: string;
          responded_at?: string | null;
          sender_id: string;
          sender_seen_at?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          receiver_id?: string;
          responded_at?: string | null;
          sender_id?: string;
          sender_seen_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          created_at: string;
          id: string;
          user_id_a: string;
          user_id_b: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          user_id_a: string;
          user_id_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          user_id_a?: string;
          user_id_b?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          amount: number | null;
          calories: number | null;
          carbs_g: number | null;
          component_id: string | null;
          fat_g: number | null;
          fiber_g: number | null;
          id: string;
          ingredient_master_id: string | null;
          name: string;
          product_group: string | null;
          protein_g: number | null;
          recipe_id: string;
          sort_order: number;
          sugar_g: number | null;
          unit: string | null;
          variant_id: string | null;
        };
        Insert: {
          amount?: number | null;
          calories?: number | null;
          carbs_g?: number | null;
          component_id?: string | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          ingredient_master_id?: string | null;
          name: string;
          product_group?: string | null;
          protein_g?: number | null;
          recipe_id: string;
          sort_order?: number;
          sugar_g?: number | null;
          unit?: string | null;
          variant_id?: string | null;
        };
        Update: {
          amount?: number | null;
          calories?: number | null;
          carbs_g?: number | null;
          component_id?: string | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          ingredient_master_id?: string | null;
          name?: string;
          product_group?: string | null;
          protein_g?: number | null;
          recipe_id?: string;
          sort_order?: number;
          sugar_g?: number | null;
          unit?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "recipe_components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredients_ingredient_master_id_fkey";
            columns: ["ingredient_master_id"];
            isOneToOne: false;
            referencedRelation: "ingredients_master";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredients_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "component_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients_master: {
        Row: {
          archived: boolean;
          brand_id: string | null;
          calories: number | null;
          carbs_g: number | null;
          category: string;
          created_at: string;
          density_g_per_ml: number | null;
          dismissed_source_updated_at: string | null;
          dismissed_version: number | null;
          fat_g: number | null;
          fiber_g: number | null;
          id: string;
          image_url: string | null;
          imported_version: number | null;
          is_published: boolean;
          name: string;
          protein_g: number | null;
          published_at: string | null;
          published_version: number;
          source: string | null;
          source_barcode: string | null;
          source_ingredient_id: string | null;
          source_updated_at: string | null;
          subcategory: string | null;
          sugar_g: number | null;
          unit: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          brand_id?: string | null;
          calories?: number | null;
          carbs_g?: number | null;
          category?: string;
          created_at?: string;
          density_g_per_ml?: number | null;
          dismissed_source_updated_at?: string | null;
          dismissed_version?: number | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          image_url?: string | null;
          imported_version?: number | null;
          is_published?: boolean;
          name: string;
          protein_g?: number | null;
          published_at?: string | null;
          published_version?: number;
          source?: string | null;
          source_barcode?: string | null;
          source_ingredient_id?: string | null;
          source_updated_at?: string | null;
          subcategory?: string | null;
          sugar_g?: number | null;
          unit?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          brand_id?: string | null;
          calories?: number | null;
          carbs_g?: number | null;
          category?: string;
          created_at?: string;
          density_g_per_ml?: number | null;
          dismissed_source_updated_at?: string | null;
          dismissed_version?: number | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          image_url?: string | null;
          imported_version?: number | null;
          is_published?: boolean;
          name?: string;
          protein_g?: number | null;
          published_at?: string | null;
          published_version?: number;
          source?: string | null;
          source_barcode?: string | null;
          source_ingredient_id?: string | null;
          source_updated_at?: string | null;
          subcategory?: string | null;
          sugar_g?: number | null;
          unit?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_master_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredients_master_source_ingredient_id_fkey";
            columns: ["source_ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients_master";
            referencedColumns: ["id"];
          },
        ];
      };
      meal_plan_entries: {
        Row: {
          amount: number | null;
          batch_cook_date: string | null;
          batch_cooked_at: string | null;
          batch_group_id: string | null;
          batch_role: string;
          created_at: string;
          date: string;
          days_late: number;
          food_type: string;
          group_choices: Json | null;
          id: string;
          ingredient_master_id: string | null;
          input_grams_value: number | null;
          input_mode: string;
          meal_slot: string;
          quick_entry_calories: number | null;
          quick_entry_carbs_g: number | null;
          quick_entry_fat_g: number | null;
          quick_entry_fiber_g: number | null;
          quick_entry_name: string | null;
          quick_entry_protein_g: number | null;
          quick_entry_sugar_g: number | null;
          recipe_id: string | null;
          selected_variant_ids: Json | null;
          servings: number | null;
          skipped: boolean;
          snapshot_calories: number | null;
          snapshot_carbs_g: number | null;
          snapshot_fat_g: number | null;
          snapshot_fiber_g: number | null;
          snapshot_ingredients: Json | null;
          snapshot_name: string | null;
          snapshot_protein_g: number | null;
          snapshot_sugar_g: number | null;
          snapshot_variant_label: string | null;
          sort_order: number;
          unit: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount?: number | null;
          batch_cook_date?: string | null;
          batch_cooked_at?: string | null;
          batch_group_id?: string | null;
          batch_role?: string;
          created_at?: string;
          date: string;
          days_late?: number;
          food_type?: string;
          group_choices?: Json | null;
          id?: string;
          ingredient_master_id?: string | null;
          input_grams_value?: number | null;
          input_mode?: string;
          meal_slot: string;
          quick_entry_calories?: number | null;
          quick_entry_carbs_g?: number | null;
          quick_entry_fat_g?: number | null;
          quick_entry_fiber_g?: number | null;
          quick_entry_name?: string | null;
          quick_entry_protein_g?: number | null;
          quick_entry_sugar_g?: number | null;
          recipe_id?: string | null;
          selected_variant_ids?: Json | null;
          servings?: number | null;
          skipped?: boolean;
          snapshot_calories?: number | null;
          snapshot_carbs_g?: number | null;
          snapshot_fat_g?: number | null;
          snapshot_fiber_g?: number | null;
          snapshot_ingredients?: Json | null;
          snapshot_name?: string | null;
          snapshot_protein_g?: number | null;
          snapshot_sugar_g?: number | null;
          snapshot_variant_label?: string | null;
          sort_order?: number;
          unit?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number | null;
          batch_cook_date?: string | null;
          batch_cooked_at?: string | null;
          batch_group_id?: string | null;
          batch_role?: string;
          created_at?: string;
          date?: string;
          days_late?: number;
          food_type?: string;
          group_choices?: Json | null;
          id?: string;
          ingredient_master_id?: string | null;
          input_grams_value?: number | null;
          input_mode?: string;
          meal_slot?: string;
          quick_entry_calories?: number | null;
          quick_entry_carbs_g?: number | null;
          quick_entry_fat_g?: number | null;
          quick_entry_fiber_g?: number | null;
          quick_entry_name?: string | null;
          quick_entry_protein_g?: number | null;
          quick_entry_sugar_g?: number | null;
          recipe_id?: string | null;
          selected_variant_ids?: Json | null;
          servings?: number | null;
          skipped?: boolean;
          snapshot_calories?: number | null;
          snapshot_carbs_g?: number | null;
          snapshot_fat_g?: number | null;
          snapshot_fiber_g?: number | null;
          snapshot_ingredients?: Json | null;
          snapshot_name?: string | null;
          snapshot_protein_g?: number | null;
          snapshot_sugar_g?: number | null;
          snapshot_variant_label?: string | null;
          sort_order?: number;
          unit?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_ingredient_master_id_fkey";
            columns: ["ingredient_master_id"];
            isOneToOne: false;
            referencedRelation: "ingredients_master";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      patch_note_sections: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          patch_note_id: string;
          sort_order: number;
          subtitle: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          id?: string;
          patch_note_id: string;
          sort_order?: number;
          subtitle?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          patch_note_id?: string;
          sort_order?: number;
          subtitle?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patch_note_sections_patch_note_id_fkey";
            columns: ["patch_note_id"];
            isOneToOne: false;
            referencedRelation: "patch_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      patch_notes: {
        Row: {
          created_at: string;
          id: string;
          published_by: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          published_by: string;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          published_by?: string;
          title?: string;
        };
        Relationships: [];
      };
      points_log: {
        Row: {
          breakdown: Json;
          created_at: string;
          date: string;
          days_late: number;
          id: string;
          points_earned: number;
          points_multiplier_applied: number;
          season_id: string | null;
          user_id: string;
        };
        Insert: {
          breakdown?: Json;
          created_at?: string;
          date: string;
          days_late?: number;
          id?: string;
          points_earned?: number;
          points_multiplier_applied?: number;
          season_id?: string | null;
          user_id: string;
        };
        Update: {
          breakdown?: Json;
          created_at?: string;
          date?: string;
          days_late?: number;
          id?: string;
          points_earned?: number;
          points_multiplier_applied?: number;
          season_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "points_log_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          created_at: string;
          fcm_token: string;
          id: string;
          platform: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          fcm_token: string;
          id?: string;
          platform?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          fcm_token?: string;
          id?: string;
          platform?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      quick_entry_templates: {
        Row: {
          calories: number;
          carbs_g: number | null;
          created_at: string;
          fat_g: number | null;
          fiber_g: number | null;
          id: string;
          name: string;
          protein_g: number | null;
          sugar_g: number | null;
          updated_at: string;
          use_count: number;
          user_id: string;
        };
        Insert: {
          calories: number;
          carbs_g?: number | null;
          created_at?: string;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          name: string;
          protein_g?: number | null;
          sugar_g?: number | null;
          updated_at?: string;
          use_count?: number;
          user_id: string;
        };
        Update: {
          calories?: number;
          carbs_g?: number | null;
          created_at?: string;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          name?: string;
          protein_g?: number | null;
          sugar_g?: number | null;
          updated_at?: string;
          use_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      recipe_components: {
        Row: {
          component_type: string;
          created_at: string;
          id: string;
          linked_recipe_id: string | null;
          name: string;
          recipe_id: string;
          servings: number | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          component_type?: string;
          created_at?: string;
          id?: string;
          linked_recipe_id?: string | null;
          name: string;
          recipe_id: string;
          servings?: number | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          component_type?: string;
          created_at?: string;
          id?: string;
          linked_recipe_id?: string | null;
          name?: string;
          recipe_id?: string;
          servings?: number | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_components_linked_recipe_id_fkey";
            columns: ["linked_recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_components_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          batch_servings: number | null;
          calories: number | null;
          carbs_g: number | null;
          categories: string[];
          category: string | null;
          cook_time_minutes: number | null;
          created_at: string;
          description: string | null;
          dismissed_source_updated_at: string | null;
          dismissed_version: number | null;
          fat_g: number | null;
          fiber_g: number | null;
          id: string;
          image_url: string | null;
          imported_version: number | null;
          is_component_only: boolean;
          is_fixed_batch: boolean;
          is_published: boolean;
          nutrition_mode: string;
          prep_time_minutes: number | null;
          protein_g: number | null;
          published_version: number;
          servings: number | null;
          source_recipe_id: string | null;
          source_updated_at: string | null;
          sugar_g: number | null;
          tag: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          batch_servings?: number | null;
          calories?: number | null;
          carbs_g?: number | null;
          categories?: string[];
          category?: string | null;
          cook_time_minutes?: number | null;
          created_at?: string;
          description?: string | null;
          dismissed_source_updated_at?: string | null;
          dismissed_version?: number | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          image_url?: string | null;
          imported_version?: number | null;
          is_component_only?: boolean;
          is_fixed_batch?: boolean;
          is_published?: boolean;
          nutrition_mode?: string;
          prep_time_minutes?: number | null;
          protein_g?: number | null;
          published_version?: number;
          servings?: number | null;
          source_recipe_id?: string | null;
          source_updated_at?: string | null;
          sugar_g?: number | null;
          tag?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          batch_servings?: number | null;
          calories?: number | null;
          carbs_g?: number | null;
          categories?: string[];
          category?: string | null;
          cook_time_minutes?: number | null;
          created_at?: string;
          description?: string | null;
          dismissed_source_updated_at?: string | null;
          dismissed_version?: number | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          id?: string;
          image_url?: string | null;
          imported_version?: number | null;
          is_component_only?: boolean;
          is_fixed_batch?: boolean;
          is_published?: boolean;
          nutrition_mode?: string;
          prep_time_minutes?: number | null;
          protein_g?: number | null;
          published_version?: number;
          servings?: number | null;
          source_recipe_id?: string | null;
          source_updated_at?: string | null;
          sugar_g?: number | null;
          tag?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_source_recipe_id_fkey";
            columns: ["source_recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      season_history: {
        Row: {
          created_at: string;
          final_placement_among_friends: number | null;
          final_points: number;
          final_rank: string | null;
          id: string;
          season_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          final_placement_among_friends?: number | null;
          final_points?: number;
          final_rank?: string | null;
          id?: string;
          season_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          final_placement_among_friends?: number | null;
          final_points?: number;
          final_rank?: string | null;
          id?: string;
          season_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_history_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      season_points: {
        Row: {
          created_at: string;
          current_streak_days: number;
          last_points_date: string | null;
          season_id: string;
          total_points: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_streak_days?: number;
          last_points_date?: string | null;
          season_id: string;
          total_points?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_streak_days?: number;
          last_points_date?: string | null;
          season_id?: string;
          total_points?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_points_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      season_points_log: {
        Row: {
          breakdown: Json;
          created_at: string;
          date: string;
          id: string;
          points_earned: number;
          season_id: string;
          user_id: string;
        };
        Insert: {
          breakdown?: Json;
          created_at?: string;
          date: string;
          id?: string;
          points_earned?: number;
          season_id: string;
          user_id: string;
        };
        Update: {
          breakdown?: Json;
          created_at?: string;
          date?: string;
          id?: string;
          points_earned?: number;
          season_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_points_log_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          is_active: boolean;
          name: string;
          season_number: number | null;
          start_date: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          is_active?: boolean;
          name: string;
          season_number?: number | null;
          start_date: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          season_number?: number | null;
          start_date?: string;
        };
        Relationships: [];
      };
      shared_with_friends: {
        Row: {
          content_id: string;
          content_type: string;
          friend_user_id: string;
          id: string;
          owner_user_id: string;
          shared_at: string;
        };
        Insert: {
          content_id: string;
          content_type: string;
          friend_user_id: string;
          id?: string;
          owner_user_id: string;
          shared_at?: string;
        };
        Update: {
          content_id?: string;
          content_type?: string;
          friend_user_id?: string;
          id?: string;
          owner_user_id?: string;
          shared_at?: string;
        };
        Relationships: [];
      };
      shopping_list_items: {
        Row: {
          amount: number | null;
          category: string;
          created_at: string;
          id: string;
          ingredient_master_id: string | null;
          is_checked: boolean;
          is_manual: boolean;
          name: string;
          source_recipe_ids: string[];
          unit: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount?: number | null;
          category?: string;
          created_at?: string;
          id?: string;
          ingredient_master_id?: string | null;
          is_checked?: boolean;
          is_manual?: boolean;
          name: string;
          source_recipe_ids?: string[];
          unit?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number | null;
          category?: string;
          created_at?: string;
          id?: string;
          ingredient_master_id?: string | null;
          is_checked?: boolean;
          is_manual?: boolean;
          name?: string;
          source_recipe_ids?: string[];
          unit?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_ingredient_master_id_fkey";
            columns: ["ingredient_master_id"];
            isOneToOne: false;
            referencedRelation: "ingredients_master";
            referencedColumns: ["id"];
          },
        ];
      };
      steps: {
        Row: {
          id: string;
          instruction: string;
          recipe_id: string;
          step_number: number;
        };
        Insert: {
          id?: string;
          instruction: string;
          recipe_id: string;
          step_number: number;
        };
        Update: {
          id?: string;
          instruction?: string;
          recipe_id?: string;
          step_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "steps_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      target_history: {
        Row: {
          created_at: string;
          id: string;
          target_calories: number | null;
          target_carbs_g: number | null;
          target_fat_g: number | null;
          target_fiber_g: number | null;
          target_protein_g: number | null;
          target_sugar_max_g: number | null;
          user_id: string;
          valid_from: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          target_calories?: number | null;
          target_carbs_g?: number | null;
          target_fat_g?: number | null;
          target_fiber_g?: number | null;
          target_protein_g?: number | null;
          target_sugar_max_g?: number | null;
          user_id: string;
          valid_from?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          target_calories?: number | null;
          target_carbs_g?: number | null;
          target_fat_g?: number | null;
          target_fiber_g?: number | null;
          target_protein_g?: number | null;
          target_sugar_max_g?: number | null;
          user_id?: string;
          valid_from?: string;
        };
        Relationships: [];
      };
      user_points: {
        Row: {
          bonus_points: number;
          current_season_id: string | null;
          current_streak_days: number;
          last_points_date: string | null;
          total_points: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bonus_points?: number;
          current_season_id?: string | null;
          current_streak_days?: number;
          last_points_date?: string | null;
          total_points?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bonus_points?: number;
          current_season_id?: string | null;
          current_streak_days?: number;
          last_points_date?: string | null;
          total_points?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_points_current_season_id_fkey";
            columns: ["current_season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profile: {
        Row: {
          activity_level: string;
          age: number | null;
          avatar_url: string | null;
          created_at: string;
          experimental_glass_ui: boolean;
          experimental_glass_variant: string;
          goal: string;
          goal_rate: string;
          height_cm: number | null;
          sex: string | null;
          target_calories: number | null;
          target_carbs_g: number | null;
          target_fat_g: number | null;
          target_fiber_g: number | null;
          target_protein_g: number | null;
          target_sugar_max_g: number | null;
          theme_preference: string;
          track_carbs: boolean;
          track_fat: boolean;
          track_fiber: boolean;
          track_protein: boolean;
          track_sugar: boolean;
          updated_at: string;
          user_id: string;
          username: string | null;
          username_changed_at: string | null;
          weight_kg: number | null;
        };
        Insert: {
          activity_level?: string;
          age?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          experimental_glass_ui?: boolean;
          experimental_glass_variant?: string;
          goal?: string;
          goal_rate?: string;
          height_cm?: number | null;
          sex?: string | null;
          target_calories?: number | null;
          target_carbs_g?: number | null;
          target_fat_g?: number | null;
          target_fiber_g?: number | null;
          target_protein_g?: number | null;
          target_sugar_max_g?: number | null;
          theme_preference?: string;
          track_carbs?: boolean;
          track_fat?: boolean;
          track_fiber?: boolean;
          track_protein?: boolean;
          track_sugar?: boolean;
          updated_at?: string;
          user_id: string;
          username?: string | null;
          username_changed_at?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          activity_level?: string;
          age?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          experimental_glass_ui?: boolean;
          experimental_glass_variant?: string;
          goal?: string;
          goal_rate?: string;
          height_cm?: number | null;
          sex?: string | null;
          target_calories?: number | null;
          target_carbs_g?: number | null;
          target_fat_g?: number | null;
          target_fiber_g?: number | null;
          target_protein_g?: number | null;
          target_sugar_max_g?: number | null;
          theme_preference?: string;
          track_carbs?: boolean;
          track_fat?: boolean;
          track_fiber?: boolean;
          track_protein?: boolean;
          track_sugar?: boolean;
          updated_at?: string;
          user_id?: string;
          username?: string | null;
          username_changed_at?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_seen_patch_notes: {
        Row: {
          patch_note_id: string;
          seen_at: string;
          user_id: string;
        };
        Insert: {
          patch_note_id: string;
          seen_at?: string;
          user_id: string;
        };
        Update: {
          patch_note_id?: string;
          seen_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_seen_patch_notes_patch_note_id_fkey";
            columns: ["patch_note_id"];
            isOneToOne: false;
            referencedRelation: "patch_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      user_seen_seasons: {
        Row: {
          season_id: string;
          seen_at: string;
          user_id: string;
        };
        Insert: {
          season_id: string;
          seen_at?: string;
          user_id: string;
        };
        Update: {
          season_id?: string;
          seen_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_seen_seasons_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_friend_request: {
        Args: { _request_id: string };
        Returns: undefined;
      };
      are_friends: {
        Args: { _user_a: string; _user_b: string };
        Returns: boolean;
      };
      can_view_cookbook: {
        Args: { _cookbook_id: string; _user_id: string };
        Returns: boolean;
      };
      can_view_recipe: {
        Args: { _recipe_id: string; _user_id: string };
        Returns: boolean;
      };
      end_friendship: { Args: { _other_user_id: string }; Returns: undefined };
      ensure_current_season: {
        Args: never;
        Returns: {
          end_date: string;
          id: string;
          name: string;
          season_number: number;
          start_date: string;
        }[];
      };
      get_friend_comparison: {
        Args: never;
        Returns: {
          achievement_count: number;
          avatar_url: string;
          current_streak_days: number;
          is_self: boolean;
          total_points: number;
          user_id: string;
          username: string;
          week_avg_points: number;
          week_days: number;
        }[];
      };
      get_friend_requests: {
        Args: { _direction: string };
        Returns: {
          avatar_url: string;
          created_at: string;
          request_id: string;
          total_points: number;
          user_id: string;
          username: string;
        }[];
      };
      get_friend_season_comparison: {
        Args: { _season_id: string };
        Returns: {
          avatar_url: string;
          current_streak_days: number;
          is_self: boolean;
          total_points: number;
          user_id: string;
          username: string;
        }[];
      };
      get_friend_season_history: {
        Args: { _season_id: string };
        Returns: {
          avatar_url: string;
          final_points: number;
          final_rank: string;
          is_self: boolean;
          user_id: string;
          username: string;
        }[];
      };
      get_my_friends: {
        Args: never;
        Returns: {
          avatar_url: string;
          current_streak_days: number;
          friends_since: string;
          total_points: number;
          user_id: string;
          username: string;
        }[];
      };
      get_my_recipe_import_count: { Args: never; Returns: number };
      get_other_push_tokens: {
        Args: { _exclude_user_id: string };
        Returns: { fcm_token: string }[];
      };
      get_public_profile: {
        Args: { _username: string };
        Returns: {
          avatar_url: string;
          current_streak_days: number;
          total_points: number;
          user_id: string;
          username: string;
        }[];
      };
      get_user_avatars: {
        Args: { _user_ids: string[] };
        Returns: {
          avatar_url: string;
          user_id: string;
          username: string;
        }[];
      };
      get_usernames: {
        Args: { _user_ids: string[] };
        Returns: {
          user_id: string;
          username: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_cookbook_member: {
        Args: { _cookbook_id: string; _user_id: string };
        Returns: boolean;
      };
      is_cookbook_owner: {
        Args: { _cookbook_id: string; _user_id: string };
        Returns: boolean;
      };
      is_shared_with_user: {
        Args: { _content_id: string; _content_type: string; _user_id: string };
        Returns: boolean;
      };
      is_username_available: { Args: { _username: string }; Returns: boolean };
      recipe_link_creates_cycle: {
        Args: { _parent_recipe_id: string; _target_recipe_id: string };
        Returns: boolean;
      };
      search_users: {
        Args: { _query: string };
        Returns: {
          avatar_url: string;
          total_points: number;
          user_id: string;
          username: string;
        }[];
      };
      season_rank_key: { Args: { _points: number }; Returns: string };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
