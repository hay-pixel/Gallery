import { describe, it, expect } from "vitest";
import { hostedModels } from "../server/hostedModels";
describe("operator model catalogue", () => {
  it("is empty until the operator supplies models", () =>
    expect(hostedModels("[]")).toEqual([]));
  it("strips private configuration and never accepts client model URLs", () =>
    expect(
      hostedModels(
        '[{"id":"gallery-chat","name":"Gallery Chat","host":"http://private:11434","secret":"do-not-expose"}]',
      ),
    ).toEqual([{ id: "gallery-chat", name: "Gallery Chat", description: "" }]));
  it("fails closed for malformed or duplicate model IDs", () => {
    expect(hostedModels("broken")).toEqual([]);
    expect(
      hostedModels('[{"id":"x","name":"a"},{"id":"x","name":"b"}]'),
    ).toEqual([]);
  });
});
