import type { FlyerContent } from "../../src/schemas/flyer";

function svgAsset(background: string, foreground: string, label: string, width = 800, height = 600): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="48" fill="${background}"/><circle cx="${width / 2}" cy="${height * 0.42}" r="${Math.min(width, height) * 0.25}" fill="${foreground}"/><path d="M${width / 2} ${height * 0.16}v${height * 0.52}M${width * 0.24} ${height * 0.42}h${width * 0.52}" stroke="${background}" stroke-width="${Math.max(12, Math.min(width, height) * 0.05)}" stroke-linecap="round"/><text x="${width / 2}" y="${height * 0.88}" text-anchor="middle" font-family="Arial" font-size="${Math.max(18, Math.min(width, height) * 0.07)}" fill="${foreground}">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const transparentLogoUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="160" viewBox="0 0 480 160"><circle cx="80" cy="80" r="58" fill="#FFB800"/><path d="M80 35v90M35 80h90" stroke="#0B1F3A" stroke-width="12" stroke-linecap="round"/><text x="165" y="103" font-family="Arial" font-size="72" font-weight="700" fill="#FFFFFF">BP</text></svg>')}`;

export const FIXTURES: Record<string, Omit<FlyerContent, "format">> = {
  short: {
    headline: "Solar sale",
    price: 500000,
    phone: "+2348031234567",
    businessName: "Sun Co",
    themeId: "navy-gold",
    currency: "NGN",
    productImageAssetIds: [],
  },
  normal: {
    headline: "5kVA inverter and battery package",
    body: "Reliable backup power for your home and business.",
    price: 85000000,
    oldPrice: 95000000,
    phone: "+2348031234567",
    businessName: "BrightPower Solutions",
    address: "12 Energy Way, Lagos",
    logoAssetId: "logo",
    productImageAssetIds: ["product-1"],
    themeId: "navy-gold",
    currency: "NGN",
  },
  long: {
    headline: "Complete solar inverter and lithium battery solution for daily power",
    body: "Cut generator costs with a professionally installed system built for homes, shops, offices, and growing businesses.",
    price: 125000000,
    oldPrice: 145000000,
    phone: "+2348031234567",
    businessName: "BrightPower Renewable Energy Systems",
    address: "Plot 24 Independence Avenue, Victoria Island, Lagos",
    logoAssetId: "logo",
    productImageAssetIds: ["product-1"],
    themeId: "ink-cyan",
    currency: "NGN",
  },
  extreme: {
    headline: "PremiumSolarInverterBatteryPackageReliablePowerSystems2026",
    body: "A clean-energy upgrade for customers who need quiet, dependable power throughout the day and night.",
    price: 1250000000,
    oldPrice: 1500000000,
    phone: "+2348031234567",
    businessName: "BrightPowerSolarAndInverterTechnologiesLimitedCompanyNetwork",
    address: "Warehouse 7, Energy Market, Airport Road",
    logoAssetId: "logo",
    productImageAssetIds: ["product-1"],
    themeId: "ink-cyan",
    currency: "NGN",
  },
};

export const FIXTURE_ASSETS = {
  logoUrl: svgAsset("#0B1F3A", "#FFB800", "BP"),
  productImageUrls: [svgAsset("#183B66", "#57D3D0", "POWER")],
  transparentLogoUrl,
  smallProductImageUrl: svgAsset("#183B66", "#57D3D0", "SMALL", 120, 90),
  wideProductImageUrl: svgAsset("#183B66", "#57D3D0", "WIDE", 1600, 320),
};

export function fixtureContent(name: string, format: FlyerContent["format"]): FlyerContent {
  const fixture = FIXTURES[name];
  if (!fixture) throw new Error(`Unknown fixture: ${name}`);
  return { ...fixture, format };
}
