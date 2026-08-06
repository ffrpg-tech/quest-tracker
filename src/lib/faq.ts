/** Short, self-contained Q&A pairs — the single source of truth for both the
 * visible FAQ section on the About page and the FAQPage JSON-LD emitted there,
 * so an AI assistant summarizing/citing the page and a human reader see the
 * same answers. */
export const faqItems = [
	{
		question: 'What is the Farm RPG Quest Wall Calculator?',
		answer:
			"A free tool for the FarmRPG game: paste your in-game inventory, pick a Quest Wall questline, and it tells you the first quest in that chain you can't complete with your current materials — before you start turning items in."
	},
	{
		question: 'Is this affiliated with FarmRPG?',
		answer:
			"No. This is an unofficial fan project, it isn't made or run by the FarmRPG developers. All credit for the game goes to them."
	},
	{
		question: 'Does it cost anything?',
		answer: 'No. This tool is free and will never be monetized.'
	},
	{
		question: 'Does it save my progress?',
		answer:
			'Yes — your inventory, questline queue, completed quests, and pasted player stats are all saved to your browser\'s local storage automatically. The "Progress backup" button exports/imports everything except your inventory as a JSON file (questline queue, completed quests, and player stats).'
	},
	{
		question: "I'm not seeing a new feature or quest data that should be there — what's wrong?",
		answer:
			"Your browser (or a CDN in between) may be serving a cached copy of the page or its data. Try a hard refresh — Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac) — before assuming something's broken."
	}
];
