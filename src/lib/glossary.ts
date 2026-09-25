/**
 * Words an owner meets on HOA papers that the product keeps, because the
 * letters, meetings and state disclosures use them too. Each gets one plain
 * sentence, shown by `Term` when tapped. Renaming them would only hide the
 * word the owner will hear at the next meeting.
 */
export const GLOSSARY = {
  autopay: "Automatic payments. Your dues are paid from your bank or card on the day they are due.",
  ccrs: "The Covenants, Conditions and Restrictions: the rules every home here agreed to when it was bought.",
  reserves: "Savings for big repairs, like a new roof on the clubhouse or repaving the roads.",
  funded: "How much of the money needed for future repairs is already saved. Higher is better.",
  "special-assessment": "A one-time charge on top of your regular dues, usually for a large repair.",
  "business-days": "Monday to Friday, not counting holidays.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
