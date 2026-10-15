
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "achievements": {
                  Row: {
                    "description": string,"icon": string,"key": string,"name": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"icon": string,"key": string,"name": string,"position": number
                  }
                  Update: {
                    "description"?: string,"icon"?: string,"key"?: string,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"activity_log": {
                  Row: {
                    "action": string,"created_at": string,"folder_id": string,"id": string,"payload": NonNullable<Json>,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"folder_id": string,"id"?: string,"payload"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"folder_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"app_config": {
                  Row: {
                    "key": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"value": string
                  }
                  Update: {
                    "key"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"applied_ops": {
                  Row: {
                    "created_at": string,"key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"boss_damage": {
                  Row: {
                    "amount": number,"boss_id": string,"created_at": string,"id": string,"user_id": string,"xp_event_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"boss_id": string,"created_at"?: string,"id"?: string,"user_id": string,"xp_event_id": string
                  }
                  Update: {
                    "amount"?: number,"boss_id"?: string,"created_at"?: string,"id"?: string,"user_id"?: string,"xp_event_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "boss_damage_boss_id_fkey"
      columns: ["boss_id"]
isOneToOne: false
      referencedRelation: "bosses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boss_damage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boss_damage_xp_event_id_fkey"
      columns: ["xp_event_id"]
isOneToOne: false
      referencedRelation: "xp_events"
      referencedColumns: ["id"]
    }
                  ]
                },"bosses": {
                  Row: {
                    "created_at": string,"defeated_at": string | null,"ends_at": string,"hp": number,"icon": string,"id": string,"level": number,"max_hp": number,"name": string,"period_key": string,"scope": string,"scope_id": string,"starts_at": string,"status": string,"_boss_json": Json | null,"_sync_boss_rewards": undefined | null
                  }
                  ComputedFields: "_boss_json" | "_sync_boss_rewards"
                  Insert: {
                    "created_at"?: string,"defeated_at"?: string | null,"ends_at": string,"hp": number,"icon": string,"id"?: string,"level"?: number,"max_hp": number,"name": string,"period_key": string,"scope"?: string,"scope_id": string,"starts_at": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"defeated_at"?: string | null,"ends_at"?: string,"hp"?: number,"icon"?: string,"id"?: string,"level"?: number,"max_hp"?: number,"name"?: string,"period_key"?: string,"scope"?: string,"scope_id"?: string,"starts_at"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clan_activity": {
                  Row: {
                    "action": string,"clan_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"clan_id": string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"clan_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clan_activity_clan_id_fkey"
      columns: ["clan_id"]
isOneToOne: false
      referencedRelation: "clans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clan_activity_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clan_invites": {
                  Row: {
                    "clan_id": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"max_uses": number,"revoked_at": string | null,"token": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "clan_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"token"?: string,"uses"?: number
                  }
                  Update: {
                    "clan_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"token"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "clan_invites_clan_id_fkey"
      columns: ["clan_id"]
isOneToOne: false
      referencedRelation: "clans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clan_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clan_members": {
                  Row: {
                    "clan_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clan_id": string,"joined_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "clan_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clan_members_clan_id_fkey"
      columns: ["clan_id"]
isOneToOne: false
      referencedRelation: "clans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clan_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"icon": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"icon"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"icon"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"folder_id": string,"id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"folder_id": string,"id"?: string,"task_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"folder_id"?: string,"id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"conflict_copies": {
                  Row: {
                    "body": string,"created_at": string,"field": string,"folder_id": string,"id": string,"replaced_by": string | null,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"field"?: string,"folder_id": string,"id"?: string,"replaced_by"?: string | null,"task_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"field"?: string,"folder_id"?: string,"id"?: string,"replaced_by"?: string | null,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conflict_copies_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conflict_copies_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"deleted_items": {
                  Row: {
                    "batch": number,"deleted_at": string,"deleted_by": string | null,"id": string,"kind": string,"payload": NonNullable<Json>,"root_folder_id": string | null,"row_id": string,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "batch"?: number,"deleted_at"?: string,"deleted_by"?: string | null,"id"?: string,"kind": string,"payload": NonNullable<Json>,"root_folder_id"?: string | null,"row_id": string,"title"?: string | null
                  }
                  Update: {
                    "batch"?: number,"deleted_at"?: string,"deleted_by"?: string | null,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"root_folder_id"?: string | null,"row_id"?: string,"title"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"folder_members": {
                  Row: {
                    "aliases": (string)[],"custom_role_id": string | null,"folder_id": string,"joined_at": string,"role": Database["public"]['Enums']["folder_role"],"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"custom_role_id"?: string | null,"folder_id": string,"joined_at"?: string,"role"?: Database["public"]['Enums']["folder_role"],"source"?: string,"user_id": string
                  }
                  Update: {
                    "aliases"?: (string)[],"custom_role_id"?: string | null,"folder_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["folder_role"],"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "folder_members_custom_role_id_fkey"
      columns: ["custom_role_id"]
isOneToOne: false
      referencedRelation: "team_roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folder_members_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folder_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"folders": {
                  Row: {
                    "archived": boolean,"auto_complete_parent": boolean,"color": string | null,"created_at": string,"dependency_mode": string,"icon": string | null,"id": string,"is_inbox": boolean,"is_shared": boolean,"kind": string,"max_depth": number | null,"name": string,"owner_id": string,"parent_id": string | null,"position": number,"team_id": string | null,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"auto_complete_parent"?: boolean,"color"?: string | null,"created_at"?: string,"dependency_mode"?: string,"icon"?: string | null,"id"?: string,"is_inbox"?: boolean,"is_shared"?: boolean,"kind"?: string,"max_depth"?: number | null,"name": string,"owner_id"?: string,"parent_id"?: string | null,"position"?: number,"team_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "archived"?: boolean,"auto_complete_parent"?: boolean,"color"?: string | null,"created_at"?: string,"dependency_mode"?: string,"icon"?: string | null,"id"?: string,"is_inbox"?: boolean,"is_shared"?: boolean,"kind"?: string,"max_depth"?: number | null,"name"?: string,"owner_id"?: string,"parent_id"?: string | null,"position"?: number,"team_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "folders_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"folder_id": string,"id": string,"max_uses": number,"revoked_at": string | null,"role": Database["public"]['Enums']["folder_role"],"token": string,"uses": number,"_invite_problem": string | null
                  }
                  ComputedFields: "_invite_problem"
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"folder_id": string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["folder_role"],"token"?: string,"uses"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"folder_id"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["folder_role"],"token"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "drop": boolean,"icon": string,"key": string,"name": string,"position": number,"price": number | null,"rarity": string,"slot": string
                  }
                  ComputedFields: never
                  Insert: {
                    "drop"?: boolean,"icon": string,"key": string,"name": string,"position": number,"price"?: number | null,"rarity": string,"slot": string
                  }
                  Update: {
                    "drop"?: boolean,"icon"?: string,"key"?: string,"name"?: string,"position"?: number,"price"?: number | null,"rarity"?: string,"slot"?: string
                  }
                  Relationships: [
                    
                  ]
                },"milestones": {
                  Row: {
                    "created_at": string,"created_by": string | null,"done_at": string | null,"due_date": string | null,"folder_id": string,"id": string,"name": string,"position": number,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"due_date"?: string | null,"folder_id": string,"id"?: string,"name": string,"position"?: number,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"due_date"?: string | null,"folder_id"?: string,"id"?: string,"name"?: string,"position"?: number,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestones_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"payload": NonNullable<Json>,"read_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"page_dependencies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"depends_on_page_id": string,"folder_id": string,"id": string,"page_id": string,"threshold_pct": number,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_page_id": string,"folder_id": string,"id"?: string,"page_id": string,"threshold_pct"?: number,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_page_id"?: string,"folder_id"?: string,"id"?: string,"page_id"?: string,"threshold_pct"?: number,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_dependencies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_dependencies_depends_on_page_id_fkey"
      columns: ["depends_on_page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_dependencies_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_dependencies_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    }
                  ]
                },"pages": {
                  Row: {
                    "created_at": string,"folder_id": string,"icon": string | null,"id": string,"is_habits": boolean,"is_inbox": boolean,"manual_cycle": number,"max_depth": number | null,"name": string,"position": number,"reset_cycle": Database["public"]['Enums']["page_reset_cycle"],"updated_at": string,"updated_by": string | null,"version": number,"view_type": Database["public"]['Enums']["page_view_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"folder_id": string,"icon"?: string | null,"id"?: string,"is_habits"?: boolean,"is_inbox"?: boolean,"manual_cycle"?: number,"max_depth"?: number | null,"name": string,"position"?: number,"reset_cycle"?: Database["public"]['Enums']["page_reset_cycle"],"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"view_type"?: Database["public"]['Enums']["page_view_type"]
                  }
                  Update: {
                    "created_at"?: string,"folder_id"?: string,"icon"?: string | null,"id"?: string,"is_habits"?: boolean,"is_inbox"?: boolean,"manual_cycle"?: number,"max_depth"?: number | null,"name"?: string,"position"?: number,"reset_cycle"?: Database["public"]['Enums']["page_reset_cycle"],"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"view_type"?: Database["public"]['Enums']["page_view_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "pages_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "attr_agi": number,"attr_con": number,"attr_int": number,"attr_str": number,"avatar_url": string | null,"class": string | null,"coins": number,"created_at": string,"display_name": string,"equipped": NonNullable<Json>,"gamification_enabled": boolean,"id": string,"last_active_date": string | null,"level": number,"locale": string | null,"onboarded_at": string | null,"skill_day": string | null,"streak": number,"streak_best": number,"timezone": string,"xp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attr_agi"?: number,"attr_con"?: number,"attr_int"?: number,"attr_str"?: number,"avatar_url"?: string | null,"class"?: string | null,"coins"?: number,"created_at"?: string,"display_name"?: string,"equipped"?: NonNullable<Json>,"gamification_enabled"?: boolean,"id": string,"last_active_date"?: string | null,"level"?: number,"locale"?: string | null,"onboarded_at"?: string | null,"skill_day"?: string | null,"streak"?: number,"streak_best"?: number,"timezone"?: string,"xp"?: number
                  }
                  Update: {
                    "attr_agi"?: number,"attr_con"?: number,"attr_int"?: number,"attr_str"?: number,"avatar_url"?: string | null,"class"?: string | null,"coins"?: number,"created_at"?: string,"display_name"?: string,"equipped"?: NonNullable<Json>,"gamification_enabled"?: boolean,"id"?: string,"last_active_date"?: string | null,"level"?: number,"locale"?: string | null,"onboarded_at"?: string | null,"skill_day"?: string | null,"streak"?: number,"streak_best"?: number,"timezone"?: string,"xp"?: number
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"id": string,"last_seen_at": string,"platform": string,"token": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string,"platform": string,"token": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string,"platform"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"relations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"from_id": string,"from_type": string,"id": string,"kind": string,"to_id": string,"to_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"from_id": string,"from_type": string,"id"?: string,"kind"?: string,"to_id": string,"to_type": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"from_id"?: string,"from_type"?: string,"id"?: string,"kind"?: string,"to_id"?: string,"to_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "relations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_assignees": {
                  Row: {
                    "created_at": string,"created_by": string | null,"folder_id": string,"id": string,"pending_name": string | null,"task_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"folder_id": string,"id"?: string,"pending_name"?: string | null,"task_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"folder_id"?: string,"id"?: string,"pending_name"?: string | null,"task_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_assignees_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignees_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignees_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignees_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_completions": {
                  Row: {
                    "completed_at": string,"cycle_key": string,"folder_id": string,"id": string,"prev_due_date": string | null,"task_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"cycle_key": string,"folder_id": string,"id"?: string,"prev_due_date"?: string | null,"task_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "completed_at"?: string,"cycle_key"?: string,"folder_id"?: string,"id"?: string,"prev_due_date"?: string | null,"task_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_completions_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_dependencies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"depends_on_task_id": string,"folder_id": string,"id": string,"lag_minutes": number,"task_id": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_task_id": string,"folder_id": string,"id"?: string,"lag_minutes"?: number,"task_id": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_task_id"?: string,"folder_id"?: string,"id"?: string,"lag_minutes"?: number,"task_id"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_dependencies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
      columns: ["depends_on_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_events": {
                  Row: {
                    "at": string,"id": string,"kind": string,"payload": NonNullable<Json>,"root_id": string,"task_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"root_id": string,"task_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "at"?: string,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"root_id"?: string,"task_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_progress": {
                  Row: {
                    "cycle_key": string,"done_reps": number,"logged_values": NonNullable<Json>,"task_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cycle_key"?: string,"done_reps"?: number,"logged_values"?: NonNullable<Json>,"task_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cycle_key"?: string,"done_reps"?: number,"logged_values"?: NonNullable<Json>,"task_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_progress_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"completed_by": string | null,"count_down": number,"count_key": string | null,"count_up": number,"created_at": string,"created_by": string,"deps_mode": string,"depth": number,"done_cycle_key": string | null,"due_date": string | null,"estimate_minutes": number | null,"folder_id": string,"habit_kind": string,"habit_target": number | null,"id": string,"labels": (string)[],"meta": Json | null,"notes": string | null,"page_id": string,"parent_task_id": string | null,"position": number,"priority": number,"recurrence": Json | null,"repeat_plan": Json | null,"started_at": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"count_down"?: number,"count_key"?: string | null,"count_up"?: number,"created_at"?: string,"created_by"?: string,"deps_mode"?: string,"depth"?: number,"done_cycle_key"?: string | null,"due_date"?: string | null,"estimate_minutes"?: number | null,"folder_id": string,"habit_kind"?: string,"habit_target"?: number | null,"id"?: string,"labels"?: (string)[],"meta"?: Json | null,"notes"?: string | null,"page_id": string,"parent_task_id"?: string | null,"position"?: number,"priority"?: number,"recurrence"?: Json | null,"repeat_plan"?: Json | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"count_down"?: number,"count_key"?: string | null,"count_up"?: number,"created_at"?: string,"created_by"?: string,"deps_mode"?: string,"depth"?: number,"done_cycle_key"?: string | null,"due_date"?: string | null,"estimate_minutes"?: number | null,"folder_id"?: string,"habit_kind"?: string,"habit_target"?: number | null,"id"?: string,"labels"?: (string)[],"meta"?: Json | null,"notes"?: string | null,"page_id"?: string,"parent_task_id"?: string | null,"position"?: number,"priority"?: number,"recurrence"?: Json | null,"repeat_plan"?: Json | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_parent_task_id_fkey"
      columns: ["parent_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_audit": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": string,"payload": NonNullable<Json>,"target_user_id": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"target_user_id"?: string | null,"team_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"target_user_id"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_audit_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_audit_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_audit_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"email": string | null,"expires_at": string,"id": string,"max_uses": number,"revoked_at": string | null,"role": Database["public"]['Enums']["team_role"],"team_id": string,"token": string,"uses": number,"_team_invite_problem": string | null
                  }
                  ComputedFields: "_team_invite_problem"
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"email"?: string | null,"expires_at": string,"id"?: string,"max_uses": number,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["team_role"],"team_id": string,"token"?: string,"uses"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"email"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string,"token"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_join_requests": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"role": Database["public"]['Enums']["team_role"],"status": string,"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"role": Database["public"]['Enums']["team_role"],"status"?: string,"team_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["team_role"],"status"?: string,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_join_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_join_requests_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_join_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "joined_at": string,"role": Database["public"]['Enums']["team_role"],"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["team_role"],"team_id": string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_roles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"grants": (string)[],"id": string,"name": string,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"grants"?: (string)[],"id"?: string,"name": string,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"grants"?: (string)[],"id"?: string,"name"?: string,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_roles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_roles_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "created_at": string,"created_by": string,"icon": string | null,"id": string,"join_approval": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"icon"?: string | null,"id"?: string,"join_approval"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"icon"?: string | null,"id"?: string,"join_approval"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"timers": {
                  Row: {
                    "config": NonNullable<Json>,"device_id": string | null,"ended_at": string | null,"ends_at": string | null,"id": string,"kind": string,"paused_seconds": number | null,"started_at": string,"state": string,"task_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"device_id"?: string | null,"ended_at"?: string | null,"ends_at"?: string | null,"id": string,"kind": string,"paused_seconds"?: number | null,"started_at": string,"state"?: string,"task_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"device_id"?: string | null,"ended_at"?: string | null,"ends_at"?: string | null,"id"?: string,"kind"?: string,"paused_seconds"?: number | null,"started_at"?: string,"state"?: string,"task_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "timers_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_achievements": {
                  Row: {
                    "achievement_key": string,"unlocked_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement_key": string,"unlocked_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievement_key"?: string,"unlocked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_achievements_achievement_key_fkey"
      columns: ["achievement_key"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "user_achievements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_items": {
                  Row: {
                    "acquired_at": string,"event_id": string | null,"item_key": string,"price": number,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acquired_at"?: string,"event_id"?: string | null,"item_key": string,"price"?: number,"source": string,"user_id": string
                  }
                  Update: {
                    "acquired_at"?: string,"event_id"?: string | null,"item_key"?: string,"price"?: number,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_items_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "xp_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_items_item_key_fkey"
      columns: ["item_key"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "user_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_templates": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"icon": string | null,"id": string,"name": string,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data": NonNullable<Json>,"icon"?: string | null,"id"?: string,"name": string,"owner_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"icon"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_templates_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"xp_events": {
                  Row: {
                    "amount": number,"boss_id": string | null,"completion_id": string | null,"created_at": string,"crit": boolean,"cycle_key": string | null,"damage": number,"day": string,"gold": number,"id": string,"kind": string,"page_id": string | null,"quick": boolean,"reverted": boolean,"reverted_at": string | null,"task_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"boss_id"?: string | null,"completion_id"?: string | null,"created_at"?: string,"crit"?: boolean,"cycle_key"?: string | null,"damage"?: number,"day": string,"gold"?: number,"id"?: string,"kind": string,"page_id"?: string | null,"quick"?: boolean,"reverted"?: boolean,"reverted_at"?: string | null,"task_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"boss_id"?: string | null,"completion_id"?: string | null,"created_at"?: string,"crit"?: boolean,"cycle_key"?: string | null,"damage"?: number,"day"?: string,"gold"?: number,"id"?: string,"kind"?: string,"page_id"?: string | null,"quick"?: boolean,"reverted"?: boolean,"reverted_at"?: string | null,"task_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "xp_events_boss_id_fkey"
      columns: ["boss_id"]
isOneToOne: false
      referencedRelation: "bosses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "xp_events_completion_id_fkey"
      columns: ["completion_id"]
isOneToOne: false
      referencedRelation: "task_completions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "xp_events_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "xp_events_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "xp_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_app_caller":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_attack":
{ Args: { "p_base": number,"p_category": string,"p_overdue": boolean,"p_user": string }; Returns: Record<string, unknown>
                           },
"_award_completion":
{ Args: { "p_completion_id": string,"p_created_done": boolean,"p_cycle_kind": string,"p_page": Omit<Database["public"]['Tables']["pages"]['Row'], Database["public"]['Tables']["pages"]['ComputedFields']>,"p_task": Omit<Database["public"]['Tables']["tasks"]['Row'], Database["public"]['Tables']["tasks"]['ComputedFields']> }; Returns: Json
                           },
"_award_leaf_completion":
{ Args: { "p_completion_id": string,"p_created_done": boolean,"p_cycle_kind": string,"p_page": Omit<Database["public"]['Tables']["pages"]['Row'], Database["public"]['Tables']["pages"]['ComputedFields']>,"p_task": Omit<Database["public"]['Tables']["tasks"]['Row'], Database["public"]['Tables']["tasks"]['ComputedFields']> }; Returns: Json
                           },
"_boss_json":
{ Args: { "p_boss": Omit<Database["public"]['Tables']["bosses"]['Row'], Database["public"]['Tables']["bosses"]['ComputedFields']> }; Returns: Json
                           },
"_can_relate":
{ Args: { "p_folder": string }; Returns: boolean
                           },
"_can_view_folder":
{ Args: { "p_folder": string }; Returns: boolean
                           },
"_cap_quick_damage":
{ Args: { "p_damage": number,"p_user": string }; Returns: number
                           },
"_check_achievements":
{ Args: { "p_user": string }; Returns: Json
                           },
"_clan_log":
{ Args: { "p_action": string,"p_clan_id": string,"p_payload": Json,"p_user": string }; Returns: undefined
                           },
"_dependency_ok":
{ Args: { "p_dep": Omit<Database["public"]['Tables']["task_dependencies"]['Row'], Database["public"]['Tables']["task_dependencies"]['ComputedFields']>,"p_now": string }; Returns: boolean
                           },
"_depth_overflow":
{ Args: { "p_limit": number,"p_page_ids": (string)[] }; Returns: string
                           },
"_detach_member":
{ Args: { "p_root": string,"p_user_id": string }; Returns: undefined
                           },
"_game_summary":
{ Args: { "p_boss_defeated": boolean,"p_level_before": number,"p_user": string,"p_xp": number }; Returns: Json
                           },
"_gold_for":
{ Args: { "p_base": number,"p_user": string }; Returns: number
                           },
"_grant_event":
{ Args: { "p_amount": number,"p_completion_id": string,"p_crit": boolean,"p_cycle_key": string,"p_damage": number,"p_gold": number,"p_id"?: string,"p_kind": string,"p_page_id": string,"p_quick": boolean,"p_task_id": string,"p_user": string }; Returns: Record<string, unknown>
                           },
"_insert_batch_branch":
{ Args: { "p_item": Json,"p_page_id": string,"p_parent_id": string,"p_position": number }; Returns: string[]
                           },
"_insert_batch_task":
{ Args: { "p_item": Json,"p_page_id": string,"p_parent_id": string,"p_position": number }; Returns: string
                           },
"_invite_problem":
{ Args: { "p_invite": Omit<Database["public"]['Tables']["invites"]['Row'], Database["public"]['Tables']["invites"]['ComputedFields']> }; Returns: string
                           },
"_item_folder":
{ Args: { "p_id": string,"p_type": string }; Returns: string
                           },
"_join_team":
{ Args: { "p_role": Database["public"]['Enums']["team_role"],"p_team_id": string,"p_user_id": string }; Returns: undefined
                           },
"_log_activity":
{ Args: { "p_action": string,"p_folder_id": string,"p_payload": Json }; Returns: undefined
                           },
"_my_email":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_notify":
{ Args: { "p_kind": string,"p_payload": Json,"p_user": string }; Returns: undefined
                           },
"_page_title":
{ Args: { "p_page_id": string }; Returns: string
                           },
"_refresh_profile_stats":
{ Args: { "p_user": string }; Returns: undefined
                           },
"_revert_completion":
{ Args: { "p_completion_id": string,"p_page_id": string }; Returns: number
                           },
"_revert_xp":
{ Args: { "p_event_ids": (string)[] }; Returns: number
                           },
"_roll_drop":
{ Args: { "p_level": number,"p_user": string }; Returns: string
                           },
"_settle_boss":
{ Args: { "p_boss_id": string }; Returns: boolean
                           },
"_settle_project_boss":
{ Args: { "p_boss_id": string }; Returns: boolean
                           },
"_sync_boss_rewards":
{ Args: { "p_boss": Omit<Database["public"]['Tables']["bosses"]['Row'], Database["public"]['Tables']["bosses"]['ComputedFields']> }; Returns: undefined
                           },
"_sync_team_access":
{ Args: { "p_folder_id"?: string,"p_team_id": string,"p_user_id": string }; Returns: undefined
                           },
"_task_event":
{ Args: { "p_folder_id": string,"p_kind": string,"p_payload"?: Json,"p_task_id": string }; Returns: undefined
                           },
"_task_people":
{ Args: { "p_task_id": string }; Returns: string[]
                           },
"_team_audit":
{ Args: { "p_action": string,"p_payload"?: Json,"p_target"?: string,"p_team_id": string }; Returns: undefined
                           },
"_team_invite_problem":
{ Args: { "p_invite": Omit<Database["public"]['Tables']["team_invites"]['Row'], Database["public"]['Tables']["team_invites"]['ComputedFields']> }; Returns: string
                           },
"accept_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"accept_team_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"allocate_attribute":
{ Args: { "p_attr": string }; Returns: Json
                           },
"attribute_points":
{ Args: { "p_user": string }; Returns: number
                           },
"boss_board":
{ Args: { "p_boss_id": string }; Returns: Json
                           },
"boss_hp_for_level":
{ Args: { "p_level": number }; Returns: number
                           },
"buy_item":
{ Args: { "p_item": string }; Returns: Json
                           },
"can_view_audit":
{ Args: { "p_root": string }; Returns: boolean
                           },
"cancel_project_boss":
{ Args: { "p_folder_id": string }; Returns: undefined
                           },
"character_attributes":
{ Args: { "p_user": string }; Returns: Record<string, unknown>
                           },
"claim_pending_assignee":
{ Args: { "p_folder_id": string,"p_pending_name": string,"p_user_id"?: string }; Returns: number
                           },
"clan_invite_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"complete_task":
{ Args: { "p_task_id": string }; Returns: Json
                           },
"complete_tree":
{ Args: { "p_task_id": string }; Returns: number
                           },
"create_clan":
{ Args: { "p_icon"?: string,"p_name": string }; Returns: string
                           },
"create_clan_invite":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"create_from_template":
{ Args: { "p_data": Json,"p_icon": string,"p_name": string,"p_shared"?: boolean }; Returns: string
                           },
"create_invite":
{ Args: { "p_folder_id": string,"p_role"?: Database["public"]['Enums']["folder_role"] }; Returns: {
              "created_at": string,
"created_by": string | null,
"expires_at": string,
"folder_id": string,
"id": string,
"max_uses": number,
"revoked_at": string | null,
"role": Database["public"]['Enums']["folder_role"],
"token": string,
"uses": number
            }
                          SetofOptions: {
        from: "*"
        to: "invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_tasks_batch":
{ Args: { "p_items": Json,"p_page_id": string }; Returns: {
              "completed_at": string | null,
"completed_by": string | null,
"count_down": number,
"count_key": string | null,
"count_up": number,
"created_at": string,
"created_by": string,
"deps_mode": string,
"depth": number,
"done_cycle_key": string | null,
"due_date": string | null,
"estimate_minutes": number | null,
"folder_id": string,
"habit_kind": string,
"habit_target": number | null,
"id": string,
"labels": (string)[],
"meta": Json | null,
"notes": string | null,
"page_id": string,
"parent_task_id": string | null,
"position": number,
"priority": number,
"recurrence": Json | null,
"repeat_plan": Json | null,
"started_at": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string,
"updated_by": string | null,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: false
        isSetofReturn: true
      } },
"create_team_invite":
{ Args: { "p_days"?: number,"p_email"?: string,"p_max_uses"?: number,"p_role"?: Database["public"]['Enums']["team_role"],"p_team_id": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"email": string | null,
"expires_at": string,
"id": string,
"max_uses": number,
"revoked_at": string | null,
"role": Database["public"]['Enums']["team_role"],
"team_id": string,
"token": string,
"uses": number
            }
                          SetofOptions: {
        from: "*"
        to: "team_invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"cycle_key_for":
{ Args: { "p_at": string,"p_kind": string,"p_manual": number,"p_timezone": string }; Returns: string
                           },
"decide_join_request":
{ Args: { "p_approve": boolean,"p_request_id": string }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"dependency_path":
{ Args: { "p_from": string,"p_to": string }; Returns: (string)[]
                           },
"duplicate_page":
{ Args: { "p_name": string,"p_page_id": string }; Returns: string
                           },
"ensure_clan_boss":
{ Args: { "p_clan_id": string }; Returns: {
              "created_at": string,
"defeated_at": string | null,
"ends_at": string,
"hp": number,
"icon": string,
"id": string,
"level": number,
"max_hp": number,
"name": string,
"period_key": string,
"scope": string,
"scope_id": string,
"starts_at": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "bosses"
        isOneToOne: true
        isSetofReturn: false
      } },
"ensure_weekly_boss":
{ Args: { "p_user": string }; Returns: {
              "created_at": string,
"defeated_at": string | null,
"ends_at": string,
"hp": number,
"icon": string,
"id": string,
"level": number,
"max_hp": number,
"name": string,
"period_key": string,
"scope": string,
"scope_id": string,
"starts_at": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "bosses"
        isOneToOne: true
        isSetofReturn: false
      } },
"equip_item":
{ Args: { "p_item": string,"p_slot": string }; Returns: undefined
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"folder_role_rank":
{ Args: { "p_role": Database["public"]['Enums']["folder_role"] }; Returns: number
                           },
"folder_root":
{ Args: { "p_folder_id": string }; Returns: string
                           },
"folder_timezone":
{ Args: { "p_folder_id": string }; Returns: string
                           },
"force_task":
{ Args: { "p_action": string,"p_task_id": string }; Returns: Json
                           },
"game_state":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"gold_balance":
{ Args: { "p_user": string }; Returns: number
                           },
"grant_catalog":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"grants_can":
{ Args: { "p_grants": (string)[],"p_is_assignee"?: boolean,"p_is_creator"?: boolean,"p_permission": string }; Returns: boolean
                           },
"habit_count_key":
{ Args: { "p_page": Omit<Database["public"]['Tables']["pages"]['Row'], Database["public"]['Tables']["pages"]['ComputedFields']>,"p_task": Omit<Database["public"]['Tables']["tasks"]['Row'], Database["public"]['Tables']["tasks"]['ComputedFields']> }; Returns: string
                           },
"habit_tick":
{ Args: { "p_delta": number,"p_id"?: string,"p_task_id": string }; Returns: Json
                           },
"has_permission":
{ Args: { "p_folder_id": string,"p_is_assignee"?: boolean,"p_is_creator"?: boolean,"p_permission": string }; Returns: boolean
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"is_folder_member":
{ Args: { "p_folder_id": string,"p_min_role"?: Database["public"]['Enums']["folder_role"] }; Returns: boolean
                           },
"is_task_assignee":
{ Args: { "p_task_id": string,"p_user_id": string }; Returns: boolean
                           },
"is_team_member":
{ Args: { "p_min_role"?: Database["public"]['Enums']["team_role"],"p_team_id": string }; Returns: boolean
                           },
"item_relations":
{ Args: { "p_id": string,"p_type": string }; Returns: {
              "can_unlink": boolean,"icon": string,"id": string,"other_id": string,"other_type": string,"title": string
            }[]
                           },
"join_clan":
{ Args: { "p_token": string }; Returns: string
                           },
"leave_clan":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"level_for_xp":
{ Args: { "p_xp": number }; Returns: Record<string, unknown>
                           },
"log_rep":
{ Args: { "p_delta": number,"p_task_id": string,"p_values"?: Json }; Returns: Json
                           },
"members_matching":
{ Args: { "p_name": string,"p_root": string }; Returns: string[]
                           },
"my_clan":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"name_key":
{ Args: { "p_name": string }; Returns: string
                           },
"next_due_date":
{ Args: { "p_due": string,"p_recurrence": Json,"p_today": string }; Returns: string
                           },
"normalize_labels":
{ Args: { "p_labels": (string)[] }; Returns: (string)[]
                           },
"page_blockers":
{ Args: { "p_page_id": string }; Returns: (string)[]
                           },
"page_dependency_path":
{ Args: { "p_from": string,"p_to": string }; Returns: (string)[]
                           },
"page_max_depth":
{ Args: { "p_page_id": string }; Returns: number
                           },
"page_progress":
{ Args: { "p_page_id": string }; Returns: {
              "done": number,"total": number
            }[]
                           },
"patch_task_labels":
{ Args: { "p_add": (string)[],"p_remove": (string)[],"p_task_id": string }; Returns: undefined
                           },
"pending_names":
{ Args: { "p_folder_id": string }; Returns: (string)[]
                           },
"permission_presets":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"preset_can":
{ Args: { "p_is_assignee"?: boolean,"p_is_creator"?: boolean,"p_permission": string,"p_preset": string }; Returns: boolean
                           },
"project_flow_stats":
{ Args: { "p_root": string }; Returns: Json
                           },
"refresh_cycles":
{ Args: { "p_page_id"?: string }; Returns: number
                           },
"register_push_token":
{ Args: { "p_platform": string,"p_token": string }; Returns: undefined
                           },
"relation_candidates":
{ Args: { "p_query": string }; Returns: {
              "context": string,"id": string,"title": string,"type": string
            }[]
                           },
"remove_member":
{ Args: { "p_folder_id": string,"p_user_id": string }; Returns: undefined
                           },
"remove_team_member":
{ Args: { "p_team_id": string,"p_user_id": string }; Returns: undefined
                           },
"reset_attributes":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"reset_member_role":
{ Args: { "p_folder_id": string,"p_user_id": string }; Returns: undefined
                           },
"reset_page":
{ Args: { "p_page_id": string }; Returns: number
                           },
"restore_deleted":
{ Args: { "p_id": string }; Returns: number
                           },
"revoke_invites":
{ Args: { "p_folder_id": string }; Returns: number
                           },
"revoke_team_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"run_once":
{ Args: { "p_args": Json,"p_key": string,"p_name": string }; Returns: Json
                           },
"save_folder_as_template":
{ Args: { "p_folder_id": string,"p_name": string }; Returns: string
                           },
"set_class":
{ Args: { "p_class": string }; Returns: Json
                           },
"set_member_custom_role":
{ Args: { "p_folder_id": string,"p_role_id": string,"p_user_id": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_folder_id": string,"p_role": Database["public"]['Enums']["folder_role"],"p_user_id": string }; Returns: undefined
                           },
"set_project_team":
{ Args: { "p_folder_id": string,"p_team_id": string }; Returns: undefined
                           },
"set_task_notes":
{ Args: { "p_base": string,"p_notes": string,"p_task_id": string }; Returns: undefined
                           },
"set_task_status":
{ Args: { "p_status": Database["public"]['Enums']["task_status"],"p_task_id": string }; Returns: Json
                           },
"set_team_member_role":
{ Args: { "p_role": Database["public"]['Enums']["team_role"],"p_team_id": string,"p_user_id": string }; Returns: undefined
                           },
"start_project_boss":
{ Args: { "p_deadline": string,"p_folder_id": string }; Returns: {
              "created_at": string,
"defeated_at": string | null,
"ends_at": string,
"hp": number,
"icon": string,
"id": string,
"level": number,
"max_hp": number,
"name": string,
"period_key": string,
"scope": string,
"scope_id": string,
"starts_at": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "bosses"
        isOneToOne: true
        isSetofReturn: false
      } },
"start_task":
{ Args: { "p_started"?: boolean,"p_task_id": string }; Returns: {
              "completed_at": string | null,
"completed_by": string | null,
"count_down": number,
"count_key": string | null,
"count_up": number,
"created_at": string,
"created_by": string,
"deps_mode": string,
"depth": number,
"done_cycle_key": string | null,
"due_date": string | null,
"estimate_minutes": number | null,
"folder_id": string,
"habit_kind": string,
"habit_target": number | null,
"id": string,
"labels": (string)[],
"meta": Json | null,
"notes": string | null,
"page_id": string,
"parent_task_id": string | null,
"position": number,
"priority": number,
"recurrence": Json | null,
"repeat_plan": Json | null,
"started_at": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string,
"updated_by": string | null,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"start_timer":
{ Args: { "p_config"?: Json,"p_device"?: string,"p_id": string,"p_kind": string,"p_seconds"?: number,"p_started_at": string,"p_task_id"?: string }; Returns: {
              "config": NonNullable<Json>,
"device_id": string | null,
"ended_at": string | null,
"ends_at": string | null,
"id": string,
"kind": string,
"paused_seconds": number | null,
"started_at": string,
"state": string,
"task_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "timers"
        isOneToOne: true
        isSetofReturn: false
      } },
"streak_stats":
{ Args: { "p_today": string,"p_user": string }; Returns: Record<string, unknown>
                           },
"subtree_height":
{ Args: { "p_task_id": string }; Returns: number
                           },
"task_blockers":
{ Args: { "p_now"?: string,"p_task_id": string }; Returns: (string)[]
                           },
"task_cycle_kind":
{ Args: { "p_recurrence": Json,"p_reset_cycle": Database["public"]['Enums']["page_reset_cycle"],"p_view_type": Database["public"]['Enums']["page_view_type"] }; Returns: string
                           },
"task_state":
{ Args: { "p_now"?: string,"p_task_id": string }; Returns: string
                           },
"team_invite_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"team_role_preset":
{ Args: { "p_role": Database["public"]['Enums']["team_role"] }; Returns: Database["public"]['Enums']["folder_role"]
                           },
"team_role_rank":
{ Args: { "p_role": Database["public"]['Enums']["team_role"] }; Returns: number
                           },
"trash_list":
{ Args: Record<PropertyKey, never>; Returns: {
              "deleted_at": string,"id": string,"items": number,"kind": string,"title": string
            }[]
                           },
"tree_limits":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"uncomplete_task":
{ Args: { "p_task_id": string }; Returns: Json
                           },
"undo_habit_tick":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"update_timer":
{ Args: { "p_action": string,"p_at"?: string,"p_id": string,"p_seconds"?: number }; Returns: {
              "config": NonNullable<Json>,
"device_id": string | null,
"ended_at": string | null,
"ends_at": string | null,
"id": string,
"kind": string,
"paused_seconds": number | null,
"started_at": string,
"state": string,
"task_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "timers"
        isOneToOne: true
        isSetofReturn: false
      } },
"use_skill":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"user_today":
{ Args: { "p_user": string }; Returns: string
                           },
"valid_repeat_plan":
{ Args: { "p": Json }; Returns: boolean
                           },
"xp_rules":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"xp_to_next":
{ Args: { "p_level": number }; Returns: number
                           }
          }
          Enums: {
            "folder_role": "owner"|"manager"|"editor"|"contributor"|"viewer","page_reset_cycle": "none"|"daily"|"weekly"|"manual","page_view_type": "list"|"cards"|"habits"|"kanban","task_status": "todo"|"doing"|"done","team_role": "owner"|"admin"|"member"|"guest"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "folder_role": ["owner", "manager", "editor", "contributor", "viewer"],"page_reset_cycle": ["none", "daily", "weekly", "manual"],"page_view_type": ["list", "cards", "habits", "kanban"],"task_status": ["todo", "doing", "done"],"team_role": ["owner", "admin", "member", "guest"]
          }
        }
} as const
