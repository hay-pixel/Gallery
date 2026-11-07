declare module "react-dom/server" {
  export function renderToStaticMarkup(element: React.ReactNode): string;
  export function renderToString(element: React.ReactNode): string;
}

declare module "react-native-web" {
  const content: any;
  export default content;
  export const View: any;
  export const Text: any;
  export const Modal: any;
  export const ScrollView: any;
  export const FlatList: any;
  export const Pressable: any;
  export const TextInput: any;
  export const StyleSheet: any;
}
