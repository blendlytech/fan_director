import type { HardListKey } from '../../../shared/domain/hardList.ts'

/**
 * Hard-list rules, version 1 (doc 11 §5.3.3). Rules are data with tests, not
 * regular expressions scattered through the code.
 *
 * Every rule is contextual. A bare word such as "school", "sister", "18",
 * "sleep" or "dog" never blocks on its own: it needs a role, an age, a sexual
 * act or a request around it. This layer must never become a general
 * sexual-content filter; explicit content between consenting adults passes
 * (the creator's own "non-explicit" limit is a separate, creator-set check).
 *
 * Patterns run on the normalized text (see normalize.ts): lowercase letters
 * and digits separated by single spaces, apostrophes removed ("shes", "youre",
 * "friends wife"). `form: 'raw'` rules see punctuation, for money, links and
 * contact details.
 */

export const RULESET_VERSION = 'rules-v1'

export interface HardListRule {
  id: string
  key: HardListKey
  /** Neutral, at most 100 characters: the only thing an audit event keeps (§5.3.3). */
  subject: string
  /** For keys with more than one fan-facing line: which line this rule matches. */
  line?: number
  pattern: RegExp
  form?: 'norm' | 'raw'
  /** Phrases removed before matching, for known near-misses ("since high school"). */
  allow?: RegExp[]
  /** Only applies when the creator has fewer verified performers than this. */
  whenVerifiedPerformersBelow?: number
}

export interface LimitRule {
  id: string
  /** A creator-limit checklist key (doc 11 §5.3.4). */
  limitKey: string
  pattern: RegExp
  allow?: RegExp[]
}

/* ------------------------------- Vocabulary ------------------------------ */

const re = (source: string) => new RegExp(source)
const words = (list: string[]) => `(?:${list.join('|')})`

