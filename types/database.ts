export type UserRole = 
  | 'super_admin'
  | 'secretary'
  | 'program_head'
  | 'committee_head'
  | 'committee_cohead'
  | 'committee_member'
  | 'student';

export type CommitteeType = 'regular' | 'executive';
export type MemberPosition = 'head' | 'co_head' | 'member';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Committee {
  id: string;
  name: string;
  description?: string;
  type: CommitteeType;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CommitteeMember {
  id: string;
  user_id: string;
  committee_id: string;
  position: MemberPosition;
  designation?: string;
  created_at: string;
  profile?: Profile;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  committee_id?: string;
  event_date: string;
  location?: string;
  image_url?: string;
  approved: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  committee?: Committee;
}

export interface KickoffTeam {
  id: string;
  name: string;
  payment_screenshot_url?: string;
  approved: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface KickoffPlayer {
  id: string;
  team_id: string;
  name: string;
  jersey_number?: number;
  created_at: string;
}

export interface KickoffMatch {
  id: string;
  team1_id: string;
  team2_id: string;
  team1_score: number;
  team2_score: number;
  match_date: string;
  round: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  team1?: KickoffTeam;
  team2?: KickoffTeam;
}

export interface KickoffGoal {
  id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  minute: number;
  created_at: string;
  player?: KickoffPlayer;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      committees: {
        Row: Committee;
        Insert: Omit<Committee, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Committee, 'id' | 'created_at' | 'updated_at'>>;
      };
      committee_members: {
        Row: CommitteeMember;
        Insert: Omit<CommitteeMember, 'id' | 'created_at'>;
        Update: Partial<Omit<CommitteeMember, 'id' | 'created_at'>>;
      };
      events: {
        Row: Event;
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>;
      };
      kickoff_teams: {
        Row: KickoffTeam;
        Insert: Omit<KickoffTeam, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<KickoffTeam, 'id' | 'created_at' | 'updated_at'>>;
      };
      kickoff_players: {
        Row: KickoffPlayer;
        Insert: Omit<KickoffPlayer, 'id' | 'created_at'>;
        Update: Partial<Omit<KickoffPlayer, 'id' | 'created_at'>>;
      };
      kickoff_matches: {
        Row: KickoffMatch;
        Insert: Omit<KickoffMatch, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<KickoffMatch, 'id' | 'created_at' | 'updated_at'>>;
      };
      kickoff_goals: {
        Row: KickoffGoal;
        Insert: Omit<KickoffGoal, 'id' | 'created_at'>;
        Update: Partial<Omit<KickoffGoal, 'id' | 'created_at'>>;
      };
    };
  };
}
