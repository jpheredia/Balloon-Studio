import { balloonRadii } from './geometry';

export const BALLOON_POSITIONS = {
  'top-left': 'Esquina superior izquierda',
  'top-right': 'Esquina superior derecha',
  center: 'Centro',
  'bottom-left': 'Esquina inferior izquierda',
  'bottom-right': 'Esquina inferior derecha',
} as const;
export type BalloonSettings = { fontSize: number; position: keyof typeof BALLOON_POSITIONS };
export const defaultBalloonSettings: BalloonSettings = { fontSize: 13, position: 'top-left' };

export function validBalloonSettings(value: any): value is BalloonSettings {
  return !!value && Number.isFinite(value.fontSize) && value.fontSize >= 6 && value.fontSize <= 48
    && typeof value.position === 'string' && Object.hasOwn(BALLOON_POSITIONS, value.position);
}

export function defaultBalloonPosition(
  rect: { x: number; y: number; width: number; height: number },
  page: { pageWidth: number; pageHeight: number },
  label: string,
  settings: BalloonSettings,
) {
  const { position } = settings;
  const r = balloonRadii(label, settings.fontSize);
  // Leave the balloon outside the selected corner, with a visible leader.
  const gap = 8;
  const x = position === 'center' ? rect.x + rect.width / 2
    : position.endsWith('right') ? rect.x + rect.width + r.rx + gap : rect.x - r.rx - gap;
  const y = position === 'center' ? rect.y + rect.height / 2
    : position.startsWith('bottom') ? rect.y + rect.height + r.ry + gap : rect.y - r.ry - gap;
  const marginX = Math.min(r.rx, page.pageWidth / 2), marginY = Math.min(r.ry, page.pageHeight / 2);
  return {
    bx: Math.max(marginX, Math.min(page.pageWidth - marginX, x)),
    by: Math.max(marginY, Math.min(page.pageHeight - marginY, y)),
  };
}
