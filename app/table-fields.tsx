'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { coordinatePoint, parseHeaders, tableDescription, type InspectionTable, type TableCell } from '@/lib/tables';

export default function TableFields({ tables, cell, number, disabled, inline = false, onTables, onCell }: {
  tables: InspectionTable[]; cell: TableCell | null; number?: string; disabled: boolean; inline?: boolean;
  onTables: (tables: InspectionTable[]) => void;
  onCell: (cell: TableCell, tables?: InspectionTable[]) => void;
}) {
  const pointList = useId();
  const [editing, setEditing] = useState<InspectionTable | null>(null), [error, setError] = useState('');
  const table = tables.find(t => t.id === cell?.tableId);
  function edit(t?: InspectionTable) {
    setError('');setEditing(t ?? { id: crypto.randomUUID(), name: 'Coordenadas', columnLabel: 'Coordenada', columns: ['X', 'Y', 'Z'], rows: ['Punto A', 'Punto B', 'Punto C'] });
  }
  function changePoint(value: string) {
    if (!cell || !table || value.trim() === table.rows[cell.row]) return;
    try { const next = coordinatePoint(tables, cell, value); onCell(next.cell, next.tables); setError(''); }
    catch (e: any) { setError(e.message); }
  }
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    try {
      const t = { ...editing!, name: String(form.get('name')).trim(), columnLabel: String(form.get('columnLabel')).trim(), rows: parseHeaders(String(form.get('rows'))), columns: parseHeaders(String(form.get('columns'))) };
      if (!t.name) throw new Error('Indica el nombre del grupo.');
      const next = tables.some(old => old.id === t.id) ? tables.map(old => old.id === t.id ? t : old) : [...tables, t];
      if (number && !table) onCell({ tableId: t.id, row: 0, column: 0, value: cell?.value ?? '' }, next);
      else onTables(next);
      setEditing(null); setError('');
    } catch (e: any) { setError(e.message); }
  }
  return <section className={'table-fields' + (inline ? ' card-coordinate-fields' : '')} aria-label={'Datos del balloon de coordenada' + (inline ? ' ' + number : '')}>
    {!inline && <strong>{number ? 'Coordenada · balloon ' + number : 'Grupos de coordenadas'}</strong>}
    {number && <>
      {(!table || tables.length > 1) && <label>Grupo de puntos<select aria-label="Grupo de coordenadas" value={cell?.tableId ?? ''} disabled={disabled} onChange={e => onCell({ tableId: e.target.value, row: 0, column: 0, value: cell?.value ?? '' })}><option value="">Elige un grupo</option>{tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      {table && cell && <>
        <div className="table-cell-axes">
          <label>Punto<input aria-label="Punto de la coordenada" list={pointList} key={number + '-' + table.rows[cell.row]} defaultValue={table.rows[cell.row]} maxLength={100} disabled={disabled} placeholder="Punto A, P1…" onBlur={e => changePoint(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/><datalist id={pointList}>{table.rows.map(point => <option key={point} value={point}/>)}</datalist></label>
          <label>Coordenada<select aria-label="Eje de la coordenada" value={cell.column} disabled={disabled} onChange={e => onCell({ ...cell, column: Number(e.target.value) })}>{table.columns.map((axis, i) => <option key={i} value={i}>{axis}</option>)}</select></label>
        </div>
        {!inline && <p className="table-export-preview">{tableDescription({ type: 'coordinate', tableCell: cell }, tables)}</p>}
      </>}
    </>}
    {error && <p role="alert" className="metadata-error">{error}</p>}
    <details className="coordinate-groups"><summary>Configurar grupos de puntos</summary>
      <div className="table-actions"><Button variant="outline" size="sm" disabled={disabled || tables.length >= 100} onClick={() => edit()}>Nuevo grupo</Button>{tables.map(t => <Button key={t.id} variant="ghost" size="sm" disabled={disabled} onClick={() => edit(t)}>Editar {t.name}</Button>)}</div>
      {editing && <form className="table-definition" onSubmit={save} key={editing.id}>
        <label>Nombre del grupo<input name="name" defaultValue={editing.name} required maxLength={100} disabled={disabled}/></label>
        <label>Prefijo de columna<input name="columnLabel" defaultValue={editing.columnLabel} maxLength={100} disabled={disabled}/></label>
        <label>Ejes · un nombre por línea<textarea name="columns" defaultValue={editing.columns.join('\n')} rows={3} required disabled={disabled}/></label>
        <label>Puntos · un nombre por línea<textarea name="rows" defaultValue={editing.rows.join('\n')} rows={4} required disabled={disabled}/></label>
        <div className="table-actions"><Button type="submit" size="sm" disabled={disabled}>Guardar grupo</Button><Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancelar</Button></div>
      </form>}
    </details>
  </section>;
}
