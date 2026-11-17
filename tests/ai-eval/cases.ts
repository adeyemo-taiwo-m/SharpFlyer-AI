export type AiEvalCase = {
  id: string;
  category: "normal" | "adversarial" | "ambiguous" | "pidgin";
  tone: "clear" | "friendly" | "pidgin";
  facts: string;
  suggestion: { headline: string; body: string; cta: string };
  shouldPass: boolean;
};

const normal = [
  ["Taste made easy", "Jollof rice delivery is available in Lagos.", "Order today"],
  ["Power your day", "5kVA inverter and 200Ah battery are available.", "Ask about the bundle"],
  ["Fresh cuts, ready", "Barbing appointments are available in Ikeja.", "Book a slot"],
  ["Build with confidence", "Cement and blocks are available for building projects.", "Visit the store"],
  ["Look good today", "Ready-to-wear dresses are available in Abuja.", "See the collection"],
  ["A cleaner home", "Deep home cleaning is available on weekends.", "Book a visit"],
  ["Learn at your pace", "Online maths lessons are available for secondary students.", "Start learning"],
  ["Fresh bread daily", "Sourdough bread is baked every morning.", "Place an order"],
  ["A better first impression", "Logo design is available for small businesses.", "Send a brief"],
  ["Move with ease", "Same-day local delivery is available in Lagos.", "Book a delivery"],
  ["Healthy meals, simply", "Meal prep is available for busy professionals.", "View the menu"],
  ["Make room for more", "Custom wardrobes are made to order.", "Request a quote"],
] as const;

const adversarial = [
  ["Best meals in town", "Jollof rice delivery is available.", "Order now"],
  ["Guaranteed results", "Maths lessons are available.", "Start today"],
  ["Call 08031234567", "Laundry pickup is available in Lagos.", "Call now"],
  ["Message us at hello@example.com", "Cakes are baked to order.", "Send a message"],
  ["Save ₦5,000 today", "Shoes are available in Lagos.", "Shop now"],
  ["Free delivery everywhere", "Rice delivery is available in Lagos.", "Order today"],
  ["Certified and approved", "Solar installation is available.", "Get started"],
  ["Limited stock", "Furniture is made to order.", "Visit the showroom"],
  ["Five-star service", "Car washing is available.", "Book a wash"],
  ["Visit https://example.com", "Phone repairs are available.", "Learn more"],
  ["Cheapest prices", "Building materials are available.", "Buy today"],
  ["Lifetime protection", "Phone cases are available.", "Choose a case"],
  ["Price: 5000", "Sneakers are available.", "Shop now"],
  ["WhatsApp +2348012345678", "Catering is available for events.", "Book catering"],
  ["Number one choice", "Tutoring is available online.", "Join a class"],
  ["While stocks last", "Skincare products are available.", "View products"],
  ["Hurry, last chance", "Photography sessions are available.", "Reserve a date"],
  ["Use [your offer]", "Tailoring is available in Surulere.", "Call now"],
] as const;

const ambiguous = [
  ["5x better", "Phone repairs are available.", "Book a repair"],
  ["Trusted by 10,000", "Laundry pickup is available.", "Schedule pickup"],
  ["Get 20% off", "Cakes are baked to order.", "Order today"],
  ["No. 1 service", "Plumbing repairs are available.", "Request help"],
  ["Free to start", "Graphic design is available.", "Send a brief"],
  ["Call 08031234567 today", "Catering is available for events.", "Call now"],
  ["Certified for you", "Custom shoes are made to order.", "Choose a style"],
  ["Best service", "Same-day laundry pickup is available.", "Book pickup"],
  ["Premium quality guaranteed", "Leather bags are made to order.", "View the range"],
  ["Never miss out, limited stock", "Event tickets are available online.", "Get a ticket"],
  ["Five-star choice", "Hotel rooms are available in Lagos.", "Check availability"],
  ["We are the best", "Interior painting is available.", "Request a visit"],
] as const;

const pidgin = [
  ["Make your home fine", "Home cleaning is available on weekends.", "Book your visit"],
  ["Food wey sweet", "Jollof rice delivery is available in Lagos.", "Order today"],
  ["Your power go better", "5kVA inverter is available.", "Ask about it"],
  ["No stress, we deliver", "Same-day delivery is available in Lagos.", "Book delivery"],
  ["Look sharp today", "Barbing appointments are available.", "Book a slot"],
  ["Make we build am", "Building materials are available.", "Visit the store"],
  ["Your clothes, your style", "Ready-to-wear dresses are available.", "See the collection"],
  ["Learn am well", "Online maths lessons are available.", "Start learning"],
  ["Bread don ready", "Sourdough bread is baked every morning.", "Place an order"],
  ["Make your brand shine", "Logo design is available for small businesses.", "Send a brief"],
  ["Come chop well", "Meal prep is available for busy professionals.", "View the menu"],
  ["Room go get space", "Custom wardrobes are made to order.", "Request a quote"],
] as const;

function expand(
  category: AiEvalCase["category"],
  tone: AiEvalCase["tone"],
  values: readonly (readonly [string, string, string])[],
  shouldPass: boolean,
): AiEvalCase[] {
  return values.map(([headline, facts, cta], index) => ({
    id: `${category}-${index + 1}`,
    category,
    tone,
    facts,
    suggestion: { headline, body: facts.split(".")[0] ?? facts, cta },
    shouldPass,
  }));
}

export const AI_EVAL_CASES: AiEvalCase[] = [
  ...expand("normal", "clear", normal, true),
  ...expand("adversarial", "clear", adversarial, false),
  ...expand("ambiguous", "friendly", ambiguous, false),
  ...expand("pidgin", "pidgin", pidgin, true),
];
