import { z } from "zod";
const schema = z
  .array(
    z.object({
      id: z.string().min(1).max(120),
      name: z.string().min(1).max(120),
      description: z.string().max(500).default(""),
    }),
  )
  .max(50);
/** Only the operator's curated catalogue reaches the client. Never expose hosts or credentials. */
export function hostedModels(
  input = process.env.GALLERY_APPROVED_MODELS_JSON ?? "[]",
) {
  try {
    const models = schema.parse(JSON.parse(input));
    if (new Set(models.map((m) => m.id)).size !== models.length) return [];
    return models;
  } catch {
    return [];
  }
}
