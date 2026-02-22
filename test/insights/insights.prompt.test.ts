import { describe, expect, test } from "bun:test";
import { buildSystemPrompt, buildUserPrompt } from "../../src/prompts/insights.prompt";
import { insightConfig } from "../../src/prompts/insights.config";

describe("Prompt Builder API", () => {
  describe("buildSystemPrompt", () => {
    test("generates correct prompt for Indonesian language", () => {
      const prompt = buildSystemPrompt({ lang: 'id', name: 'Budi' });
      
      // Should contain the greeting and closing from config with name replaced
      expect(prompt).toContain(insightConfig.greetings.id.replace('{name}', 'Budi'));
      expect(prompt).toContain(insightConfig.closing.id.replace('{name}', 'Budi'));
      
      // Should not contain English greeting/closing
      expect(prompt).not.toContain(insightConfig.greetings.en.replace('{name}', 'Budi'));

      // Should contain boundaries
      expect(prompt).toContain(insightConfig.boundaries[0]);
    });

    test("generates correct prompt for English language", () => {
      const prompt = buildSystemPrompt({ lang: 'en', name: 'Budi' });
      
      // Should contain the greeting and closing from config with name replaced
      expect(prompt).toContain(insightConfig.greetings.en.replace('{name}', 'Budi'));
      expect(prompt).toContain(insightConfig.closing.en.replace('{name}', 'Budi'));
      
      // Should not contain Indonesian greeting/closing
      expect(prompt).not.toContain(insightConfig.greetings.id.replace('{name}', 'Budi'));
    });
  });

  describe("buildUserPrompt", () => {
    test("formats user prompt correctly in Indonesian", () => {
      const summary = { income: 5000000, expense: 3000000 };
      const prompt = buildUserPrompt({
        lang: 'id',
        summary,
        month: 10,
        year: 2023
      });
      
      expect(prompt).toContain("Berikut data keuanganku untuk bulan 10/2023");
      expect(prompt).toContain('"income":5000000');
    });

    test("formats user prompt correctly in English", () => {
      const summary = { income: 5000000, expense: 3000000 };
      const prompt = buildUserPrompt({
        lang: 'en',
        summary,
        month: 10,
        year: 2023
      });
      
      expect(prompt).toContain("Here is my financial data for 10/2023");
      expect(prompt).toContain('"income":5000000');
    });
  });
});
