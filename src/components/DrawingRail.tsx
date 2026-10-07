'use client';

import type { DrawingType } from '@/lib/chart';
import {
  CursorIcon,
  EraserIcon,
  LongIcon,
  RectangleIcon,
  RedoIcon,
  RulerIcon,
  ShortIcon,
  TrendLineIcon,
  TrashIcon,
  UndoIcon,
} from './icons';

export interface DrawingRailProps {
  activeTool: DrawingType | 'select';
  onTool: (tool: DrawingType | 'select') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onClear: () => void;
  canClear: boolean;
}

const TOOLS: Array<{ type: DrawingType; label: string; Icon: typeof CursorIcon }> = [
  { type: 'trendline', label: 'Trend Line', Icon: TrendLineIcon },
  { type: 'rectangle', label: 'Rectangle / Square', Icon: RectangleIcon },
  { type: 'ruler', label: 'Ruler / Measure', Icon: RulerIcon },
  { type: 'longPosition', label: 'Long Position', Icon: LongIcon },
  { type: 'shortPosition', label: 'Short Position', Icon: ShortIcon },
];

export function DrawingRail({
  activeTool,
  onTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDelete,
  canDelete,
  onClear,
  canClear,
}: DrawingRailProps) {
  return (
    <div className="ao-rail" role="toolbar" aria-label="Drawing tools">
      <button
        type="button"
        className={`rail-btn ${activeTool === 'select' ? 'active' : ''}`}
        title="Select / Move (Esc)"
        onClick={() => onTool('select')}
      >
        <CursorIcon />
      </button>

      <div className="rail-sep" />

      {TOOLS.map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          className={`rail-btn ${activeTool === type ? 'active' : ''}`}
          title={label}
          onClick={() => onTool(type)}
        >
          <Icon />
        </button>
      ))}

      <div className="rail-sep" />

      <button type="button" className="rail-btn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <UndoIcon />
      </button>
      <button type="button" className="rail-btn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
        <RedoIcon />
      </button>
      <button
        type="button"
        className="rail-btn danger"
        title="Delete selected (Del)"
        disabled={!canDelete}
        onClick={onDelete}
      >
        <TrashIcon />
      </button>
      <button type="button" className="rail-btn danger" title="Clear all drawings" disabled={!canClear} onClick={onClear}>
        <EraserIcon />
      </button>
    </div>
  );
}
