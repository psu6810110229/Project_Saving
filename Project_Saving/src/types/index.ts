export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  invite_code: string;
  end_date: string;
  created_by: string;
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Goal {
  user_id: string;
  room_id: string;
  target_amount: number;
  start_date: string;
  end_date: string;
  updated_at: string;
}

export interface SavingsLog {
  id: string;
  user_id: string;
  room_id?: string;
  amount: number;
  note: string | null;
  created_at: string;
  display_name?: string;
  bucket_id?: string;
  bucket_name?: string;
}

export interface Bucket {
  id: string;
  user_id: string;
  room_id: string;
  name: string;
  target_amount: number;
  position: number;
  created_at: string;
}

/** Working copy used inside BucketEditor before saving */
export interface BucketDraft {
  /** undefined = new row (not yet in DB) */
  id: string | undefined;
  name: string;
  target_amount: number;
}
