// Placeholder content for the design lab (/lab). Delete with src/pages/lab once a direction is chosen.
export interface LabPost {
	title: string;
	description: string;
	date: Date;
	href: string;
}

export const posts: LabPost[] = [
	{
		title: 'Hello World',
		description: '第一篇文章，順便測試 React 和 Vue 元件能不能放在同一頁。',
		date: new Date('2026-10-14'),
		href: '/blog/hello-world/',
	},
	{
		title: '在 Sui 上寫錢包合約學到的事',
		description: 'Move 的物件模型和 Solidity 很不一樣，記下幾個踩過的坑。',
		date: new Date('2026-09-28'),
		href: '#',
	},
	{
		title: '為什麼這個網站選 Astro',
		description: '內容為主、元件按需載入，剛好符合部落格加作品集的需求。',
		date: new Date('2026-09-10'),
		href: '#',
	},
	{
		title: '同一個專案混用 React 和 Vue',
		description: 'Islands 架構下兩個框架怎麼共存，以及什麼時候不該這樣做。',
		date: new Date('2026-08-22'),
		href: '#',
	},
];

export const projects = [
	{ name: 'sup_wallet', summary: 'Sui Move 錢包合約，處理資產託管與授權。', tags: ['Move', 'Sui'], year: 2026, href: '#' },
	{ name: 'Lun Hackin', summary: '這個網站。Astro 搭配 React 與 Vue 元件。', tags: ['Astro', 'React', 'Vue'], year: 2026, href: '/' },
	{ name: '互動實驗室', summary: '小型前端互動 demo 的收集處。', tags: ['React', 'Vue'], year: 2026, href: '/projects' },
];

export const links = [
	{ label: 'GitHub', href: '#' },
	{ label: 'X', href: '#' },
	{ label: 'Email', href: '#' },
	{ label: 'RSS', href: '/rss.xml' },
];
