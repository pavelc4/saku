import configJson from './insights.config.json';

export type InsightTone = 'formal' | 'casual' | 'friendly';
export type InsightVerbosity = 'brief' | 'detailed';
export type InsightFocus = 'spending' | 'saving' | 'balanced';

export type InsightConfig = {
  tone: InsightTone;
  verbosity: InsightVerbosity;
  show_tips: boolean;
  max_tips: 1 | 2 | 3;
  include_warning: boolean;
  include_positive: boolean;
  focus: InsightFocus;
  personality: { id: string; en: string };
  greetings: { id: string; en: string };
  closing: { id: string; en: string };
  forbidden_phrases: { id: string[]; en: string[] };
  boundaries: string[];
};

// Validate config shape at import time
export const insightConfig: InsightConfig = configJson as InsightConfig;
