'use client';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function SelectionOrder({ count, position, max, disabled, onMove }: {
  count: number; position: number; max: number; disabled: boolean; onMove: (position: number) => void;
}) {
  return <div className="selection-order" aria-label="Mover selección en la lista">
    <label>Mover {count} juntos a la posición<input aria-label="Posición de la selección" key={position + '-' + count} type="number" min={1} max={max} defaultValue={position} disabled={disabled} onBlur={e => { onMove(Number(e.target.value)); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>
    <Button variant="outline" size="icon" aria-label="Subir selección completa" disabled={disabled || position <= 1} onClick={() => onMove(position - 1)}><ArrowUp/></Button>
    <Button variant="outline" size="icon" aria-label="Bajar selección completa" disabled={disabled || position >= max} onClick={() => onMove(position + 1)}><ArrowDown/></Button>
  </div>;
}
