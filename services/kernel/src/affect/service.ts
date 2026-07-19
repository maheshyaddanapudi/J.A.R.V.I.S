/**
 * Affect layer (D-0072) — emotional attunement, the SAFE way. J.A.R.V.I.S. reads
 * tone/stress from the user's OWN WORDS (never biometrics/camera/mic-affect),
 * fully LOCAL and DETERMINISTIC (transparent lexical signals, no opaque ML), to
 * modulate ONLY its reply tone. Hard constraints (privacy envelope, D-0019/D-0072):
 *   • off by default (`affect.enabled`);
 *   • never a gate — it only nudges tone, never what J.A.R.V.I.S. is willing to do;
 *   • never a stored judgment about the person — inference is PER-TURN + ephemeral;
 *   • transparent — every reading surfaces WHICH signals fired.
 */
export type Tone = "neutral" | "rushed" | "stressed" | "warm" | "frustrated";

export interface AffectReading {
  tone: Tone;
  /** 0..1 how strongly the signals point away from neutral */
  intensity: number;
  /** the exact signals that fired — this is the transparency contract */
  signals: string[];
  /** the one-line tone guidance injected into the system prompt (never a gate) */
  guidance: string;
}

const URGENCY = /\b(asap|urgent|now|immediately|right now|hurry|quick(?:ly)?|deadline|late|behind)\b/i;
const TIME_PRESSURE = /\b(in \d+ (?:min|minutes|hours?)|by (?:today|tonight|tomorrow|\d)|running out of time)\b/i;
const FRUSTRATION = /\b(ugh|why (?:is|isn'?t|won'?t|can'?t)|still (?:not|broken)|again\b|come on|seriously|frustrat|annoy|stupid|useless|hate this|not working)\b/i;
const NEGATION_STRESS = /\b(can'?t|won'?t|doesn'?t work|failed|error|stuck|broken|wrong)\b/i;
const GRATITUDE = /\b(thank(?:s| you)|appreciate|grateful|brilliant|perfect|love (?:it|this)|amazing|well done|great job)\b/i;

/** Infer affect from a single user message. Pure + deterministic + explainable. */
export function inferAffect(text: string): AffectReading {
  const signals: string[] = [];
  const t = text.trim();
  const letters = t.replace(/[^a-zA-Z]/g, "");
  const capsRatio = letters ? letters.replace(/[^A-Z]/g, "").length / letters.length : 0;
  const exclaims = (t.match(/!/g) ?? []).length;
  const words = t.split(/\s+/).filter(Boolean).length;

  if (capsRatio > 0.6 && letters.length >= 6) signals.push("shouting (mostly caps)");
  if (exclaims >= 2) signals.push(`${exclaims} exclamation marks`);
  if (URGENCY.test(t)) signals.push("urgency words");
  if (TIME_PRESSURE.test(t)) signals.push("time pressure");
  if (FRUSTRATION.test(t)) signals.push("frustration cues");
  if (NEGATION_STRESS.test(t)) signals.push("something's not working");
  const warm = GRATITUDE.test(t);
  // "clipped/terse" is a MILD stress hint — never count a short thank-you as terse.
  if (words > 0 && words <= 3 && exclaims === 0 && !warm && /[.?]$/.test(t) === false) signals.push("clipped/terse");
  if (warm) signals.push("warmth/gratitude");

  // decide tone from the signal mix (frustration > stress > rushed > warm > neutral)
  let tone: Tone = "neutral";
  const stressN = signals.filter((s) => /caps|exclamation|not working|frustration/.test(s)).length;
  if (signals.some((s) => s.includes("frustration"))) tone = "frustrated";
  else if (stressN >= 2 || signals.includes("shouting (mostly caps)")) tone = "stressed";
  else if (signals.includes("urgency words") || signals.includes("time pressure")) tone = "rushed";
  else if (warm) tone = "warm";

  const intensity = Math.min(1, signals.filter((s) => s !== "warmth/gratitude").length / 3);
  const guidance = {
    frustrated: "The user sounds frustrated — acknowledge it briefly, stay calm and solution-focused, no fluff.",
    stressed: "The user seems under stress — be concise, steady, and reassuring; lead with the answer.",
    rushed: "The user is in a hurry — be brief and direct; put the key point first.",
    warm: "The user is appreciative — a touch of warmth in reply is fitting; stay composed.",
    neutral: "",
  }[tone];

  return { tone, intensity: Number(intensity.toFixed(2)), signals, guidance };
}
