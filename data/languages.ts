export const languageOptions = [
	{
		code: "en-US",
		label: "English",
		textConfigKey: "en",
	},
	{
		code: "ko-KR",
		label: "한국어",
		textConfigKey: "ko",
	},
] as const;

export type LanguagePreference = (typeof languageOptions)[number]["code"];

export function isLanguagePreference(value: unknown): value is LanguagePreference {
	return languageOptions.some((option) => option.code === value);
}

export function getLanguageLabel(language: LanguagePreference) {
	return languageOptions.find((option) => option.code === language)?.label ?? language;
}
