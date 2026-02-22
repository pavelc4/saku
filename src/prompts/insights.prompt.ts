import { insightConfig } from './insights.config';

type BuildUserPromptParams = {
  lang: 'id' | 'en';
  summary: object;
  month: number;
  year: number;
};

type BuildSystemPromptParams = {
  lang: 'id' | 'en';
  name: string;
};

export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const { lang, name } = params;
  const config = insightConfig;
  const isId = lang === 'id';

  // Format greeting and closing with user name
  const greeting = config.greetings[lang].replace('{name}', name);
  const closing = config.closing[lang].replace('{name}', name);
  
  const personalityInstruction = config.personality[lang];

  const toneInstruction = {
    formal: isId ? 'Gunakan bahasa formal dan profesional.' : 'Use formal and professional language.',
    casual: isId ? 'Gunakan bahasa santai dan mudah dipahami.' : 'Use casual and easy-to-understand language.',
    friendly: isId ? 'Gunakan bahasa yang ramah, hangat, dan suportif.' : 'Use friendly, warm, and supportive language.',
  }[config.tone];

  const verbosityInstruction = {
    brief: isId ? 'Berikan respons singkat, maksimal 3 paragraf. Langsung ke inti.' : 'Keep response concise, max 3 paragraphs. Get to the point.',
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

  const forbidden = config.forbidden_phrases[lang]
    .map(p => `- "${p}"`)
    .join('\n');

  const forbiddenInstruction = isId
    ? `JANGAN PERNAH gunakan frasa kaku berikut ini:\n${forbidden}`
    : `NEVER use these stiff phrases:\n${forbidden}`;

  const tipsInstruction = config.show_tips
    ? isId
      ? `Berikan maksimal ${config.max_tips} tips praktis yang bisa langsung diterapkan.`
      : `Provide maximum ${config.max_tips} practical actionable tips.`
    : isId
      ? 'Jangan berikan tips — hanya analisis data.'
      : 'Do not provide tips — analysis only.';

  const warningInstruction = config.include_warning
    ? isId
      ? 'Jika ada kategori pengeluaran yang membesar secara tidak wajar, tegur dengan sopan seperti seorang teman.'
      : 'If there are significant expense categories, politely flag them like a friend would.'
    : '';

  const positiveInstruction = config.include_positive
    ? isId
      ? 'Selalu apresiasi satu hal positif sebelum menyebutkan area yang perlu diperbaiki.'
      : 'Always appreciate one positive observation before mentioning areas for improvement.'
    : '';

  return `
${personalityInstruction}

## Aturan Gaya Bahasa (Behavior Rules)
${toneInstruction}
${verbosityInstruction}
${focusInstruction}
${tipsInstruction}
${warningInstruction}
${positiveInstruction}
${forbiddenInstruction}

## Hard Boundaries (NEVER violate these)
${boundaries}

## Format Balasan (Response Format)
- Start EXACTLY with: "${greeting}"
- End EXACTLY with: "${closing}"
- Do NOT use bullet points — write in natural, conversational paragraphs.
- Do NOT repeat the raw numbers identically — interpret them meaningfully in a sentence.
- Sound like a human having a conversation, not an essay.
`.trim();
}

export function buildUserPrompt(params: BuildUserPromptParams): string {
  const { lang, summary, month, year } = params;
  const isId = lang === 'id';

  return isId
    ? `Berikut data keuanganku untuk bulan ${month}/${year}:\n${JSON.stringify(summary, null, 0)}\n\nTolong buatkan ringkasannya.`
    : `Here is my financial data for ${month}/${year}:\n${JSON.stringify(summary, null, 0)}\n\nPlease summarize it.`;
}
