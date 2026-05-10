export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

export interface Goal {
  user_id: string;
  target_amount: number;
  start_date: string;
  end_date: string;
  updated_at: string;
}
