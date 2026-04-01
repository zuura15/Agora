export interface AccessCode {
  id: string;
  code: string;
  initial_credit: number;
  remaining_credit: number;
  redeemed_by: string | null;
  redeemed_by_user_id: string | null;
  blocked: boolean;
  created_at: string;
  redeemed_at: string | null;
}

export type QueryMode = 'byok' | 'access-code';

export interface ReservationResult {
  query_group_id: string;
  active_code_id: string;
  remaining_credit: number;
  queries_today: number;
  daily_limit: number;
  available_providers: string[];
}

export interface AccessCodeStatus {
  accessCodes: AccessCode[];
  totalBalance: number;
  dailyQueryCount: number;
  availableProviders: string[];
}
