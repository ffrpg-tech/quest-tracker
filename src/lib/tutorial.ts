/** Ordered "how do I actually use this" walkthrough — setup once, then a
 * repeating loop while you play. Rendered on the About page and used to
 * source the HowTo JSON-LD there; the empty-state nudge on the main page
 * shows a shorter version of the setup steps inline. */
export const tutorialSteps = [
	{
		step: 1,
		title: 'Import your player stats (optional, do it first)',
		summary:
			'Paste your "My Profile" page to unlock level and NPC-friendship eligibility checks.',
		details:
			'This unlocks the eligibility filter and LOCKED badges on the questline list. Skip it if you don\'t care about eligibility checks — everything else still works without it.'
	},
	{
		step: 2,
		title: 'Import your already-completed quests',
		summary:
			"Paste your \"Help Needed → Completed\" page so quests you've already finished are marked done before you pick anything.",
		details:
			'Doing this before you pick questlines means quest-to-quest prerequisite checks and completion counts are accurate from the start, instead of you discovering it mid-setup.'
	},
	{
		step: 3,
		title: 'Pick and queue your questlines',
		summary:
			"Search and select the questlines you're working on — order matters, since they share one inventory.",
		details:
			'Drag to reorder the queue: whichever questline is earlier gets first claim on scarce shared items, so put your priority questline first. You can queue more than one at a time and see a combined shortfall across all of them.'
	},
	{
		step: 4,
		title: 'Import your inventory — and your silver',
		summary:
			'Paste your Inventory page, then separately paste your Bank page for Silver.',
		details:
			"Every shortfall the calculator shows you is just a diff against whatever inventory you last pasted — so it's worth doing this last in setup, after your stats and questline queue are settled, so the numbers you get reflect what you actually have right now. Silver gets its own import because it's tracked as a requirement just like any other item, but it doesn't live on the Inventory page in-game."
	},
	{
		step: 5,
		title: 'Read the shortfall summary and results',
		summary:
			"See the first quest in each chain you can't complete yet, and a combined shortfall across your whole queue.",
		details:
			'Each questline shows its own "wall point" — the first quest you\'re short on materials for. The shortfall summary rolls all queued questlines into one item-level breakdown, so you know exactly what to farm next regardless of which chain it unblocks.'
	},
	{
		step: 6,
		title: 'Check off quests as you complete them — then loop back',
		summary:
			'Marking a quest done spends items your last inventory paste doesn\'t know about yet.',
		details:
			"Finishing a quest spends materials, so the moment you complete one, your last pasted inventory is no longer the truth — every shortfall number computed from it is now slightly optimistic. Checking it off (or re-importing your completed list) is what tells the calculator to stop counting that quest's requirements, but it can't know what you actually still have on hand until you re-paste inventory too. That's the loop: check off, re-paste inventory, re-check your questline order if priorities shifted, repeat."
	}
];
