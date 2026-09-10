/**
 * Lightweight offline writing assistance.
 *
 * Local Assist does not call a remote AI provider. It uses context-aware
 * writing patterns so an existing caption is enhanced instead of being wrapped
 * in generic filler such as "A practical way to move forward".
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "in", "into", "is", "it", "of", "on", "or", "our", "the",
  "this", "to", "we", "with", "you", "your", "about", "that", "while", "let", "lets", "start",
]);

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTaskPrefix(value: string): { text: string; mode: "caption" | "rewrite" | "tone" | "ideas" } {
  const v = cleanText(value);
  const rewrite = v.match(/^rewrite this social media copy while preserving (?:the|its) meaning:\s*(.+)$/i);
  if (rewrite) return { text: rewrite[1].trim(), mode: "rewrite" };
  const tone = v.match(/^rewrite this social media copy in a .+? (?:tone|voice):\s*(.+)$/i);
  if (tone) return { text: tone[1].trim(), mode: "tone" };
  const ideas = v.match(/^create three distinct social media post ideas about:\s*(.+)$/i);
  if (ideas) return { text: ideas[1].trim(), mode: "ideas" };
  return { text: v, mode: "caption" };
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const clipped = value.slice(0, Math.max(0, max - 1)).trimEnd();
  const lastBreak = Math.max(clipped.lastIndexOf(" "), clipped.lastIndexOf("\n"));
  return `${(lastBreak > max * 0.65 ? clipped.slice(0, lastBreak) : clipped).trimEnd()}…`;
}

function sentence(value: string): string {
  const v = cleanText(value);
  if (!v) return "Share something worth remembering.";
  const capitalized = `${v.charAt(0).toUpperCase()}${v.slice(1)}`;
  return /[.!?…][\s\p{Extended_Pictographic}]*$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

type ContextId = "party" | "food" | "drinks" | "offer" | "event" | "education" | "business" | "beauty" | "travel" | "generic";

type ContextProfile = {
  keywords: string[];
  emoji: string;
  details: [string, string, string];
  ctas: [string, string, string];
  hashtags: string[];
};

const CONTEXTS: Record<ContextId, ContextProfile> = {
  party: {
    keywords: ["party", "dj", "dance", "nightlife", "club", "music", "karaoke", "sundowner", "celebrate", "celebration", "weekend", "vibe", "vibes"],
    emoji: "🎉",
    details: [
      "Good vibes, great energy, and a night made for memories.",
      "Bring your crew, turn up the music, and make every moment count.",
      "Tonight is for good company, loud laughs, and unforgettable vibes.",
    ],
    ctas: ["Who’s joining us?", "Tag your party crew.", "See you there."],
    hashtags: ["#party", "#nightlife", "#goodvibes", "#weekendvibes", "#partytime", "#livemusic"],
  },
  food: {
    keywords: ["food", "dish", "dinner", "lunch", "brunch", "restaurant", "menu", "delicious", "taste", "flavour", "flavor", "chef", "seafood", "pizza", "burger"],
    emoji: "🍽️",
    details: [
      "Good food, good company, and a table worth gathering around.",
      "Made to satisfy the craving and give you one more reason to come back.",
      "Fresh flavours, comforting bites, and a meal worth slowing down for.",
    ],
    ctas: ["What are you ordering first?", "Tag your dining partner.", "Come hungry."],
    hashtags: ["#food", "#foodlover", "#restaurant", "#foodie", "#goodfood", "#dining"],
  },
  drinks: {
    keywords: ["drink", "drinks", "cocktail", "beer", "wine", "vodka", "whisky", "whiskey", "rum", "bar", "happy hour", "cheers"],
    emoji: "🥂",
    details: [
      "Raise a glass to good company, great pours, and an easygoing night.",
      "Your next round deserves the right mood, the right people, and a little extra cheer.",
      "Good conversations start easily when the glasses are full and the vibe is right.",
    ],
    ctas: ["Who are you raising a glass with?", "Tag your drinking buddy.", "Cheers to that."],
    hashtags: ["#drinks", "#cocktails", "#bar", "#cheers", "#happyhour", "#nightout"],
  },
  offer: {
    keywords: ["offer", "sale", "discount", "deal", "off", "buy one", "1+1", "2+1", "mrp", "special price", "limited time"],
    emoji: "✨",
    details: [
      "A good deal deserves a spot on your plans before it’s gone.",
      "More value, less waiting—this is the kind of offer worth making a move for.",
      "Make the most of the moment while the offer is live.",
    ],
    ctas: ["Don’t miss it.", "Share this with someone who’d love the deal.", "Make your plan now."],
    hashtags: ["#offer", "#specialoffer", "#deal", "#limitedtime", "#savings", "#dontmissout"],
  },
  event: {
    keywords: ["event", "live", "show", "launch", "opening", "meetup", "workshop", "session", "friday", "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"],
    emoji: "📍",
    details: [
      "Mark the moment, make the plan, and be there when it all comes together.",
      "One date, one plan, and plenty to look forward to.",
      "Make room in your calendar for an experience worth showing up for.",
    ],
    ctas: ["Save the date.", "Who are you bringing along?", "See you there."],
    hashtags: ["#event", "#savethedate", "#liveevent", "#whatsOn", "#weekendplans", "#thingstodo"],
  },
  education: {
    keywords: ["course", "learn", "learning", "training", "student", "students", "class", "academy", "skill", "career", "education", "workshop", "certification"],
    emoji: "🎓",
    details: [
      "Build practical skills with a clear next step and knowledge you can actually use.",
      "Turn curiosity into capability with focused learning and hands-on progress.",
      "The right skill today can open a stronger opportunity tomorrow.",
    ],
    ctas: ["Ready to learn more?", "Save this for your next career step.", "Start building your skills."],
    hashtags: ["#learning", "#education", "#skills", "#career", "#training", "#growth"],
  },
  business: {
    keywords: ["business", "software", "website", "web", "developer", "development", "technology", "tech", "crm", "cms", "seo", "brand", "marketing", "product", "service"],
    emoji: "💡",
    details: [
      "Clear ideas become better results when the experience is simple, useful, and built with purpose.",
      "Focus on what creates value: a sharper experience, a smoother process, and a result people can use.",
      "Strong digital work is not just about looking better—it should work better too.",
    ],
    ctas: ["What would you improve first?", "Let’s turn the idea into something useful.", "Keep this in mind for your next project."],
    hashtags: ["#business", "#technology", "#digital", "#innovation", "#webdevelopment", "#growth"],
  },
  beauty: {
    keywords: ["beauty", "salon", "nails", "makeup", "hair", "style", "look", "glow", "skincare", "fashion"],
    emoji: "✨",
    details: [
      "A little detail can change the whole look—and the confidence that comes with it.",
      "Fresh details, polished style, and a look made to feel completely yours.",
      "Because the best finishing touch is the one that makes you feel your best.",
    ],
    ctas: ["Which look are you choosing?", "Save this for your next appointment.", "Ready for a fresh look?"],
    hashtags: ["#beauty", "#style", "#selfcare", "#glowup", "#beautytips", "#salon"],
  },
  travel: {
    keywords: ["travel", "trip", "holiday", "vacation", "hotel", "stay", "destination", "journey", "escape", "getaway"],
    emoji: "✈️",
    details: [
      "The next great memory might be closer than you think.",
      "New places, slower moments, and a change of view can make all the difference.",
      "Pack the plan, bring the right company, and make the journey part of the story.",
    ],
    ctas: ["Where are you heading next?", "Save this for your next getaway.", "Tag your travel partner."],
    hashtags: ["#travel", "#getaway", "#wanderlust", "#travelideas", "#holiday", "#explore"],
  },
  generic: {
    keywords: [],
    emoji: "✨",
    details: [
      "Keep the message clear, natural, and memorable.",
      "A simple idea can land better when it feels human and easy to act on.",
      "Make the moment count with a message that feels direct and genuine.",
    ],
    ctas: ["What do you think?", "Tell us your take.", "Share this with someone who’d appreciate it."],
    hashtags: ["#socialmedia", "#content", "#community", "#ideas", "#inspiration", "#creative"],
  },
};

function detectContext(value: string): ContextId {
  const text = cleanText(value).toLowerCase();
  let best: ContextId = "generic";
  let bestScore = 0;

  (Object.keys(CONTEXTS) as ContextId[]).forEach((id) => {
    if (id === "generic") return;
    const score = CONTEXTS[id].keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  });

  return best;
}

function toneLine(tone: string, context: ContextId): string {
  const lines: Record<string, string> = {
    casual: "Here’s the vibe:",
    witty: "Consider this your sign:",
    inspirational: "Make the moment count:",
    bold: context === "party" ? "Tonight, we go all in:" : "Make the move:",
    educational: "Here’s the useful part:",
    empathetic: "The little details matter:",
    persuasive: "Here’s a reason to act:",
    professional: "",
  };
  return lines[tone] ?? "";
}

function localCaptionVariants(args: {
  source: string;
  tone: string;
  platform?: string;
}): [string, string, string] {
  const source = sentence(args.source);
  const context = detectContext(source);
  const profile = CONTEXTS[context];
  const tone = args.tone.toLowerCase();
  const lead = toneLine(tone, context);
  const socialEmoji = ["instagram", "facebook", "threads"].includes(args.platform ?? "") ? ` ${profile.emoji}` : "";

  const first = `${source}${socialEmoji}\n\n${profile.details[0]}\n\n${profile.ctas[0]}`;
  const secondLead = lead ? `${lead} ` : "";
  const second = `${secondLead}${source}${socialEmoji}\n\n${profile.details[1]}\n\n${profile.ctas[1]}`;
  const third = `${profile.details[2]}\n\n${source}${socialEmoji}\n\n${profile.ctas[2]}`;

  return [first, second, third];
}

export function localCaptionText(args: {
  topic: string;
  tone: string;
  platform?: string;
  maxChars: number;
}): string {
  const parsed = stripTaskPrefix(args.topic);
  const base = cleanText(parsed.text);
  const context = detectContext(base);
  const profile = CONTEXTS[context];

  if (parsed.mode === "ideas") {
    const subject = sentence(base).replace(/[.!?…]+$/, "");
    const ideas = [
      `Idea 1 — Lead with “${subject}” and build the post around ${profile.details[0].charAt(0).toLowerCase()}${profile.details[0].slice(1)}`,
      `Idea 2 — Turn “${subject}” into a short visual post with one clear hook and the CTA: ${profile.ctas[1]}`,
      `Idea 3 — Create a people-first post around “${subject}” and finish with: ${profile.ctas[2]}`,
    ];
    return ideas.map((x) => clip(x, args.maxChars)).join("---CAPTION---");
  }

  const variants = localCaptionVariants({ source: base, tone: args.tone, platform: args.platform });
  return variants.map((x) => clip(x, args.maxChars)).join("---CAPTION---");
}

function hashtagify(value: string): string {
  const clean = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!clean) return "";
  return `#${clean.split(/\s+/).join("")}`;
}

export function localHashtags(topic: string, count: number, platform?: string): {
  broad: string[];
  niche: string[];
  micro: string[];
} {
  const parsed = stripTaskPrefix(topic);
  const cleanTopic = parsed.text;
  const context = detectContext(cleanTopic);
  const words = cleanText(cleanTopic)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const uniqueWords = Array.from(new Set(words)).slice(0, 8);
  const candidates = new Set<string>();

  CONTEXTS[context].hashtags.forEach((x) => candidates.add(x.toLowerCase()));
  for (const word of uniqueWords) candidates.add(hashtagify(word));
  for (let i = 0; i < uniqueWords.length - 1; i++) {
    candidates.add(hashtagify(`${uniqueWords[i]} ${uniqueWords[i + 1]}`));
  }

  const platformTags = platform === "linkedin"
    ? ["#professionaldevelopment", "#industryinsights", "#careergrowth"]
    : platform === "instagram"
      ? ["#instadaily", "#instagram", "#community"]
      : platform === "pinterest"
        ? ["#ideas", "#inspiration", "#howto"]
        : ["#socialmedia", "#content", "#community"];
  platformTags.forEach((x) => candidates.add(x));

  const all = Array.from(candidates).filter(Boolean).slice(0, count);
  const split1 = Math.ceil(all.length / 3);
  const split2 = Math.ceil((all.length * 2) / 3);
  return {
    broad: all.slice(0, split1),
    niche: all.slice(split1, split2),
    micro: all.slice(split2),
  };
}
