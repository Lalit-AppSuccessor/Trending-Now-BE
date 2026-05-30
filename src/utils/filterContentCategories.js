import { NEWS_KEYWORDS } from "../constants/keywords.js";

const NEWS_SOURCES = [
  "aajtak",
  "newstak",
  "indiatoday",
  "thelallantop",
  "lallantop",
  "news18",
  "cnnnews18",
  "indiatv",
  "abp",
  "abpnews",
  "zeenews",
  "zeebharat",
  "timesnow",
  "timesnownavbharat",
  "republic",
  "republicbharat",
  "tv9",
  "ndtv",
  "hindustan times",
  "the indian express",
  "indian express",
  "the print",
  "the quint",
  "firstpost",
  "dna",
  "pti",
  "ani",
  "newslaundry",
  "opindia",
  "reuters",
  "associated press",
  "ap news",
  "bbc",
  "cnn",
  "fox news",
  "al jazeera",
];

const HARD_NEWS = [
  // Legal
  "fir",
  "court",
  "supreme court",
  "high court",
  "lawsuit",
  "legal",
  "legal action",
  "petition",
  "summons",
  "notice",
  "judge",
  "hearing",
  "verdict",
  "court order",
  "quashed fir",

  // Crime
  "police",
  "investigation",
  "under investigation",
  "crime branch",
  "cyber cell",
  "arrest",
  "detained",
  "custody",
  "bail",
  "chargesheet",
  "criminal proceedings",

  // Controversies
  "controversy",
  "controversial",
  "backlash",
  "boycott",
  "cancelled",
  "cancel culture",
  "scandal",
  "allegation",
  "allegedly",
  "accused",
  "called out",
  "slammed",
  "exposed",

  // Sensitive
  "death",
  "hospital",
  "accident",
  "injury",
  "fraud",
  "scam",
  "hack",
  "leaked",
  "leak",
  "threat",
  "attack",

  // Elvish
  "snake venom",
  "snake venom case",
  "wildlife protection act",
  "ndps",

  // Creator controversies
  "orry row",
  "influencer drama",
  "viral controversy",

  // Breaking
  "breaking news",
  "exclusive",
  "sunil pal",
  "Amitabh Bachchan",
  "powerfull",
  "roast",
  "unpredictable",
  "storm",
  "breaking",
  "internet",
  "indian news",
  "news media",
  "dominate",
  "intense",
  "drops",
  "silence",
  "stunned",
  "sarcastic",
  "humour",
];

const STRONG_NEWS = [
  "controversy",
  "fir",
  "court",
  "supreme court",
  "high court",
  "legal",
  "police",
  "investigation",
  "arrest",
  "backlash",
  "boycott",
  "scandal",
  "allegation",
  "accused",
  "lawsuit",
  "chargesheet",
  "crime branch",
  "cyber cell",
  "snake venom",
  "wildlife protection act",
  "ndps",
];

export function getCategory(item) {
  const text = [
    item.title,
    item.description,
    item.content,
    item.text,
    item.caption,
    ...(item.hashtags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const source = (item.source?.name || item.account || "").toLowerCase();

  // ============================================
  // 1. NEWS CHANNELS
  // ============================================

  if (NEWS_SOURCES.some((channel) => source.includes(channel))) {
    return "news";
  }

  // ============================================
  // 2. HARD NEWS
  // ============================================

  if (HARD_NEWS.some((keyword) => text.includes(keyword))) {
    return "news";
  }

  // ============================================
  // 3. STRICT NEWS MATCHING
  // Need multiple strong signals
  // ============================================

  let strongMatches = 0;

  for (const keyword of STRONG_NEWS) {
    if (text.includes(keyword)) {
      strongMatches++;
    }
  }

  if (strongMatches >= 2) {
    return "news";
  }

  // ============================================
  // 4. Generic NEWS keywords
  // Need many matches to qualify
  // ============================================

  let newsMatches = 0;

  for (const keyword of NEWS_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      newsMatches++;
    }
  }

  if (newsMatches >= 5) {
    return "news";
  }

  // ============================================
  // 5. Breaking flag
  // ============================================

  if (item.isBreaking === true) {
    return "news";
  }

  // ============================================
  // 6. Everything else = FUN
  // ============================================

  return "fun";
}
