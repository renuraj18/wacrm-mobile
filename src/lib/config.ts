import Constants from "expo-constants";

interface Extra {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  eas?: { projectId?: string };
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const SUPABASE_URL = extra.supabaseUrl;
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey;
export const API_BASE_URL = extra.apiBaseUrl;
export const EAS_PROJECT_ID = extra.eas?.projectId ?? Constants.easConfig?.projectId;
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";
