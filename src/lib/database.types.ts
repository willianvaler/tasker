
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
                    "created_at": string,"defeated_at": string | null,"ends_at": string,"hp": number,"icon": string,"id": string,"max_hp": number,"name": string,"period_key": string,"scope": string,"scope_id": string,"starts_at": string,"status": string,"_boss_json": Json | null,"_sync_boss_rewards": undefined | null
                  }
                  ComputedFields: "_boss_json" | "_sync_boss_rewards"
                  Insert: {
                    "created_at"?: string,"defeated_at"?: string | null,"ends_at": string,"hp": number,"icon": string,"id"?: string,"max_hp": number,"name": string,"period_key": string,"scope"?: string,"scope_id": string,"starts_at": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"defeated_at"?: string | null,"ends_at"?: string,"hp"?: number,"icon"?: string,"id"?: string,"max_hp"?: number,"name"?: string,"period_key"?: string,"scope"?: string,"scope_id"?: string,"starts_at"?: string,"status"?: string
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
                },"folder_members": {
                  Row: {
                    "aliases": (string)[],"folder_id": string,"joined_at": string,"role": Database["public"]['Enums']["folder_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"folder_id": string,"joined_at"?: string,"role"?: Database["public"]['Enums']["folder_role"],"user_id": string
                  }
                  Update: {
                    "aliases"?: (string)[],"folder_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["folder_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
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
                    "archived": boolean,"color": string | null,"created_at": string,"icon": string | null,"id": string,"is_inbox": boolean,"is_shared": boolean,"name": string,"owner_id": string,"parent_id": string | null,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"color"?: string | null,"created_at"?: string,"icon"?: string | null,"id"?: string,"is_inbox"?: boolean,"is_shared"?: boolean,"name": string,"owner_id"?: string,"parent_id"?: string | null,"position"?: number
                  }
                  Update: {
                    "archived"?: boolean,"color"?: string | null,"created_at"?: string,"icon"?: string | null,"id"?: string,"is_inbox"?: boolean,"is_shared"?: boolean,"name"?: string,"owner_id"?: string,"parent_id"?: string | null,"position"?: number
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
                },"pages": {
                  Row: {
                    "created_at": string,"folder_id": string,"icon": string | null,"id": string,"is_inbox": boolean,"manual_cycle": number,"name": string,"position": number,"reset_cycle": Database["public"]['Enums']["page_reset_cycle"],"view_type": Database["public"]['Enums']["page_view_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"folder_id": string,"icon"?: string | null,"id"?: string,"is_inbox"?: boolean,"manual_cycle"?: number,"name": string,"position"?: number,"reset_cycle"?: Database["public"]['Enums']["page_reset_cycle"],"view_type"?: Database["public"]['Enums']["page_view_type"]
                  }
                  Update: {
                    "created_at"?: string,"folder_id"?: string,"icon"?: string | null,"id"?: string,"is_inbox"?: boolean,"manual_cycle"?: number,"name"?: string,"position"?: number,"reset_cycle"?: Database["public"]['Enums']["page_reset_cycle"],"view_type"?: Database["public"]['Enums']["page_view_type"]
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
                    "avatar_url": string | null,"coins": number,"created_at": string,"display_name": string,"gamification_enabled": boolean,"id": string,"last_active_date": string | null,"level": number,"streak": number,"streak_best": number,"timezone": string,"xp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"coins"?: number,"created_at"?: string,"display_name"?: string,"gamification_enabled"?: boolean,"id": string,"last_active_date"?: string | null,"level"?: number,"streak"?: number,"streak_best"?: number,"timezone"?: string,"xp"?: number
                  }
                  Update: {
                    "avatar_url"?: string | null,"coins"?: number,"created_at"?: string,"display_name"?: string,"gamification_enabled"?: boolean,"id"?: string,"last_active_date"?: string | null,"level"?: number,"streak"?: number,"streak_best"?: number,"timezone"?: string,"xp"?: number
                  }
                  Relationships: [
                    
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
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string,"done_cycle_key": string | null,"due_date": string | null,"folder_id": string,"id": string,"labels": (string)[],"meta": Json | null,"notes": string | null,"page_id": string,"parent_task_id": string | null,"position": number,"priority": number,"recurrence": Json | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string,"done_cycle_key"?: string | null,"due_date"?: string | null,"folder_id": string,"id"?: string,"labels"?: (string)[],"meta"?: Json | null,"notes"?: string | null,"page_id": string,"parent_task_id"?: string | null,"position"?: number,"priority"?: number,"recurrence"?: Json | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string,"done_cycle_key"?: string | null,"due_date"?: string | null,"folder_id"?: string,"id"?: string,"labels"?: (string)[],"meta"?: Json | null,"notes"?: string | null,"page_id"?: string,"parent_task_id"?: string | null,"position"?: number,"priority"?: number,"recurrence"?: Json | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
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
                    "amount": number,"boss_id": string | null,"completion_id": string | null,"created_at": string,"cycle_key": string | null,"day": string,"id": string,"kind": string,"page_id": string | null,"quick": boolean,"reverted": boolean,"reverted_at": string | null,"task_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"boss_id"?: string | null,"completion_id"?: string | null,"created_at"?: string,"cycle_key"?: string | null,"day": string,"id"?: string,"kind": string,"page_id"?: string | null,"quick"?: boolean,"reverted"?: boolean,"reverted_at"?: string | null,"task_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"boss_id"?: string | null,"completion_id"?: string | null,"created_at"?: string,"cycle_key"?: string | null,"day"?: string,"id"?: string,"kind"?: string,"page_id"?: string | null,"quick"?: boolean,"reverted"?: boolean,"reverted_at"?: string | null,"task_id"?: string | null,"user_id"?: string
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
            "_award_completion":
{ Args: { "p_completion_id": string,"p_created_done": boolean,"p_cycle_kind": string,"p_page": Omit<Database["public"]['Tables']["pages"]['Row'], Database["public"]['Tables']["pages"]['ComputedFields']>,"p_task": Omit<Database["public"]['Tables']["tasks"]['Row'], Database["public"]['Tables']["tasks"]['ComputedFields']> }; Returns: Json
                           },
"_boss_json":
{ Args: { "p_boss": Omit<Database["public"]['Tables']["bosses"]['Row'], Database["public"]['Tables']["bosses"]['ComputedFields']> }; Returns: Json
                           },
"_check_achievements":
{ Args: { "p_user": string }; Returns: Json
                           },
"_clan_log":
{ Args: { "p_action": string,"p_clan_id": string,"p_payload": Json,"p_user": string }; Returns: undefined
                           },
"_game_summary":
{ Args: { "p_boss_defeated": boolean,"p_level_before": number,"p_user": string,"p_xp": number }; Returns: Json
                           },
"_grant_xp":
{ Args: { "p_amount": number,"p_completion_id": string,"p_cycle_key": string,"p_kind": string,"p_page_id": string,"p_quick": boolean,"p_task_id": string,"p_user": string }; Returns: Record<string, unknown>
                           },
"_insert_batch_task":
{ Args: { "p_item": Json,"p_page_id": string,"p_parent_id": string,"p_position": number }; Returns: string
                           },
"_invite_problem":
{ Args: { "p_invite": Omit<Database["public"]['Tables']["invites"]['Row'], Database["public"]['Tables']["invites"]['ComputedFields']> }; Returns: string
                           },
"_log_activity":
{ Args: { "p_action": string,"p_folder_id": string,"p_payload": Json }; Returns: undefined
                           },
"_notify":
{ Args: { "p_kind": string,"p_payload": Json,"p_user": string }; Returns: undefined
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
"_settle_boss":
{ Args: { "p_boss_id": string }; Returns: boolean
                           },
"_settle_project_boss":
{ Args: { "p_boss_id": string }; Returns: boolean
                           },
"_sync_boss_rewards":
{ Args: { "p_boss": Omit<Database["public"]['Tables']["bosses"]['Row'], Database["public"]['Tables']["bosses"]['ComputedFields']> }; Returns: undefined
                           },
"accept_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"boss_board":
{ Args: { "p_boss_id": string }; Returns: Json
                           },
"cancel_project_boss":
{ Args: { "p_folder_id": string }; Returns: undefined
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
"created_at": string,
"created_by": string,
"done_cycle_key": string | null,
"due_date": string | null,
"folder_id": string,
"id": string,
"labels": (string)[],
"meta": Json | null,
"notes": string | null,
"page_id": string,
"parent_task_id": string | null,
"position": number,
"priority": number,
"recurrence": Json | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: false
        isSetofReturn: true
      } },
"cycle_key_for":
{ Args: { "p_at": string,"p_kind": string,"p_manual": number,"p_timezone": string }; Returns: string
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
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
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"folder_root":
{ Args: { "p_folder_id": string }; Returns: string
                           },
"folder_timezone":
{ Args: { "p_folder_id": string }; Returns: string
                           },
"game_state":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"is_folder_member":
{ Args: { "p_folder_id": string,"p_min_role"?: Database["public"]['Enums']["folder_role"] }; Returns: boolean
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
"pending_names":
{ Args: { "p_folder_id": string }; Returns: (string)[]
                           },
"refresh_cycles":
{ Args: { "p_page_id"?: string }; Returns: number
                           },
"remove_member":
{ Args: { "p_folder_id": string,"p_user_id": string }; Returns: undefined
                           },
"reset_page":
{ Args: { "p_page_id": string }; Returns: number
                           },
"revoke_invites":
{ Args: { "p_folder_id": string }; Returns: number
                           },
"save_folder_as_template":
{ Args: { "p_folder_id": string,"p_name": string }; Returns: string
                           },
"set_member_role":
{ Args: { "p_folder_id": string,"p_role": Database["public"]['Enums']["folder_role"],"p_user_id": string }; Returns: undefined
                           },
"set_task_status":
{ Args: { "p_status": Database["public"]['Enums']["task_status"],"p_task_id": string }; Returns: Json
                           },
"start_project_boss":
{ Args: { "p_deadline": string,"p_folder_id": string }; Returns: {
              "created_at": string,
"defeated_at": string | null,
"ends_at": string,
"hp": number,
"icon": string,
"id": string,
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
"streak_stats":
{ Args: { "p_today": string,"p_user": string }; Returns: Record<string, unknown>
                           },
"task_cycle_kind":
{ Args: { "p_recurrence": Json,"p_reset_cycle": Database["public"]['Enums']["page_reset_cycle"],"p_view_type": Database["public"]['Enums']["page_view_type"] }; Returns: string
                           },
"uncomplete_task":
{ Args: { "p_task_id": string }; Returns: Json
                           },
"user_today":
{ Args: { "p_user": string }; Returns: string
                           },
"xp_rules":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"xp_to_next":
{ Args: { "p_level": number }; Returns: number
                           }
          }
          Enums: {
            "folder_role": "owner"|"editor"|"viewer","page_reset_cycle": "none"|"daily"|"weekly"|"manual","page_view_type": "list"|"cards"|"habits"|"kanban","task_status": "todo"|"doing"|"done"
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
            "folder_role": ["owner", "editor", "viewer"],"page_reset_cycle": ["none", "daily", "weekly", "manual"],"page_view_type": ["list", "cards", "habits", "kanban"],"task_status": ["todo", "doing", "done"]
          }
        }
} as const
