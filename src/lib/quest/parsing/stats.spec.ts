import { describe, it, expect } from 'vitest';
import { parsePlayerStatsPaste, StatsParseError } from './stats';

// Real "My Profile" page dumps (select-all + copy), captured once to unblock
// this parser — see the plan's session notes for provenance. One is
// Tower-locked (own profile), the other Tower-unlocked (a friend's profile,
// which is why it carries extra Friends-list/Merit Badges chrome).

const PROFILE_TOWER_LOCKED = `
Help
Global
Spoilers
Trivia
Giveaways
Trade
Say something...
This chat is currently in read-only mode. This channel will be turned on/off by staff for player run trivia games or special events. Message a ranger if you would like to host a trivia event with a specific time and date.
Attention: Want to host your own event in Trivia? Contact a Ranger on the Farm RPG Staff List. Check Event Calendar for upcoming events.

View Chat Log
Navigation
  Home
  My Profile
  My Inventory
  My Workshop
  My Kitchen
  My Mailbox
  My Messages
  My Friends (3)
  My Settings
  Town
  Library
  About / Updates
  Logout

Farm RPG
Back
Player Profile

Where do you want to go?
Farm House
My Farm
Farm Name: Terrafarm

My Inventory
Grown crops, items, materials, etc.

My Workshop
Craft new items to collect or sell

My Kitchen
Cook Meals for Active Effects

Go into Town
Buy & Sell, Improve your farm, etc.

Go Fishing
See what you can catch

Go Exploring
Find new places to explore
READY!

Help Needed
Special Requests Available!
1 READY!

The Tower
Missing Tower Key
LOCKED

Bottle Rocket Brawl
It's an all out war!
READY!

Support the Game
Refresher Packs are back!
My skills

Farming
Level 99

Fishing
Level 99

Crafting
Level 99
Rewards
Ready!

Exploring
Level 97

Cooking
Level 4

Mining
Now in Beta
Perks, Mastery & More

Unlock Perks
Unused Points: 3
1 Available

Mastery Progress
Rewards from Crops/Fish/Crafts

Friendship Levels
Make friendships with Townsfolk
Borgen

Daily Chores
Earn Ancient Coins Daily
5 Left
Most Recent Update

Jul 13, 2026
Roomba's Nest is now available, letting you automate select farm tasks after completing a new questline tied to Roomba Friendship. This update also adds new Help Request rewards, a screenshots preview for new players, and various performance and stability improvements.
Other Stuff
 2,460 Online
 56 New Today
 Find a Player
 Events (6)
 Discord
 Reddit
 Facebook
 Buddy Farm
 Feedback
 Patreon
 Light Mode
 Settings
 Code of Conduct
 Terms of Use
 Game Support

Made with  by humans - © 2026 Magic & Wires, LLC
Current server time: 2:20 AM - Monday, July 20








kodyy
Terrafarm
Master Farmer

Jun 5, 2026
Started

Online
Playing Now
Public Bio
Hey there! I'm here to play within my heart's content!

I occasionally give lots of Welcome Card to new players below level 10 and I always lurk in Giveaways Chat and give whatever I can!

Big thanks to the community that helped me from the beginning!
Special thanks to Jack, Jen., Duck Dad Friend, Fishing, Foon

Joined - 2026/06/05
Pitchfork Level 99 - 2026/06/22
Fishing Net Level 99
Profile Sections
 Progress
 Farm
 Items
 Animals

Farming
Level 99

Fishing
Level 99

Crafting
Level 99

Exploring
Level 97

Cooking
Level 4

Mining
Now in Beta
Trophies

Corn Speedrun Trophy
Friendship Levels

Rosalie
Level 10

Holger
Level 10

Beatrix
Level 12

Thomas
Level 12

Cecil
Level 11

George
Level 19

Jill
Level 22

Vincent
Level 13

Lorn
Level 11

Buddy
Level 10

Borgen
Level 6

Ric Ryph
Level 6

Mummy
Level 1

Star
Level 8

Charles
Level 7

ROOMBA
Level 5

CptThomas
Level 9

frank
Level 10

Mariya
Level 6

Baba Gec
Level 1

Geist
Level 4

Gary
Level 3

Cid
Level 1

Goostav
Level 1
Game Stats
 Net Worth
3,307,392,834
 Crops Planted
33,118
 Fish Caught
18,803
 Best Streak
2,759
 Items Crafted
366,448
 Explore Count
3,296,513
 Meals Cooked
23
 Meals Stirred
22
 Meals Tasted
21
 Meals Seasoned
19
 Requests Complete
606
 Personal Requests
12
 Items Mastered
44
 Items Grand Mastered
12
 Items Mega Mastered
0
 Items Donated
3,489
 Wheel Spins
318
 Hut Chests Opened
28
 Vault Codes Cracked
31
 Well Tosses
383
 Buddyjack Wins
0
 Lost & Found Games Won
0
 Friended By
10












`;

