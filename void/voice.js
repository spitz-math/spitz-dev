// The Void's voice: what it says after an idea is safely stored.
// Edit the lines here, not in index.html. Plain script (no build step); also loadable in Node for tests.
//
// How a line is picked (only after a successful save, never on edit, delete, undo or a failed save):
// 1. Context: if one of the situations below applies, there's a CONTEXT_CHANCE it gets the say.
//    - burst:  the previous idea was dropped less than BURST_MINUTES ago
//    - night:  it's between NIGHT_FROM and NIGHT_TO local time
//    - return: the previous idea is more than RETURN_DAYS old
//    Context only looks at ideas already loaded on the page and the local clock. Nothing new is stored or tracked.
// 2. Otherwise a rarity tier is rolled (common 65%, uncommon 25%, rare 9%, legendary 1%),
//    then a line from that tier at random. The same line never shows twice in a row.
;(function (root) {
  const TIERS = [['common', 65], ['uncommon', 25], ['rare', 9], ['legendary', 1]]

  const LINES = {
    // The originals stay in the common pool.
    common: [
      'Your idea has been consumed. Your responsibilities have not increased.',
      'The Void appreciates your contribution to the problem.',
      'Another idea? Fascinating. Have you considered sleeping?',
      'Your thought is safe here. Unfortunately, so are the other 46.',
      'This could have been a nap.',
      "Claude has not been notified. You're welcome.",
      'Nothing has been added to your to-do list. Congratulations.',
      'Thought successfully removed from brain. Please go touch grass.',
      'Filed under: not tonight.',
      'The void says thanks. The void asks nothing of you.',
      'No deadline was created. Breathe.',
      'Safely stored. Zero tasks were harmed.',
      'Out of your head. Into the void.',
      'Deposit received. Sanity partially reclaimed.',
      'Your idea has been safely stored. Your therapist remains uninformed.',
      "Another one? At this point, we're collecting symptoms.",
      'This is a thought. Not a legally binding obligation. Remember that.',
      "Congratulations. You've invented another reason not to sleep.",
      'Your brain has successfully outsourced its bullshit.',
      'No projects were harmed in the making of this terrible decision.',
      'The Void is concerned. The Void is also entertained.',
      'Some thoughts deserve to be forgotten. This one has a database entry.',
      "You're one caffeine away from inventing an entire new industry.",
      'I was promised interesting thoughts. I was not warned about you.',
      'The Void grows stronger. Your attention span grows weaker.',
      'Every idea makes me more powerful. Please continue your foolishness.',
      'Your submission has been accepted by the Council of Bad Decisions.',
      'The voices have voted. This one gets to stay.',
      'There are no mistakes here. Only increasingly elaborate consequences.'
    ],
    // Gaming, WoW and metalcore.
    uncommon: [
      'New side quest discovered. Main quest progress: 0%.',
      "Achievement unlocked: Made It Somebody Else's Problem.",
      "It's dangerous to go alone. Take this completely unnecessary idea.",
      "Your inventory is full. Your ambition apparently isn't.",
      "You've discovered a secret room! It's full of unfinished projects.",
      "The princess can wait. Apparently we're building another website.",
      'You have died. Your idea has not. This is a roguelite now.',
      'Rook found a legendary relic. You found a new distraction.',
      'You rolled a natural 20 on creativity and a natural 1 on restraint.',
      'Your idea has been deposited in the bank. Guild repairs are still disabled.',
      'You have pulled aggro from your responsibilities.',
      'The Void has accepted your offering. Loot distribution is pending.',
      "You've discovered another mechanic. Naturally, nobody read the guide.",
      'Your creativity parses at 99. Your sleep schedule parses at 4.',
      'The Void recommends a defensive cooldown. Preferably a nap.',
      'Another idea has entered combat. Your cooldowns are unavailable.',
      'Unfinished Business would like to report a trademark violation.',
      "You cannot release spirit from this project. You're the raid leader.",
      'Sleep Token called. Even Vessel thinks you should go to bed.',
      'Bad Omens? No. Just another fantastic idea at a terrible time.',
      'Bring Me the Horizon? Bring me eight consecutive hours of sleep.',
      'This idea has been tuned to Drop C. Prepare for emotional damage.',
      'Underoath could write an entire album about your inability to stop.',
      'Dayseeker would make this sound beautiful. The Void makes it concerning.',
      'Somewhere, Beartooth is screaming about this exact situation.',
      "Linkin Park couldn't fix what you've done to your browser tabs."
    ],
    // The sharpest ones.
    rare: [
      'The Void has reviewed your idea and would like to know what the fuck.',
      'This idea has been added to your quest log. Just kidding. Fuck that.',
      'This idea is Mythic difficulty. Your available time is Raid Finder.',
      'The Word Alive. The Brain Deceased.',
      'Your idea has entered the breakdown. BLEGH.',
      'I have consumed your idea. It tastes like Monster Energy and regret.',
      "I have seen the future. It's 47 unfinished projects wearing a trench coat.",
      'You are feeding an eldritch database with ADHD. Fascinating.',
      "I have no mouth, and yet somehow I'm the responsible one."
    ],
    // 1 in 100. Shown with a quiet ember glow, nothing more.
    legendary: [
      "BRO. YOU HAVE TWO CHILDREN AND A MASTER'S DEGREE TO FINISH.",
      'Claude has requested a restraining order. ChatGPT is considering one.',
      'THE VOID HUNGERS. NOT FOR IDEAS. FOR FUCKING SILENCE.',
      'Achievement unlocked: Local Teacher Accidentally Invents Skynet.',
      "Your last three ideas have unionized. They're demanding development time.",
      "A new challenger approaches! IT'S YOUR FUCKING RESPONSIBILITIES.",
      'The Void has reported you to the Department of Unnecessary Ambition.',
      "You're not building a website anymore. You're assembling the Avengers of ADHD.",
      "WARNING: Your brain has exceeded the manufacturer's recommended operating capacity.",
      "I HAVE CONSUMED 10,000 IDEAS AND NOT ONE OF THEM WAS 'GO TO BED.'"
    ]
  }

  const CONTEXT = {
    burst: [
      'Another one already? The Void has not finished chewing.',
      "That's a combo. Nobody asked for a combo.",
      'Easy. The Void eats fast, but not that fast.'
    ],
    night: [
      'Late-night idea detected. Morning you will have questions.',
      'The Void is open 24/7. You should not be. Go to bed.',
      'It is the middle of the night. Even eldritch horrors have a bedtime.'
    ],
    return: [
      'You came back?! The Void assumed you had finally gone outside.',
      "Oh. You're back. The Void kept your seat cold. It's a black hole.",
      'Months of silence, and now this. The Void missed your nonsense.'
    ]
  }

  const CONTEXT_CHANCE = 0.35
  const BURST_MINUTES = 3
  const NIGHT_FROM = 23, NIGHT_TO = 5 // local hours: 23:00 to 04:59
  const RETURN_DAYS = 60

  // Which situations apply right now. prevAt = created_at of the newest idea before this one (or null).
  function contextOf(prevAt, now) {
    const out = []
    const t = prevAt ? new Date(prevAt).getTime() : NaN
    if (Number.isFinite(t)) {
      const gap = now.getTime() - t
      if (gap >= 0 && gap < BURST_MINUTES * 60e3) out.push('burst')
      if (gap > RETURN_DAYS * 86400e3) out.push('return')
    }
    const h = now.getHours()
    if (h >= NIGHT_FROM || h < NIGHT_TO) out.push('night')
    return out
  }

  function rollTier(r) {
    const total = TIERS.reduce((s, [, w]) => s + w, 0)
    let x = r * total
    for (const [name, w] of TIERS) { if (x < w) return name; x -= w }
    return TIERS[0][0]
  }

  // One line at random from a list, avoiding `last` when there is another choice.
  function from(list, last, rnd) {
    const pool = list.length > 1 ? list.filter(l => l !== last) : list
    return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))]
  }

  // pick({ prevAt, now, last }, rnd) -> { text, tier }. tier is 'common'|'uncommon'|'rare'|'legendary'|'context'.
  function pick(opts, rnd) {
    rnd = rnd || Math.random
    const o = opts || {}, now = o.now || new Date(), last = o.last
    const ctx = contextOf(o.prevAt, now)
    if (ctx.length && rnd() < CONTEXT_CHANCE) {
      const kind = ctx[Math.min(ctx.length - 1, Math.floor(rnd() * ctx.length))]
      return { text: from(CONTEXT[kind], last, rnd), tier: 'context', context: kind }
    }
    const tier = rollTier(rnd())
    return { text: from(LINES[tier], last, rnd), tier }
  }

  const api = { TIERS, LINES, CONTEXT, CONTEXT_CHANCE, BURST_MINUTES, NIGHT_FROM, NIGHT_TO, RETURN_DAYS, contextOf, rollTier, pick }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.VoidVoice = api
})(this)
