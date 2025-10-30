import { createClient } from "@supabase/supabase-js";
import config from "./config";

export const supabase = createClient(config.supabase.url, config.supabase.anonKey);

export type Client = {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  color: string | null;
  unique_link_id: string;
  created_at: string;
  updated_at: string;
  report_link_url: string | null;
  meta_calendar_url: string | null;
  weekly_post_quota: number; // Adiciona a cota semanal
  is_hidden: boolean; // Adiciona o campo para ocultar
};

export type PostType = "feed" | "carousel" | "story" | "reels";
export type PostStatus =
  | "pending"
  | "change_requested"
  | "approved"
  | "agendado"
  | "published";

export type Post = {
  id: string;
  client_id: string;
  post_type: PostType;
  scheduled_date: string;
  caption: string;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  client?: Client;
  images?: PostImage[];
  change_requests?: ChangeRequest[];
};

export type CropFormat = "1:1" | "4:5" | "9:16";

export type PostImage = {
  id: string;
  post_id: string;
  image_url: string;
  image_public_id: string;
  crop_format: CropFormat;
  position: number;
  created_at: string;
};

export type RequestType = "visual" | "date" | "caption" | "other";

export type ChangeRequest = {
  id: string;
  post_id: string;
  request_type: RequestType;
  message: string;
  created_at: string;
};