const PROFILE_TOWER_UNLOCKED = `
Help
Global
Spoilers
Trivia
Giveaways
Trade
Say something...
This chat is currently in read-only mode. This channel will be turned on/off by staff for player run trivia games or special events. Message a ranger if you would like to host a trivia event with a specific time and date.
Attention: Want to host your own event in Trivia? Contact a Ranger on the Farm RPG Staff List. Check Event Calendar for upcoming events.

View Chat Log
Navigation
  Home
  My Profile
  My Inventory
  My Workshop
  My Kitchen
  My Mailbox
  My Messages
  My Friends (3)
  My Settings
  Town
  Library
  About / Updates
  Logout

Back
My Friends
Back
Player Profile
Search
 About My Friends

 My Referral Code



 Referral Rewards
My Friends
Online
 coderanger
Player is Online!
Message
Mailbox
 Fishing
Player is Online!
Message
Mailbox
Tiny Tuba
Player is Online!
Message
Mailbox
Offline
 Duck Dad Friend
Online Status Hidden
Message
Mailbox
 Jack
Last Online 15h 3m 10s ago
Message
Mailbox
 Jen.
Last Online 1h 48m 37s ago
Message
Mailbox
 Lilac Breeze
Last Online 1d 13h 38m 22s ago
Message
Mailbox
 prairie critter
Last Online 4h 1m 37s ago
Message
Mailbox
 Raven Softfeather
Online Status Hidden
Message
Mailbox






 Message
Mailbox
(Full)
Un-Friend
Block


Duck Dad Friend
Lone Oak Pastures
Master Farmer

Jan 10, 2025
Started
Star for each year playing

Patreon
Beta Tester
Public Bio
They/them but you can call me Dad.

Neither a father, a man, nor your friend (I am committing felonies as we speak.)

A Daddy with a biiiiiiiiggg store of the noisy things - Betamax the Arctophile

Find out today if you qualify for Fathers Duckling Militia! Current members
Anya Moss (she doesnt know it but shes grandma Duck)
Tandoori Duck (Daughter Duck)
DucksInflux (Founding Duck)
Duck The Bomber (Fighter Duck)
Squigs (The sound a duck makes when it walks)
Hobby Dad (just because)
Profile Sections
 Progress
 Farm
 Items
 Animals


Tower Level
220
220 of 340 Floors Unlocked

Skill Progress

Farming
Level 99

Fishing
Level 99

Crafting
Level 99

Exploring
Level 99

Cooking
Level 74

Mining
Now in Beta
Merit Badges

Big Backpack
2026-07-09

Expert Artisan
2026-07-08

Responsible Wheel Spinner
2026-06-19

Into the Darkness
2026-06-09

Raptor Trainer
2025-06-17

Grand Master
2025-06-13

I am the Great Explorer
2025-05-14

Mega Farm
2025-05-13

Community Saint
2025-05-05
Friendship Levels

Rosalie
Level 77

Holger
Level 71

Beatrix
Level 71

Thomas
Level 70

Cecil
Level 78

George
Level 79

Jill
Level 74

Vincent
Level 63

Lorn
Level 86

Buddy
Level 71

Borgen
Level 62

Ric Ryph
Level 72

Mummy
Level 73

Star
Level 73

Charles
Level 62

ROOMBA
Level 73

CptThomas
Level 50

frank
Level 61

Mariya
Level 73

Baba Gec
Level 81

Geist
Level 57

Gary
Level 85

Cid
Level 60

Goostav
Level 49











`;

describe('parsePlayerStatsPaste', () => {
	it('parses a Tower-locked profile paste, defaulting tower to 0', () => {
		const stats = parsePlayerStatsPaste(PROFILE_TOWER_LOCKED);
		expect(stats).toMatchObject({
			farming: 99,
			fishing: 99,
			crafting: 99,
			exploring: 97,
			cooking: 4,
			tower: 0
		});
	});

	it('resolves truncated NPC names to their canonical name', () => {
		const stats = parsePlayerStatsPaste(PROFILE_TOWER_LOCKED);
		expect(stats.npcLevels).toMatchObject({
			'Star Meerif': 8,
			'Charles Horsington III': 7,
			'Gary Bearson V': 3,
			'Captain Thomas': 9
		});
	});

	it('skips the decoy Friendship Levels teaser and reads the real list', () => {
		const stats = parsePlayerStatsPaste(PROFILE_TOWER_LOCKED);
		// The teaser shows "Borgen" followed by "Daily Chores" (no level) before
		// the real list later on the page shows "Borgen" followed by "Level 6".
		expect(stats.npcLevels.Borgen).toBe(6);
	});

	it('parses every listed NPC friendship level', () => {
		const stats = parsePlayerStatsPaste(PROFILE_TOWER_LOCKED);
		expect(stats.npcLevels).toEqual({
			Rosalie: 10,
			Holger: 10,
			Beatrix: 12,
			Thomas: 12,
			Cecil: 11,
			George: 19,
			Jill: 22,
			Vincent: 13,
			Lorn: 11,
			Buddy: 10,
			Borgen: 6,
			'Ric Ryph': 6,
			Mummy: 1,
			'Star Meerif': 8,
			'Charles Horsington III': 7,
			ROOMBA: 5,
			'Captain Thomas': 9,
			frank: 10,
			Mariya: 6,
			'Baba Gec': 1,
			Geist: 4,
			'Gary Bearson V': 3,
			Cid: 1,
			Goostav: 1
		});
	});

	it('parses a Tower-unlocked profile paste, reading the real Tower level', () => {
		const stats = parsePlayerStatsPaste(PROFILE_TOWER_UNLOCKED);
		expect(stats).toMatchObject({
			farming: 99,
			fishing: 99,
			crafting: 99,
			exploring: 99,
			cooking: 74,
			tower: 220
		});
	});

	it('parses a "Not Started" skill (not yet unlocked) as level 0', () => {
		const stats = parsePlayerStatsPaste(
			PROFILE_TOWER_LOCKED.replace('Cooking\nLevel 4', 'Cooking\nNot Started')
		);
		expect(stats.cooking).toBe(0);
	});

	it('throws StatsParseError on input with no recognizable skills block', () => {
		expect(() => parsePlayerStatsPaste('just some random pasted text with no skills')).toThrow(
			StatsParseError
		);
	});
});
