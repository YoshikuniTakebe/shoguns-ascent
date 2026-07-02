import type { ReactNode } from 'react';
import { BushiIcon, CoinIcon, HonorIcon, VPIcon, ShintoIcon } from '../components/Icons';

const ICON_MAP: Record<string, typeof VPIcon> = {
  vp: VPIcon,
  coin: CoinIcon,
  honor: HonorIcon,
  bushi: BushiIcon,
  shinto: ShintoIcon,
};

const TOKEN_REGEX = /\{(vp|coin|honor|bushi|shinto)\}(\d*)/g;

/**
 * Parses a translated card effect string containing icon tokens like {vp}3, {coin}2, {honor}, etc.
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
      result.push(
        <span key={`icon-${matchStart}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', gap: '1px' }}>
          <IconComponent size={14} />
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
