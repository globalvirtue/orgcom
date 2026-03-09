export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'ig', name: 'Igbo' },
    { code: 'ha', name: 'Hausa' },
    { code: 'pcm', name: 'Pidgin' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const LANGUAGE_MAP = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((l) => [l.code, l.name])
) as Record<string, string>;
