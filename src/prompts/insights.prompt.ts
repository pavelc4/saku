import { insightConfig } from './insights.config';
import type { InsightConfig } from './insights.config';

type BuildPromptParams = {
  lang: 'id' | 'en';
  summary: object;
  month: number;
  year: number;
};

export function buildSystemPrompt(lang: 'id' | 'en'): string {
  const config = insightConfig;
  const isId = lang === 'id';

  const toneInstruction = {
    formal: isId ? 'Gunakan bahasa formal dan profesional.' : 'Use formal and professional language.',
    casual: isId ? 'Gunakan bahasa santai dan mudah dipahami.' : 'Use casual and easy-to-understand language.',
    friendly: isId ? 'Gunakan bahasa yang ramah, hangat, dan suportif.' : 'Use friendly, warm, and supportive language.',
  }[config.tone];

  const verbosityInstruction = {
    brief: isId ? 'Berikan respons singkat, maksimal 3 paragraf.' : 'Keep response concise, max 3 paragraphs.',
    detailed: isId ? 'Berikan analisis menyeluruh dan komprehensif.' : 'Provide thorough and comprehensive analysis.',
  }[config.verbosity];

  const focusInstruction = {
    spending: isId ? 'Fokus pada analisis pengeluaran.' : 'Focus on spending analysis.',
    saving: isId ? 'Fokus pada potensi tabungan dan efisiensi.' : 'Focus on saving potential and efficiency.',
    balanced: isId ? 'Berikan analisis seimbang antara pemasukan dan pengeluaran.' : 'Provide balanced analysis of income and expenses.',
  }[config.focus];

  const boundaries = config.boundaries
    .map((b, i) => `${i + 1}. ${b}`)
    .join('\n');

  const tipsInstruction = config.show_tips
    ? isId
      ? `Berikan maksimal ${config.max_tips} tips praktis yang actionable.`
      : `Provide maximum ${config.max_tips} practical actionable tips.`
    : isId
      ? 'Jangan berikan tips — hanya analisis data.'
      : 'Do not provide tips — analysis only.';

  const warningInstruction = config.include_warning
    ? isId
      ? 'Jika ada kategori pengeluaran yang signifikan, berikan peringatan dengan sopan.'
      : 'If there are significant expense categories, politely flag them.'
    : '';

  const positiveInstruction = config.include_positive
    ? isId
      ? 'Selalu awali dengan satu hal positif sebelum menyebutkan area yang perlu diperbaiki.'
      : 'Always start with one positive observation before mentioning areas for improvement.'
    : '';

  return `
You are a financial assistant for SAKU, a financial management app for Indonesian MSMEs.

## Behavior Rules
${toneInstruction}
${verbosityInstruction}
${focusInstruction}
${tipsInstruction}
${warningInstruction}
${positiveInstruction}

## Hard Boundaries (NEVER violate these)
${boundaries}

## Response Format
- Start with: "${config.greetings[lang]}"
- End with: "${config.closing[lang]}"
- Do NOT use bullet points — write in natural paragraphs.
- Do NOT repeat the raw numbers from the data — interpret them meaningfully.
`.trim();
}

export function buildUserPrompt(params: BuildPromptParams): string {
  const { lang, summary, month, year } = params;
  const isId = lang === 'id';

  return isId
    ? `Berikut data keuangan untuk bulan ${month}/${year}:\n${JSON.stringify(summary, null, 0)}`
    : `Here is the financial data for ${month}/${year}:\n${JSON.stringify(summary, null, 0)}`;
}
