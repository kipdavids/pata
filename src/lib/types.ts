export type MatchStatus = "waiting" | "active" | "finished";

export interface MatchRow {
  id: string;
  code: string;
  status: MatchStatus;
  turns_per_player: number;
  total_turns: number;
  board: number[];
  player1: string;
  player2: string | null;
  player1_name: string;
  player2_name: string | null;
  chooser: string | null;
  finder: string | null;
  turn_index: number;
  player1_score: number;
  player2_score: number;
  winner: string | null;
  target_number: number | null;
  target_since: string | null;
  used_numbers: number[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TurnRow {
  id: string;
  match_id: string;
  turn_index: number;
  chooser: string;
  finder: string;
  chosen_number: number;
  started_at: string;
  found_at: string | null;
  elapsed_us: number | null;
  created_at: string;
}

export interface LeaderboardRow {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  total_points: number;
}

export interface RecentMatch {
  id: string;
  code: string;
  player1: string;
  player2: string | null;
  player1_name: string;
  player2_name: string | null;
  player1_score: number;
  player2_score: number;
  winner: string | null;
  finished_at: string | null;
}

export interface MatchStateResponse {
  match: MatchRow;
  serverNow: string;
  lastTurn?: TurnRow | null;
  player1Avatar?: string | null;
  player2Avatar?: string | null;
}
