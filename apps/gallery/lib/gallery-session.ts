import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "../constants/oauth";

export const GALLERY_SESSION_KEY = "gallery:server-session:v1";

let pendingSessionPromise: Promise<string | null> | null = null;

export const getGallerySessionToken = async (): Promise<string | null> => {
  const existing = await AsyncStorage.getItem(GALLERY_SESSION_KEY);
  if (existing) {
    return existing;
  }

  if (pendingSessionPromise) {
    return pendingSessionPromise;
  }

  pendingSessionPromise = (async () => {
    try {
      const baseUrl = getApiBaseUrl();

      const response = await fetch(`${baseUrl}/api/trpc/session.create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: {} }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const token = data?.result?.data?.json?.token;
      if (typeof token === "string" && token) {
        await AsyncStorage.setItem(GALLERY_SESSION_KEY, token);
        return token;
      }
    } catch {
      // offline fallback
    } finally {
      pendingSessionPromise = null;
    }
    return null;
  })();

  return pendingSessionPromise;
};

export const setGallerySessionToken = (token: string) =>
  AsyncStorage.setItem(GALLERY_SESSION_KEY, token);
