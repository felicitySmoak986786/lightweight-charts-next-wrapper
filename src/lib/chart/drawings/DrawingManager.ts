import { EventBus } from '../core/EventBus';
import type {
  Drawing,
  DrawingManagerEvents,
  DrawingStyle,
  DrawingTool,
  DrawingType,
} from './types';
import { createDefaultTools } from './tools/registry';

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `dw_${Date.now().toString(36)}_${idCounter}`;
}

function cloneDrawings(drawings: Drawing[]): Drawing[] {
  return drawings.map((drawing) => ({
    ...drawing,
    points: drawing.points.map((point) => ({ ...point })),
    style: { ...drawing.style },
    meta: drawing.meta ? { ...drawing.meta } : undefined,
  }));
}

export interface AddDrawingInput {
  type: DrawingType;
  points: Drawing['points'];
  style?: Partial<DrawingStyle>;
  label?: string;
  meta?: Record<string, unknown>;
}

export type DrawingPatch = Partial<Omit<Drawing, 'id' | 'style'>> & {
  style?: Partial<DrawingStyle>;
};

/**
 * Owns the drawing collection, the active tool, selection state, and undo/redo.
 * Rendering/interaction is handled by `DrawingLayer`.
 */
export class DrawingManager extends EventBus<DrawingManagerEvents> {
  private readonly tools: Map<DrawingType, DrawingTool>;
  private drawings = new Map<string, Drawing>();
  private order: string[] = [];
  private selectedId: string | null = null;
  private currentTool: DrawingType | 'select' | null = 'select';
  private readonly undoStack: Drawing[][] = [];
  private readonly redoStack: Drawing[][] = [];
  private readonly maxHistory = 50;

  constructor(tools?: Map<DrawingType, DrawingTool>) {
    super();
    this.tools = tools ?? createDefaultTools();
  }

  /** Register or override a drawing tool (including custom tools). */
  registerTool(tool: DrawingTool): void {
    this.tools.set(tool.type, tool);
  }

  getTool(type: DrawingType): DrawingTool | undefined {
    return this.tools.get(type);
  }

  get activeTool(): DrawingType | 'select' | null {
    return this.currentTool;
  }

  setTool(tool: DrawingType | 'select' | null): void {
    this.currentTool = tool;
    if (tool !== 'select') this.select(null);
    this.emit('tool', tool);
  }

  add(input: AddDrawingInput, options: { history?: boolean } = {}): Drawing {
    const tool = this.tools.get(input.type);
    if (!tool) throw new Error(`Unknown drawing type: ${input.type}`);
    if (options.history !== false) this.snapshot();
    const drawing: Drawing = {
      id: nextId(),
      type: input.type,
      points: input.points.map((point) => ({ ...point })),
      style: { ...tool.defaultStyle(), ...(input.style ?? {}) },
      locked: false,
      visible: true,
      label: input.label,
      meta: input.meta,
    };
    this.drawings.set(drawing.id, drawing);
    this.order.push(drawing.id);
    this.emit('created', drawing);
    this.emitChange();
    return drawing;
  }

  update(id: string, patch: DrawingPatch, options: { history?: boolean } = {}): Drawing | null {
    const drawing = this.drawings.get(id);
    if (!drawing) return null;
    if (drawing.locked && options.history !== false) return null;
    if (options.history !== false) this.snapshot();
    if (patch.points) drawing.points = patch.points.map((point) => ({ ...point }));
    if (patch.style) drawing.style = { ...drawing.style, ...patch.style };
    if (patch.label !== undefined) drawing.label = patch.label;
    if (patch.meta) drawing.meta = { ...drawing.meta, ...patch.meta };
    if (patch.locked !== undefined) drawing.locked = patch.locked;
    if (patch.visible !== undefined) drawing.visible = patch.visible;
    this.emit('updated', drawing);
    this.emitChange();
    return drawing;
  }

  /** Restyle the currently selected drawing. */
  updateSelectedStyle(style: Partial<DrawingStyle>): void {
    if (!this.selectedId) return;
    this.update(this.selectedId, { style });
  }

  remove(id: string): boolean {
    const drawing = this.drawings.get(id);
    if (!drawing) return false;
    this.snapshot();
    this.drawings.delete(id);
    this.order = this.order.filter((item) => item !== id);
    if (this.selectedId === id) this.select(null);
    this.emit('removed', drawing);
    this.emitChange();
    return true;
  }

  removeSelected(): boolean {
    return this.selectedId ? this.remove(this.selectedId) : false;
  }

  clear(): void {
    if (this.drawings.size === 0) return;
    this.snapshot();
    this.drawings.clear();
    this.order = [];
    this.select(null);
    this.emitChange();
  }

  list(): Drawing[] {
    return this.order.map((id) => this.drawings.get(id)!).filter(Boolean);
  }

  get(id: string): Drawing | undefined {
    return this.drawings.get(id);
  }

  getSelected(): Drawing | null {
    return this.selectedId ? this.drawings.get(this.selectedId) ?? null : null;
  }

  select(id: string | null): void {
    if (id && !this.drawings.has(id)) id = null;
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.emit('selection', this.getSelected());
  }

  /** Mutate a drawing without pushing history (used during drag previews). */
  mutate(id: string, mutator: (drawing: Drawing) => void): Drawing | null {
    const drawing = this.drawings.get(id);
    if (!drawing || drawing.locked) return null;
    mutator(drawing);
    this.emit('updated', drawing);
    this.emitChange();
    return drawing;
  }

  /** Snapshot before a drag begins so the whole gesture is one undo step. */
  beginHistory(): void {
    this.snapshot();
  }

  serialize(): string {
    return JSON.stringify(this.list());
  }

  deserialize(json: string): void {
    const parsed = JSON.parse(json) as Drawing[];
    this.drawings.clear();
    this.order = [];
    for (const drawing of parsed) {
      this.drawings.set(drawing.id, drawing);
      this.order.push(drawing.id);
    }
    this.select(null);
    this.emitChange();
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(cloneDrawings(this.list()));
    this.restore(previous);
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(cloneDrawings(this.list()));
    this.restore(next);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private restore(drawings: Drawing[]): void {
    this.drawings.clear();
    this.order = [];
    for (const drawing of drawings) {
      this.drawings.set(drawing.id, drawing);
      this.order.push(drawing.id);
    }
    this.select(null);
    this.emitChange();
  }

  private snapshot(): void {
    this.undoStack.push(cloneDrawings(this.list()));
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  private emitChange(): void {
    this.emit('change', this.list());
  }
}