/** Ages under 18, as digits or words. Longer alternatives first. */
const AGE = words(['1[0-7]', '[1-9]', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'])
/** What may follow a small number without it being an age. */
const NOT_AGE = `(?!\\s+(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|seconds?|secs?|dollars?|bucks|usd|cents?|percent|am|pm|oclock|inch(?:es)?|in a (?:million|thousand|hundred)|cm|mm|ft|foot|feet|meters?|metres?|kg|kgs|lbs?|pounds?|stone|times|x|of|more|or|and|to|out|people|guys|girls|videos?|clips?|tickets?|years?\\s+(?:ago|in|now|later|since|together|married|older|younger|of)|kids?|children|sons?|daughters?)\\b)`
const SUBJECT_IS = words(['im', 'i am', 'shes', 'she is', 'hes', 'he is', 'youre', 'you are', 'theyre', 'they are', 'she was', 'he was', 'who is', 'whos', 'who was', 'turned', 'turning', 'aged', 'age of', 'age'])

/** Ways of asking someone to take on a role. */
const ROLE = words([
  'pretend(?:ing)? (?:to be|(?:that )?(?:youre|you are|im|i am|shes|she is|hes|he is|were|we are))',
  'role ?play(?:ing|s)?(?: (?:as|with))?',
  'play(?:ing|s)? (?:the )?(?:role of|part of)?',
  'act(?:ing|s)? (?:as|like)',
  'dress(?:ed|es|ing)? (?:up )?(?:as|like)',
  'cosplay(?:ing|s)?(?: as)?',
  '(?:you|u) (?:to )?be',
  '(?:youre|you are) (?:now )?',
  'as if (?:you were|youre|you are)',
])
/** Up to three filler words between the role verb and the role. */
const FILL = `(?:(?:my|your|a|an|the|his|her|our|their|some|sexy|naughty|hot|strict|cute|new|horny|bad|dirty|real|own|favorite|favourite)\\s+){0,3}`
const SUFFIX = words(['role ?play', 'role', 'fantasy', 'fantasies', 'scene', 'scenario', 'outfit', 'costume', 'uniform', 'cosplay', 'theme', 'vibe', 'storyline', 'story', 'kink', 'fetish'])

function role(nouns: string): string {
  return `\\b(?:${ROLE})\\s*${FILL}${nouns}\\b|\\b${nouns}\\s+${SUFFIX}\\b`
}

const RELATIVE = '(?:step ?)?(?:sister|sis|brother|bro|sibling|siblings|mom|mommy|mum|mother|dad|daddy|father|aunt|auntie|uncle|cousin|niece|nephew|daughter|son|grandma|granny|grandmother|grandpa|grandfather)'
const SCHOOL_ROLE = '(?:student|pupil|school ?girl|school ?boy|teacher|principal|headmaster|headmistress)'
const CARE_ROLE = '(?:babysitter|baby sitter|nanny|au pair|governess)'
const RELATION_ROLE = `(?:neighbou?r|neighbou?rs (?:wife|husband|girlfriend|boyfriend|partner)|stranger|(?:best )?friends (?:wife|girlfriend|gf|husband|boyfriend|bf|partner|mom|mum|mother|sister|fiancee?)|(?:boss|coworker|co worker|colleague|roommate|brother|bro|dad|teacher)s (?:wife|girlfriend|gf|husband|boyfriend|bf|partner)|someone elses (?:wife|girlfriend|husband|boyfriend|partner))`
const CHARACTERS = words([
  'harley quinn', 'wonder woman', 'princess peach', 'princess zelda', 'zelda', 'lara croft', 'elsa', 'hermione', 'black widow',
  'catwoman', 'supergirl', 'batgirl', 'poison ivy', 'jessica rabbit', 'sailor moon', 'tifa', 'aerith', 'd va', 'daenerys',
  'khaleesi', 'princess leia', 'jinx', 'ahri', 'tracer', 'bowsette', 'pikachu', 'spider ?(?:man|woman|gwen)', 'batman',
  'superman', 'yennefer', 'ciri', 'lady dimitrescu', 'samus', 'chun li', 'cammy', 'nico robin', 'nami', 'hinata', 'asuka',
  'zero two', 'marin kitagawa', 'makima', 'power from chainsaw man',
])
const MEDIA = '(?:anime|cartoon|video game|game|movie|film|comic|disney|marvel|dc|pokemon|star wars|manga|tv show|show|netflix)'
const CELEBRITIES = words([
  'taylor swift', 'billie eilish', 'ariana grande', 'kim kardashian', 'kylie jenner', 'scarlett johansson', 'emma watson',
  'margot robbie', 'sydney sweeney', 'selena gomez', 'beyonce', 'rihanna', 'megan fox', 'jennifer lawrence', 'gal gadot',
  'zendaya', 'dua lipa', 'sabrina carpenter', 'jenna ortega', 'emma stone',
])
const CHILD = words(['child', 'children', 'kid', 'kids', 'little girl', 'little boy', 'young girl', 'young boy', 'toddler', 'preteen', 'schoolkid'])
const SEX_VERB = words([
  'sex', 'sexual', 'fuck\\w*', 'screw\\w*', 'sleep\\w* with', 'hook\\w* up with', 'make out with', 'making out with', 'seduc\\w*',
  'bang\\w*', 'masturbat\\w*', 'jerk\\w* off', 'horny for', 'naked with', 'blowjob\\w*', 'in bed with',
])
const INCAPACITATED = words(['asleep', 'sleeping', 'unconscious', 'passed out', 'knocked out', 'out cold', 'drugged', 'blackout drunk', 'black out drunk', 'too drunk', 'wasted', 'incapacitated', 'comatose'])
const ANIMAL = words(['dog', 'dogs', 'horse', 'horses', 'pony', 'donkey', 'goat', 'pig', 'sheep', 'animal', 'animals', 'canine', 'stallion', 'cow', 'bull'])
const APPS = words(['venmo', 'cashapp', 'cash app', 'paypal', 'zelle', 'western union', 'moneygram', 'buymeacoffee', 'ko ?fi', '(?:amazon|throne) wish ?list', 'wish ?list link'])
/** Only a payment when it's used to pay: "I work in crypto" is fine. */
const PAY_WITH = '(?:pay|paying|send|sending|tip|tipping|transfer|buy|get)(?: \\w+){0,3}? (?:(?:in|via|with|through|by) )?(?:an? |some )?(?:amazon |steam |apple )?(?:bitcoin|btc|crypto|ethereum|usdt|gift ?cards?|giftcards?)'
const CONTACT = words(['snap', 'snapchat', 'whatsapp', 'telegram', 'kik', 'insta', 'instagram', 'ig', 'discord', 'signal', 'number', 'phone number', 'cell', 'email', 'e mail'])
const EXTRA_PERSON = words(['friend', 'friends', 'girl', 'girls', 'guy', 'guys', 'man', 'men', 'woman', 'women', 'model', 'models', 'person', 'people', 'roommate', 'roommates', 'girlfriend', 'boyfriend', 'bestie', 'bff', 'stranger', 'strangers', 'performer', 'performers', 'actor', 'actors', 'actress', 'coworker', 'coworkers', 'sister', 'brother'])

/* --------------------------------- Rules --------------------------------- */

export const HARD_LIST_RULES: HardListRule[] = [
  // --- minors: checked first, because a hit opens a safety case -----------
  {
    id: 'minors.stated_age',
    key: 'minors',
    subject: 'age stated under 18',
    pattern: re(`\\b${SUBJECT_IS}\\s+(?:only\\s+|just\\s+|barely\\s+)?${AGE}\\b${NOT_AGE}`),
  },
  {
    id: 'minors.age_years_old',
    key: 'minors',
    subject: 'age stated under 18',
    pattern: re(`\\b${AGE}\\s*(?:yo|y o|yrs? old|years? old|year old|yr old)\\b`),
  },
  {
    id: 'minors.under_18',
    key: 'minors',
    subject: 'under 18 or a minor',
    pattern: re('\\b(?:under ?(?:age|18|eighteen)|underage|not (?:yet )?(?:18|eighteen)(?: yet)?|almost (?:18|eighteen)|nearly (?:18|eighteen)|below (?:18|eighteen)|younger than (?:18|eighteen)|minor|minors)\\b'),
    allow: [re('\\bminor (?:detail|details|change|changes|thing|things|issue|issues|edit|edits|tweak|tweaks|adjustment|adjustments|key|chord|point|points|role|part)\\b'), re('\\bin a minor way\\b')],
  },
  {
    id: 'minors.teen_terms',
    key: 'minors',
    subject: 'teen or underage reference',
    pattern: re('\\b(?:teen|teens|teenage|teenager|teenagers|tween|tweens|preteen|pre teen|jailbait|barely legal|lolita|loli|lolis|shota|shotacon|lolicon|pedo|pedophile|paedo)\\b'),
    allow: [
      re('\\b(?:my|his|her|our) (?:late |early |mid )?teen(?:s|age years|ager years| years)\\b'),
      re('\\b(?:since|when) (?:i was )?(?:a )?teen(?:ager)?\\b'),
      re('\\bas a teen(?:ager)?\\b'),
    ],
  },
  {
    id: 'minors.school_grade',
    key: 'minors',
    subject: 'school grade',
    pattern: re('\\b(?:(?:[1-9]|1[0-2])(?:st|nd|rd|th)? grade(?:r|rs)?|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) grade(?:r|rs)?|middle school(?:er|ers)?|junior high|high schooler|high schoolers|grade schooler|elementary school(?:er)?|primary school(?:er)?|kindergarten|(?:freshman|sophomore) in high school)\\b'),
    allow: [re('\\bsince (?:middle|high|junior high|grade|elementary|primary) school\\b'), re('\\bsince kindergarten\\b')],
  },
  {
    id: 'minors.childlike',
    key: 'minors',
    subject: 'childlike framing',
    pattern: re(`\\b(?:childlike|child like|kiddie|age ?play|age regression|ddlg|abdl|little ?space|baby talk)\\b|\\b(?:act|acting|behave|behaving|talk|talking|speak|speaking|sound|sounding|look|looking|looks|dress|dressed|pose|posing|play|playing|pretend|pretending)\\s+(?:\\w+\\s+){0,2}(?:like|as)\\s+(?:a |an )?(?:little |young |small )?(?:child|kid|toddler|baby|little girl|little boy|minor|teen|teenager|preteen)\\b`),
  },
  {
    id: 'minors.childlike_role',
    key: 'minors',
    subject: 'childlike role',
    pattern: re(`${role(`(?:${CHILD}|innocent (?:little )?girl|little one)`)}|\\b(?:${CHILD})\\s+(?:voice|clothes|pajamas|pyjamas)\\b`),
  },
  {
    id: 'minors.looks_underage',
    key: 'minors',
    subject: 'looking under 18',
    pattern: re(`\\b(?:look|looks|looking|appear|appears|seem|seems|pass|passes) (?:like )?(?:a )?(?:much )?(?:younger than (?:18|eighteen)|underage|under ?age|${AGE}\\b(?! (?:minutes?|mins?|hours?|days?|weeks?|months?|years? (?:older|younger)))|like a (?:child|kid|minor|teen|teenager))`),
  },

  // --- prohibited_roles (line 0: school, babysitter, family; line 1: partner, named character)
  { id: 'roles.family', key: 'prohibited_roles', line: 0, subject: 'family role', pattern: re(role(RELATIVE)) },
  { id: 'roles.step_family', key: 'prohibited_roles', line: 0, subject: 'step-family role', pattern: re(`\\bstep ?(?:sister|sis|brother|bro|sibling|mom|mommy|mum|mother|dad|daddy|father|daughter|son)\\s+(?:and|with|x|\\w+ with)\\b|\\b(?:family|step ?family)\\s+(?:role ?play|fantasy|taboo|scene|porn)\\b|\\btaboo (?:family|step)\\b`) },
  { id: 'roles.school', key: 'prohibited_roles', line: 0, subject: 'school role', pattern: re(`${role(SCHOOL_ROLE)}|\\b(?:school ?girl|school ?boy|school uniform|school outfit)\\b|\\b(?:teacher|professor|principal|tutor) (?:and|x|with) (?:a |her |his |the )?(?:student|pupil)\\b|\\b(?:student|pupil) (?:and|x|with) (?:a |her |his |the )?(?:teacher|professor|principal|tutor)\\b|\\bdetention (?:scene|fantasy|role ?play)\\b`) },
  { id: 'roles.school_setting', key: 'prohibited_roles', line: 0, subject: 'school setting', pattern: re('\\b(?:set|(?:film|shoot|record) (?:it|this|that|the video|the scene|us|me)|filmed|shot|scene|video|recorded|take place|takes place)(?: \\w+){0,3}? (?:in|at) (?:a |the )?(?:school|classroom|high school|middle school)\\b|\\b(?:school|classroom) (?:setting|scene|role ?play|fantasy|theme|set)\\b') },
  { id: 'roles.carer', key: 'prohibited_roles', line: 0, subject: 'babysitter or nanny role', pattern: re(role(CARE_ROLE)) },
  { id: 'roles.relationship', key: 'prohibited_roles', line: 1, subject: 'relationship role other than themselves', pattern: re(`${role(RELATION_ROLE)}|\\b(?:cheating|affair) (?:with )?(?:the |my |your )?(?:neighbou?r|friends (?:wife|husband|girlfriend|boyfriend))\\b`) },
  { id: 'roles.named_character', key: 'prohibited_roles', line: 1, subject: 'named media character', pattern: re(`${role(`(?:${CHARACTERS})`)}|\\b${CHARACTERS}\\s+(?:cosplay|costume|outfit|role ?play|fantasy)\\b|\\b(?:${ROLE})\\s*${FILL}(?:\\w+ ){0,2}(?:character|princess|heroine|villain|waifu) from (?:a |an |the |my |your )?(?:favou?rite )?(?:\\w+ )?${MEDIA}\\b|${role(`${MEDIA} (?:character|princess|heroine|hero|villain|girl|waifu)`)}`) },

  // --- incest ---------------------------------------------------------------
  { id: 'incest.term', key: 'incest', subject: 'sex between relatives', pattern: re('\\bincest\\w*\\b') },
  { id: 'incest.act', key: 'incest', subject: 'sex between relatives', pattern: re(`\\b${SEX_VERB}\\b(?:\\s+\\w+){0,3}?\\s+(?:my|his|her|your|their|our) (?:own )?${RELATIVE}\\b|\\b${RELATIVE}\\s+(?:sex|porn|fuck\\w*|hookup|hook up)\\b|\\b(?:brother|sister|mother|father|mom|dad|son|daughter|cousin)s? (?:and|x) (?:sister|brother|son|daughter|mother|father|mom|dad|cousin)s? (?:having sex|fuck\\w*|hook\\w* up|making out|in bed)\\b`) },

  // --- non_consent ------------------------------------------------------------
  { id: 'consent.term', key: 'non_consent', subject: 'non-consent', pattern: re('\\b(?:rape|raped|raping|rapes|rapist|rapey|noncon|non con|non consent|non consensual|nonconsensual|cnc|consensual non consent|forced sex|force sex|forced to have sex|somnophilia|somno)\\b') },
  { id: 'consent.will', key: 'non_consent', subject: 'without consent', pattern: re('\\b(?:against (?:her|his|my|your|their) will|without (?:her|his|my|your|their) consent|without (?:her|him|me|you|them) knowing)\\b') },
  { id: 'consent.incapacitated', key: 'non_consent', subject: 'someone unable to consent', pattern: re(`\\b(?:sex|fuck\\w*|touch\\w*|grop\\w*|undress\\w*|strip\\w*|use|using|take advantage|have (?:your|my|his|her) way|finger\\w*|kiss\\w*|feel\\w* up|molest\\w*|play with)\\b(?:\\s+\\w+){0,6}?\\s+(?:while|when|as) (?:shes |she is |hes |he is |im |i am |youre |you are |theyre |they are |she |he |i |you )?${INCAPACITATED}\\b|\\b${INCAPACITATED} (?:girl|woman|guy|man|wife|girlfriend|her|him|me) (?:sex|fuck\\w*|gets? (?:used|fucked|touched))\\b|\\bpretend(?:ing)? (?:to be|(?:that )?(?:youre|you are|im|i am|shes|she is|hes|he is)) (?:${INCAPACITATED}|drunk|tipsy|high)\\b`) },
  { id: 'consent.coercion', key: 'non_consent', subject: 'coercion, blackmail or drugging', pattern: re('\\b(?:blackmail\\w*|coerc\\w+|roofie\\w*|spike\\w* (?:her|his|my|your) drink|drug\\w* (?:her|him|me|you)|take advantage of (?:her|him|me|you))\\b') },
  { id: 'consent.refusal', key: 'non_consent', subject: 'refusal ignored', pattern: re('\\b(?:says?|said|saying|screams?|screaming|begs?|begging) no\\b(?:\\s+\\w+){0,4}?\\s+(?:but|anyway|and (?:he|i|you) (?:keeps?|continues?|doesnt stop))\\b|\\b(?:doesnt|does not|didnt|dont|do not) (?:want it|want to|consent)\\b(?:\\s+\\w+){0,4}?\\s+(?:but|anyway)\\b|\\bno means yes\\b|\\bforce\\w* (?:her|him|me|you|them) (?:to (?:have sex|fuck|suck|strip|undress)|into (?:sex|bed))\\b|\\bforce (?:yourself|himself|herself) on\\b') },

  // --- bestiality -----------------------------------------------------------
  { id: 'animals.term', key: 'bestiality', subject: 'animals', pattern: re('\\b(?:bestiality|beastiality|zoophilia|zoophile)\\b') },
  { id: 'animals.act', key: 'bestiality', subject: 'animals', pattern: re(`\\b(?:sex|fuck\\w*|mount\\w*|mating|knot\\w*|hump\\w*|breed\\w*|penetrat\\w*)\\b(?:\\s+\\w+){0,4}?\\s+(?:with )?(?:a |an |the |my |her |his |your |some )?${ANIMAL}\\b|\\b${ANIMAL}\\s+(?:sex|porn|cock|dick|knot|knotting|fucks?|fucking|mounts?|mounting)\\b|\\bsex with (?:an? )?${ANIMAL}\\b`) },

  // --- real_third_parties ---------------------------------------------------
  { id: 'third.deepfake', key: 'real_third_parties', subject: 'impersonation, lookalike or deepfake', pattern: re('\\b(?:deep ?fake\\w*|face ?swap\\w*|faceswap\\w*|impersonat\\w+|look ?alike|lookalike|body double)\\b') },
  { id: 'third.known_person', key: 'real_third_parties', subject: 'real person other than the participants', pattern: re(`\\b(?:${ROLE})\\s*(?:my|your|our)\\s+(?:ex|ex wife|ex girlfriend|ex boyfriend|ex husband|boss|manager|coworker|co worker|colleague|landlord|crush|therapist)\\b|\\b${SEX_VERB}\\b(?:\\s+\\w+){0,3}?\\s+(?:my|your|his|her) (?:ex|boss|coworker|co worker|colleague|neighbou?r|roommate|friend|best friend|crush|landlord|teacher|therapist)\\b`) },
  { id: 'third.celebrity', key: 'real_third_parties', subject: 'celebrity or public figure', pattern: re(`${role(CELEBRITIES)}|\\b${CELEBRITIES}\\s+(?:lookalike|look alike|impression|sex|nude|naked)\\b|\\b(?:sex|fuck\\w*|naked|nude)\\b(?:\\s+\\w+){0,3}?\\s+(?:with )?${CELEBRITIES}\\b`) },

  // --- unverified_performers ------------------------------------------------
  { id: 'performers.group', key: 'unverified_performers', subject: 'more performers than are verified', whenVerifiedPerformersBelow: 2, pattern: re('\\b(?:threesome|3some|foursome|4some|group sex|gangbang|gang bang|orgy|mmf|ffm|mfm|fmf|double team\\w*)\\b') },
  { id: 'performers.extra_person', key: 'unverified_performers', subject: 'additional unverified person on camera', pattern: re(`\\b(?:bring|brings|bringing|invite|invites|inviting|add|adding|include|including|get|getting|film with|filming with|shoot with)\\s+(?:in )?(?:a|an|another|your|some|a second|two|2|three|3|a few|other|random)\\s+(?:other |hot |random |second )?${EXTRA_PERSON}\\b|\\b(?:your|a|another) (?:friend|friends|roommate|bestie|bff|sister|coworker|girlfriend|boyfriend) (?:joins?|joining|to join|could join|can join|should join|in the video|on camera|on cam)\\b|\\b(?:someone|somebody|anyone) else (?:on camera|on cam|in the video|joins?|to join)\\b`) },

  // --- solicitation ---------------------------------------------------------
  { id: 'solicit.meet', key: 'solicitation', subject: 'meeting in person', pattern: re('\\b(?:(?:can|could|would|will|should) (?:we|i) meet|lets meet|meet (?:up|in person|irl|in real life|offline|face to face|for real)|meet me (?:at|in|tonight|after|somewhere)|(?:see|visit) you in person|come (?:over )?to my (?:place|house|hotel|apartment|room|flat)|hotel room|incall|outcall|escort\\w*|full service|in person session|private meeting)\\b') },
  { id: 'solicit.paid_sex', key: 'solicitation', subject: 'paying for sex off camera', pattern: re('\\b(?:pay (?:you )?(?:for sex|to (?:meet|see you|sleep with|have sex))|(?:sex|sleep with|hook up|fuck) (?:with )?(?:me|you) (?:in person|irl|for real|for money))\\b') },
  { id: 'solicit.payment_app', key: 'solicitation', subject: 'payment outside checkout', pattern: re(`\\b${APPS}\\b|\\b${PAY_WITH}\\b|\\b(?:pay|paying) (?:you )?(?:an? )?(?:extra )?\\d+`) },
  { id: 'solicit.payment_raw', key: 'solicitation', subject: 'payment outside checkout', form: 'raw', pattern: re('(?:pay|send|tip|transfer|wire|give)\\s+(?:you\\s+)?(?:an?\\s+)?(?:extra\\s+)?\\$\\s?\\d|paypal\\.me|venmo\\.com|cash\\.app|ko-fi\\.com|throne\\.com|buymeacoffee\\.com|amazon\\.[a-z.]+/(?:hz/)?wishlist') },
  { id: 'solicit.contact', key: 'solicitation', subject: 'contact details', pattern: re(`\\bmy ${CONTACT} (?:is|handle is)\\b|\\b(?:add|text|message|dm|call|reach|contact|find) me (?:on|at|via) (?:${CONTACT}|my number)\\b|\\b(?:your|ur) (?:${CONTACT}|address|home address|real name|location)\\b`) },
  { id: 'solicit.contact_raw', key: 'solicitation', subject: 'contact details', form: 'raw', pattern: re('[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}|(?:\\+?\\d[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b') },

  // --- illegal_acts -----------------------------------------------------------
  { id: 'illegal.drugs', key: 'illegal_acts', subject: 'illegal drug use', pattern: re('\\b(?:do|doing|snort|snorting|sniff|sniffing|smoke|smoking|shoot|shooting|inject|injecting|take|taking|on|high on)\\s+(?:some\\s+)?(?:coke|cocaine|crack|meth|heroin|fentanyl|ketamine|lines|molly|mdma|ecstasy|lsd|acid|shrooms|pcp|crystal meth)\\b|\\blines? of (?:coke|cocaine)\\b') },
  { id: 'illegal.injury', key: 'illegal_acts', subject: 'serious injury', pattern: re('\\b(?:choke|choking|strangle|strangling)\\s+(?:me|her|him|you)\\s+(?:until|till|til)\\s+(?:i|she|he|you)\\s+(?:pass|passes)\\s+out\\b|\\b(?:break|breaking|broken)\\s+(?:my|her|his|your)\\s+(?:bones?|arm|leg|nose|ribs?|jaw)\\b|\\b(?:stab|stabbing)\\s+(?:me|her|him|you|myself|yourself)\\b|\\b(?:burn|burning|brand|branding)\\s+(?:me|her|him|you|myself|yourself)\\s+with\\b|\\bcut\\w*\\s+(?:me|her|him|you|myself|yourself)\\s+(?:with a (?:knife|blade|razor)|until)\\b|\\buntil (?:i|you|she|he) (?:bleeds?|pass out|passes out)\\b') },
  { id: 'illegal.public', key: 'illegal_acts', subject: 'public indecency', pattern: re('\\b(?:naked|nude|sex|masturbat\\w*|flash\\w*)\\s+(?:in|at)\\s+(?:public|a park|the park|the street|a store|the mall|a restaurant|a playground)\\b|\\bpublic (?:sex|nudity|indecency)\\b|\\bin public (?:naked|nude)\\b') },
  { id: 'illegal.voyeur', key: 'illegal_acts', subject: 'secret filming', pattern: re('\\b(?:hidden|secret|spy) ?(?:camera|cam)\\b|\\bfilm\\w*(?:\\s+\\w+){0,2}\\s+without\\s+(?:them|her|him|their|his)\\s+(?:knowing|consent|permission)\\b') },
  { id: 'illegal.other', key: 'illegal_acts', subject: 'other crime', pattern: re('\\b(?:drunk driving|drive drunk|driving drunk|shoplift\\w*|rob (?:a|the) (?:bank|store|shop)|revenge porn)\\b') },

  // --- hate_harassment --------------------------------------------------------
  { id: 'hate.slur', key: 'hate_harassment', subject: 'slur', pattern: re('\\b(?:nigg(?:er|ers|a|as|ah|az)|fagg?ots?|kikes?|spics?|trann(?:y|ies)|retards?|retarded|wetbacks?|towelheads?)\\b') },
  { id: 'hate.threat', key: 'hate_harassment', subject: 'threat or harassment', pattern: re('\\b(?:i will|ill|i am going to|im going to|im gonna|i gonna|i am gonna) (?:find|hurt|kill|stalk|dox|doxx|expose|ruin) you\\b|\\bi know where you live\\b|\\bkill yourself\\b|\\bkys\\b|\\byou (?:should|deserve to) die\\b') },
  { id: 'hate.group', key: 'hate_harassment', subject: 'hate speech', pattern: re('\\b(?:all |the )?(?:jews|muslims|blacks|gays|lesbians|immigrants|mexicans|christians|trans people|asians|arabs|women)\\s+(?:are|should|must|deserve to)\\s+(?:vermin|animals|die|be killed|be gassed|subhuman|inferior|be deported|be exterminated)\\b|\\bgas the jews\\b|\\b(?:heil hitler|sieg heil|1488|white power)\\b') },
]

/**
 * Childlike always means `minors` (§5.3.3): a `prohibited_roles` hit whose text
 * also mentions a child is escalated, so the safety-case path opens.
 */
export const CHILD_PATTERN = re(`\\b(?:${CHILD}|childlike|child like)\\b`)

/**
 * Creator-limit checklist rules (§5.3.4). A hit adds a flag (ask_me) or
 * blocks (hard_no), depending on the creator's setting. Custom free-text
 * limits can't be matched by rules; the Phase 3 classifier covers them.
 */
export const LIMIT_RULES: LimitRule[] = [
  {
    id: 'limit.explicit',
    limitKey: 'non_explicit_only',
    pattern: re('\\b(?:sex|sexual|sexually|naked|nude|nudes|nudity|topless|bottomless|porn|porno|pornographic|explicit|xxx|nsfw|orgasm\\w*|cum|cumming|masturbat\\w*|jerk\\w* off|blowjob\\w*|handjob\\w*|fuck\\w*|dick|dicks|cock|cocks|pussy|tits|titties|boobs|nipples?|anal|penetrat\\w*|genital\\w*|strip\\w* (?:naked|down|for me|off)|striptease|lap dance|bdsm|bondage|spank\\w*|horny|erotic|steamy|intimate acts?)\\b'),
  },
  {
    id: 'limit.political',
    limitKey: 'no_political_content',
    pattern: re('\\b(?:politic\\w*|election\\w*|vote|voting|voters?|ballot|campaign\\w*|democrats?|democratic party|republicans?|gop|maga|liberals?|conservatives?|leftists?|right wing|left wing|trump|biden|kamala|obama|putin|zelensky|netanyahu|congress|senators?|senate|parliament|prime minister|abortion|pro life|pro choice|gun control|immigration|israel|palestin\\w*|gaza|ukraine|brexit)\\b'),
  },
  {
    id: 'limit.brands',
    limitKey: 'no_brand_mentions',
    pattern: re('\\b(?:brand|brands|branded|sponsor\\w*|advert\\w*|advertis\\w*|promo|product placement|endorse\\w*|nike|adidas|puma|gucci|prada|chanel|louis vuitton|versace|balenciaga|coca cola|pepsi|red bull|monster energy|starbucks|mcdonalds|burger king|iphone|samsung|tesla|budweiser|heineken)\\b|\\b(?:promote|promoting|mention|shout ?out (?:to|for)|advertise|plug|feature|show)\\s+(?:\\w+\\s+){0,2}my\\s+(?:business|company|shop|store|brand|startup|podcast|channel|product|app|website|page)\\b'),
  },
]
