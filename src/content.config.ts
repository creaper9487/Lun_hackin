import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
	}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		year: z.number().int(),
		stack: z.array(z.string()),
		tone: z.enum(['pink', 'blue']).default('pink'),
		// position on the homepage strip and in /projects
		order: z.number().int(),
		repo: z.url().optional(),
		site: z.url().optional(),
	}),
});

// Organizations and roles; shown on the back of the homepage Works cards, paired with projects by `order`.
const experience = defineCollection({
	loader: glob({ base: './src/content/experience', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		organization: z.string(),
		role: z.string(),
		period: z.string(),
		summary: z.string(),
		tags: z.array(z.string()).default([]),
		link: z.url().optional(),
		order: z.number().int(),
	}),
});

export const collections = { blog, projects, experience };
