export interface SymbolDef {
  name: string;
  imageUrl: string; // SVG data URI
}

/** 10 built-in default symbols as colored SVG data URIs */
const DEFAULT_SYMBOLS: SymbolDef[] = [
  { name: 'star',      imageUrl: buildSvg('★', '#FFD700') },
  { name: 'heart',     imageUrl: buildSvg('♥', '#FF4466') },
  { name: 'diamond',   imageUrl: buildSvg('◆', '#44AAFF') },
  { name: 'circle',    imageUrl: buildSvg('●', '#44FF44') },
  { name: 'moon',      imageUrl: buildSvg('☽', '#CCAAFF') },
  { name: 'lightning', imageUrl: buildSvg('⚡', '#FFAA00') },
  { name: 'flower',    imageUrl: buildSvg('✿', '#FF88CC') },
  { name: 'crown',     imageUrl: buildSvg('♛', '#FFD700') },
  { name: 'flame',     imageUrl: buildSvg('🔥', '#FF6622') },
  { name: 'music',     imageUrl: buildSvg('♫', '#88DDFF') },
];

function buildSvg(char: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <rect width="240" height="240" fill="#1a1a2e" rx="16"/>
    <text x="120" y="140" font-size="120" text-anchor="middle" fill="${color}" font-family="sans-serif">${char}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function getDefaultSymbols(): SymbolDef[] {
  return DEFAULT_SYMBOLS;
}
