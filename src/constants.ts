export const TEAM_DISPLAY_ORDER = ['red', 'blue', 'green', 'yellow'] as const

export const TEAM_ORDER_LOOKUP: Record<string, number> = TEAM_DISPLAY_ORDER.reduce(
	(acc, slug, index) => ({ ...acc, [slug]: index }),
	{} as Record<string, number>
)
