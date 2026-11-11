/** Clone catalogue JSON without depending on a browser-only structuredClone global. */
export function cloneCatalogueValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function")
    return globalThis.structuredClone(value);
  if (Array.isArray(value))
    return value.map((item) => cloneCatalogueValue(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneCatalogueValue(item),
      ]),
    ) as T;
  }
  return value;
}
