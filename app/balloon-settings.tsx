'use client';
import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { BALLOON_POSITIONS, validBalloonSettings, type BalloonSettings } from '@/lib/balloon-settings';
import { balloonRadii } from '@/lib/geometry';

export default function BalloonConfiguration({ value, disabled, onApply }: {
  value: BalloonSettings; disabled: boolean; onApply: (settings: BalloonSettings) => void;
}) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(value), [error, setError] = useState('');
  const r = balloonRadii('101', draft.fontSize || 13);
  function apply() {
    if (!validBalloonSettings(draft)) { setError('El tamaño de letra debe estar entre 6 y 48.'); return; }
    onApply(draft); setOpen(false);
  }
  return <>
    <Button variant="outline" disabled={disabled} onClick={() => { setDraft({ ...value }); setError(''); setOpen(true); }}><Settings2 size={16}/> Balloons</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="balloon-dialog">
      <DialogHeader><DialogTitle>Configuración de balloons</DialogTitle><DialogDescription>Se aplica a todas las hojas del proyecto.</DialogDescription></DialogHeader>
      <fieldset className="balloon-position-field"><legend>Posición de los nuevos balloons</legend>
        <div className="balloon-position-picker" role="radiogroup" aria-label="Posición predeterminada">
          <div className="position-rectangle" aria-hidden="true"/>
          {Object.entries(BALLOON_POSITIONS).map(([position, label]) => <button type="button" key={position} className={'position-choice position-' + position} role="radio" aria-checked={draft.position === position} aria-label={label} title={label} onClick={() => setDraft(d => ({ ...d, position: position as BalloonSettings['position'] }))}><span/></button>)}
        </div>
        <p>{BALLOON_POSITIONS[draft.position]}</p>
      </fieldset>
      <label className="balloon-size-field">Tamaño de letra (a escala 100 %)<input type="number" min={6} max={48} step={1} value={draft.fontSize || ''} onChange={e => setDraft(d => ({ ...d, fontSize: Number(e.target.value) }))}/></label>
      <div className="balloon-size-preview" aria-label="Vista previa del tamaño"><span style={{ fontSize: draft.fontSize || 13, width: r.rx * 2, height: r.ry * 2 }}>101</span></div>
      <p className="balloon-settings-help">El tamaño cambia todos los balloons y su exportación. La posición se usa al añadirlos; después puedes moverlos.</p>
      {error && <p role="alert" className="metadata-error">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={apply}>Aplicar a todas las hojas</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
