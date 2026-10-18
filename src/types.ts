export type UrgencyLevel = 'extreme' | 'high' | 'normal';
export type IntentType = 'emergency_search' | 'navigation_step' | 'amenity_query' | 'general';
export type UIActionType = 'START_NAV' | 'SHOW_PREVIEW' | 'REROUTE' | 'ALERT';

export interface RecommendedRestroom {
  name: string;
  distance_meters: number;
  walking_time_min: number;
  is_open: boolean;
  floor_or_location_details: string;
  has_password: boolean;
  access_notes: string;
}

export interface FlushPulseAIResponse {
  intent: IntentType;
  urgency_level: UrgencyLevel;
  recommended_restroom: RecommendedRestroom;
  voice_tts_message: string;
  step_instruction: string;
  ui_action: UIActionType;
}

export interface RestroomCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_meters: number;
  walking_time_min: number;
  is_open: boolean;
  floor_or_location_details: string;
  door_code: string;
  has_password: boolean;
  access_notes: string;
  indoor_steps: string[];
  cleanliness_score: number;
  stalls_total: number;
  stalls_available: number;
  queue_count: number;
  gender_separated: boolean;
  wheelchair_accessible: boolean;
  baby_facility: boolean;
  open_hours: string;
  verified: boolean;
  radar_x: number; // percentage on radar canvas
  radar_y: number;
  source?: string;
  address?: string;
  facility_type?: string;
}

export interface UserCoordinates {
  lat: number;
  lng: number;
  address: string;
  accuracy: string;
  isLiveGps?: boolean;
  timestamp?: number;
}
