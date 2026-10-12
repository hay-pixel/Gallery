import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { LibraryEntry, PhoneFolder } from "./local-library";
type IndexModule = {
  loadIndexState: () => Promise<string | null>;
  saveIndexState: (state: string) => Promise<void>;
  pickFolder: () => Promise<PhoneFolder | null>;
  scanFolder: (uri: string) => Promise<{
    files: Omit<LibraryEntry, "sourceId" | "sourceName" | "origin">[];
    complete: boolean;
    errors: number;
  }>;
  openFile: (uri: string, mime: string) => Promise<void>;
  releaseFolder: (uri: string) => Promise<void>;
};
const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<IndexModule>("GalleryLocalIndex")
    : null;
export const phoneIndexAvailable = Boolean(native);
function module() {
  if (!native)
    throw new Error(
      "Phone folder indexing is available in the Gallery Android app.",
    );
  return native;
}
export const pickPhoneFolder = () => module().pickFolder();
export const scanPhoneFolder = async (folder: PhoneFolder) => {
  const result = await module().scanFolder(folder.uri);
  return {
    ...result,
    files: result.files.map((file) => ({
      ...file,
      origin: "phone" as const,
      sourceId: folder.uri,
      sourceName: folder.name,
    })),
  };
};
export const openPhoneFile = (entry: LibraryEntry) =>
  module().openFile(entry.uri!, entry.mimeType);
export const releasePhoneFolder = (folder: PhoneFolder) =>
  module().releaseFolder(folder.uri);

export const loadPhoneIndexState = () =>
  native
    ? native.loadIndexState()
    : AsyncStorage.getItem("gallery.phone-index.v1");
export const savePhoneIndexState = (state: string) =>
  native
    ? native.saveIndexState(state)
    : AsyncStorage.setItem("gallery.phone-index.v1", state);
