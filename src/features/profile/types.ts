export type TravelPreference = {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  category?: string;
  pace?: string;
  companion?: string;
  spendingOrder?: string[];
  interests?: string[];
  createdAt?: string;
  [key: string]: unknown;
};
export type Preferences = {
  profiles?: TravelPreference[];
  settings?: {
    notifications?: boolean;
    units?: "metric" | "imperial";
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
export type EmergencyInfo = {
  name?: string;
  phone?: string;
  relationship?: string;
  destinationNotes?: string;
  [key: string]: unknown;
};
export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  preferences: Preferences;
  emergency_contact: EmergencyInfo;
  updated_at: string;
};
