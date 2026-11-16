// Logos for the regulatory contacts CEDA lists; any authority an admin adds without one shows its initials
const LOGOS: [RegExp, string][] = [
  [/\bCIPA\b|Companies and Intellectual Property/i, '/logos/cipa.webp'],
  [/\bBURS\b|Unified Revenue/i, '/logos/burs.webp'],
  [/\bBOBS\b|Bureau of Standards/i, '/logos/bobs.webp'],
  [/\bBOCRA\b|Communications Regulatory/i, '/logos/bocra.webp'],
  [/\bLEA\b|Local Enterprise/i, '/logos/lea.webp'],
];

export const logoFor = (name: string) => LOGOS.find(([re]) => re.test(name))?.[1] ?? null;
export const initials = (name: string) => (name.match(/\(([A-Z]{2,6})\)/)?.[1] ?? name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4)).toUpperCase();
