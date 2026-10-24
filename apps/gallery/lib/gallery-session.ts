import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
export const GALLERY_SESSION_KEY = "gallery:server-session:v1";
const sessionKey = () =>
  `gallery.session.${encodeURIComponent(getApiBaseUrl()).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
export const getGallerySessionToken = () =>
  Platform.OS === "web"
    ? AsyncStorage.getItem(sessionKey())
    : SecureStore.getItemAsync(sessionKey());
export const setGallerySessionToken = (token: string) =>
  Platform.OS === "web"
    ? AsyncStorage.setItem(sessionKey(), token)
    : SecureStore.setItemAsync(sessionKey(), token);
export const clearGallerySessionToken = () =>
  Platform.OS === "web"
    ? AsyncStorage.removeItem(sessionKey())
    : SecureStore.deleteItemAsync(sessionKey());
