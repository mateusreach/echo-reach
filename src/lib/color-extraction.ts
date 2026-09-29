// Extração automática de cores a partir de imagens (logo/capa) e geração de
// sugestões de paleta. Roda inteiramente no navegador via Canvas — sem
// dependência externa. Pixels transparentes são ignorados (não contam como
// "cor branca"), cores muito semelhantes são agrupadas para não gerar 8
// tons quase idênticos, e o resultado final combina até duas fontes (logo +
// capa) sem duplicar.

export type ExtractedColor = { hex: string; source: "logo" | "capa"; weight: number };
export type PaletteSuggestion = { name: string; description: string; colors: { hex: string; source: "logo" | "capa" | "derivada" }[] };

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export function hexToHslString(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return `${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%`;
}

export function adjustLightness(hex: string, deltaL: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const nl = Math.min(96, Math.max(4, l + deltaL));
  const [nr, ng, nb] = hslToRgb(h, s, nl);
  return rgbToHex(nr, ng, nb);
}

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Amostra uma imagem e devolve as N cores predominantes, ignorando pixels
 * transparentes e agrupando tons muito próximos (evita "8 cinzas quase
 * iguais"). Frequência + saturação pesam na ordenação. */
async function extractFromImage(url: string, source: "logo" | "capa", maxColors = 6): Promise<ExtractedColor[]> {
  const img = await loadImage(url);
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, size, size);
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Bucketiza em passos de 24 (0-255) por canal — reduz milhares de tons a
  // um número administrável de "baldes" antes de contar frequência.
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue; // ignora transparência
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [, s, l] = rgbToHsl(r, g, b);
    if (l > 97 || l < 3) continue; // ignora quase-branco/quase-preto puro (fundo)
    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
    void s;
  }

  const candidates = Array.from(buckets.values())
    .map((b) => ({ r: b.r / b.count, g: b.g / b.count, b: b.b / b.count, count: b.count }))
    .sort((a, b) => b.count - a.count);

  const picked: { rgb: [number, number, number]; count: number }[] = [];
  for (const c of candidates) {
    const rgb: [number, number, number] = [c.r, c.g, c.b];
    if (picked.some((p) => colorDistance(p.rgb, rgb) < 34)) continue; // agrupa tons semelhantes
    picked.push({ rgb, count: c.count });
    if (picked.length >= maxColors) break;
  }

  const totalWeight = picked.reduce((s, p) => s + p.count, 0) || 1;
  return picked.map((p) => ({ hex: rgbToHex(...p.rgb), source, weight: p.count / totalWeight }));
}

/** Combina cores da logo e da capa (quando existirem), gera 3-4 sugestões
 * de paleta com variações reais derivadas dos mesmos ativos — não cores
 * aleatórias. */
export async function generatePaletteSuggestions(assets: { logoUrl?: string | null; coverUrl?: string | null }): Promise<PaletteSuggestion[]> {
  const [logoColors, coverColors] = await Promise.all([
    assets.logoUrl ? extractFromImage(assets.logoUrl, "logo", 5).catch(() => []) : Promise.resolve([]),
    assets.coverUrl ? extractFromImage(assets.coverUrl, "capa", 5).catch(() => []) : Promise.resolve([]),
  ]);

  const combined: ExtractedColor[] = [];
  for (const c of [...logoColors, ...coverColors]) {
    const rgb = hexToRgb(c.hex);
    if (combined.some((e) => colorDistance(hexToRgb(e.hex), rgb) < 30)) continue;
    combined.push(c);
  }
  combined.sort((a, b) => b.weight - a.weight);

  if (combined.length === 0) return [];

  const essential = combined.slice(0, 4);
  const sortedByContrast = [...combined].sort((a, b) => {
    const [, sa, la] = rgbToHsl(...hexToRgb(a.hex));
    const [, sb, lb] = rgbToHsl(...hexToRgb(b.hex));
    return sb * Math.abs(lb - 50) - sa * Math.abs(la - 50);
  });

  const suggestions: PaletteSuggestion[] = [
    {
      name: "Essencial",
      description: "Cores mais predominantes dos ativos enviados.",
      colors: essential.map((c) => ({ hex: c.hex, source: c.source })),
    },
    {
      name: "Contraste",
      description: "Cores principais organizadas por contraste visual.",
      colors: sortedByContrast.slice(0, 4).map((c) => ({ hex: c.hex, source: c.source })),
    },
    {
      name: "Suave",
      description: "Tons mais claros derivados da identidade.",
      colors: essential.map((c) => ({ hex: adjustLightness(c.hex, 22), source: "derivada" as const })),
    },
    {
      name: "Profunda",
      description: "Tons mais escuros e intensos derivados da identidade.",
      colors: essential.map((c) => ({ hex: adjustLightness(c.hex, -22), source: "derivada" as const })),
    },
  ];

  return suggestions.filter((s) => s.colors.length > 0);
}
