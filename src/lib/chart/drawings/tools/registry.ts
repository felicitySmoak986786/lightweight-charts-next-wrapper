import type { DrawingTool, DrawingType } from '../types';
import { TrendLineTool } from './TrendLineTool';
import { RectangleTool } from './RectangleTool';
import { RulerTool } from './RulerTool';
import { PositionTool } from './PositionTool';

/** Builds the built-in tool map. Custom tools can be added at runtime. */
export function createDefaultTools(): Map<DrawingType, DrawingTool> {
  const tools = new Map<DrawingType, DrawingTool>();
  const list: DrawingTool[] = [
    new TrendLineTool(),
    new RectangleTool(),
    new RulerTool(),
    new PositionTool('long'),
    new PositionTool('short'),
  ];
  for (const tool of list) tools.set(tool.type, tool);
  return tools;
}

export const DRAWING_TOOLS: readonly DrawingType[] = [
  'trendline',
  'rectangle',
  'ruler',
  'longPosition',
  'shortPosition',
];

export const TOOL_LABELS: Record<DrawingType, string> = {
  trendline: 'Trend Line',
  rectangle: 'Rectangle',
  ruler: 'Ruler',
  longPosition: 'Long Position',
  shortPosition: 'Short Position',
};
