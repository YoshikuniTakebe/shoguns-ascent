import type { ReactNode } from 'react';
import { BushiIcon, CoinIcon, HonorIcon, VPIcon, ShintoIcon, FistIcon } from '../components/Icons';

const ICON_MAP: Record<string, typeof VPIcon> = {
  vp: VPIcon,
  coin: CoinIcon,
  honor: HonorIcon,
  bushi: BushiIcon,
  shinto: ShintoIcon,
  force: FistIcon,
};

const COLOR_MAP: Record<string, string> = {
  honor: '#9b59b6',
  vp: '#e94560',
  force: '#3498db',
  coin: '#c8a951',
};

const TOKEN_REGEX = /\{(vp|coin|honor|bushi|shinto|force)\}([+]?\d*)/g;

/**
 * Parses a translated card effect string containing icon tokens like {vp}3, {coin}2, {honor}, {force}+1, etc.
 * Returns an array of React nodes with inline SVG icons replacing the tokens.
 */
export function renderCardEffect(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    const [fullMatch, iconName, amount] = match;
    const matchStart = match.index;

    // Add text before this match
    if (matchStart > lastIndex) {
      result.push(text.slice(lastIndex, matchStart));
    }

    // Add the icon component
    const IconComponent = ICON_MAP[iconName];
    if (IconComponent) {
      const iconColor = COLOR_MAP[iconName] || undefined;
      result.push(
        <span key={`icon-${matchStart}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', gap: '1px' }}>
          <IconComponent size={14} color={iconColor} />
          {amount && <span>{amount}</span>}
        </span>
      );
    }

    lastIndex = matchStart + fullMatch.length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  // If no tokens found, return the original text in an array
  if (result.length === 0) {
    return [text];
  }

  return result;
}
