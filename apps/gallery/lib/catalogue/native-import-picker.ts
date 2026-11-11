import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import type { CanonicalImportPicker } from "./pick-import";

// File contents come only from the document explicitly selected by the user.
export function createCanonicalImportPicker(): CanonicalImportPicker {
  let selected: DocumentPicker.DocumentPickerAsset | undefined;
  return {
    async pickDocument() {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return { canceled: true };
      selected = result.assets[0];
      return {
        canceled: false,
        name: selected.name,
        mimeType: selected.mimeType,
        sizeBytes: selected.size,
        uri: selected.uri,
      };
    },
    async readText(uri) {
      if (!selected || selected.uri !== uri)
        throw new Error("No selected import file");
      // Web exposes the browser File; native uses the cache copy granted by the picker.
      return selected.file ? selected.file.text() : new File(uri).text();
    },
  };
}
