import AsyncStorage from "@react-native-async-storage/async-storage";
export const GALLERY_SESSION_KEY = "gallery:server-session:v1";
export const getGallerySessionToken = () => AsyncStorage.getItem(GALLERY_SESSION_KEY);
export const setGallerySessionToken = (token: string) => AsyncStorage.setItem(GALLERY_SESSION_KEY, token);
