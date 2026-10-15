export const languages = {
	'zh-tw': '繁體中文',
	en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'zh-tw';

export const htmlLang: Record<Lang, string> = {
	'zh-tw': 'zh-Hant-TW',
	en: 'en',
};

export const ui = {
	'zh-tw': {
		'nav.home': '首頁',
		'nav.blog': '文章',
		'nav.projects': '作品',
	},
	en: {
		'nav.home': 'Home',
		'nav.blog': 'Blog',
		'nav.projects': 'Projects',
	},
} as const;

export function getLangFromUrl(url: URL): Lang {
	const [, first] = url.pathname.split('/');
	return first in languages ? (first as Lang) : defaultLang;
}

export function useTranslations(lang: Lang) {
	return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
		return ui[lang][key] ?? ui[defaultLang][key];
	};
}
