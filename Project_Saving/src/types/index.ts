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

export interface SavingsLog {
  id: string;
  user_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  display_name?: string;
}
