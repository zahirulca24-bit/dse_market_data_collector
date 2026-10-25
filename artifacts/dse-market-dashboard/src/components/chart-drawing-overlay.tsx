import { useState, useRef, type MouseEvent } from 'react';

export type DrawingTool = 'cursor' | 'trendline' | 'horizontal' | 'fibonacci' | 'measure' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingItem {
  id: string;
  type: DrawingTool;
  start: Point;
  end: Point;
  color: string;
  text?: string;
}

interface DrawingOverlayProps {
  tool: DrawingTool;
  width: number;
  height: number;
  drawings: DrawingItem[];
  onAddDrawing: (item: DrawingItem) => void;
  onClear: () => void;
}

const FIBO_LEVELS = [
  { level: 0, label: '0.0% (0.0)' },
  { level: 0.236, label: '23.6%' },
  { level: 0.382, label: '38.2%' },
  { level: 0.5, label: '50.0%' },
  { level: 0.618, label: '61.8% (Golden)' },
  { level: 0.786, label: '78.6%' },
  { level: 1.0, label: '100.0%' },
];

export function ChartDrawingOverlay({
  tool,
  width,
  height,
  drawings,
  onAddDrawing,
}: DrawingOverlayProps) {
  const [currentStart, setCurrentStart] = useState<Point | null>(null);
  const [currentEnd, setCurrentEnd] = useState<Point | null>(null);
  const isDrawing = Boolean(currentStart && tool !== 'cursor');
  const svgRef = useRef<SVGSVGElement>(null);

  const getCoordinates = (e: MouseEvent<SVGSVGElement>): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (tool === 'cursor') return;
    const pt = getCoordinates(e);
    if (!pt) return;

    if (tool === 'horizontal') {
      onAddDrawing({
        id: `draw_${Date.now()}`,
        type: 'horizontal',
        start: { x: 0, y: pt.y },
        end: { x: width, y: pt.y },
        color: '#f59e0b',
      });
      return;
    }

    if (tool === 'text') {
      const userText = window.prompt('Enter chart note text:', 'Support level');
      if (userText && userText.trim()) {
        onAddDrawing({
          id: `draw_${Date.now()}`,
          type: 'text',
          start: pt,
          end: pt,
          color: '#38bdf8',
          text: userText.trim(),
        });
      }
      return;
    }

    setCurrentStart(pt);
    setCurrentEnd(pt);
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !currentStart) return;
    const pt = getCoordinates(e);
    if (pt) setCurrentEnd(pt);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentStart || !currentEnd) {
      setCurrentStart(null);
      setCurrentEnd(null);
      return;
    }

    const dist = Math.hypot(currentEnd.x - currentStart.x, currentEnd.y - currentStart.y);
    if (dist > 5) {
      onAddDrawing({
        id: `draw_${Date.now()}`,
        type: tool,
        start: currentStart,
        end: currentEnd,
        color: tool === 'measure' ? '#38bdf8' : tool === 'fibonacci' ? '#a78bfa' : '#22c55e',
      });
    }

    setCurrentStart(null);
    setCurrentEnd(null);
  };

  const renderItem = (item: DrawingItem, isPreview = false) => {
    const { id, type, start, end, color, text } = item;
    const opacity = isPreview ? 0.75 : 1;

    if (type === 'horizontal') {
      return (
        <g key={id}>
          <line
            x1={0}
            y1={start.y}
            x2={width}
            y2={start.y}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="4,4"
            opacity={opacity}
          />
          <rect
            x={10}
            y={start.y - 18}
            width={70}
            height={16}
            rx={3}
            fill="#1e222d"
            stroke={color}
            strokeWidth={1}
            opacity={opacity}
          />
          <text
            x={16}
            y={start.y - 6}
            fill={color}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            opacity={opacity}
          >
            Line
          </text>
        </g>
      );
    }

    if (type === 'text' && text) {
      return (
        <g key={id}>
          <rect
            x={start.x - 4}
            y={start.y - 18}
            width={text.length * 7 + 16}
            height={22}
            rx={4}
            fill="#1e293b"
            stroke="#38bdf8"
            strokeWidth={1}
            opacity={0.9}
          />
          <text
            x={start.x + 4}
            y={start.y - 3}
            fill="#f8fafc"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fontWeight="500"
          >
            {text}
          </text>
        </g>
      );
    }

    if (type === 'trendline') {
      return (
        <g key={id}>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={color}
            strokeWidth={2}
            opacity={opacity}
          />
          <circle cx={start.x} cy={start.y} r={4} fill={color} stroke="#0c0d10" strokeWidth={1} />
          <circle cx={end.x} cy={end.y} r={4} fill={color} stroke="#0c0d10" strokeWidth={1} />
        </g>
      );
    }

    if (type === 'fibonacci') {
      const dy = end.y - start.y;
      const x1 = Math.min(start.x, end.x);
      const x2 = Math.max(start.x, end.x);

      return (
        <g key={id}>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#818cf8"
            strokeWidth={1.5}
            strokeDasharray="4,4"
            opacity={0.6}
          />
          {FIBO_LEVELS.map(({ level, label }) => {
            const currentY = start.y + dy * level;
            return (
              <g key={level}>
                <line
                  x1={Math.max(0, x1 - 80)}
                  y1={currentY}
                  x2={Math.min(width, x2 + 80)}
                  y2={currentY}
                  stroke={level === 0 || level === 1 ? '#e2e8f0' : level === 0.618 ? '#eab308' : '#818cf8'}
                  strokeWidth={level === 0.618 || level === 0.5 ? 1.5 : 1}
                  strokeDasharray={level === 0 || level === 1 ? undefined : '2,2'}
                  opacity={opacity}
                />
                <text
                  x={Math.max(10, x1 - 70)}
                  y={currentY - 3}
                  fill={level === 0.618 ? '#fde047' : '#c7d2fe'}
                  fontSize="9"
                  fontFamily="monospace"
                  opacity={opacity}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    if (type === 'measure') {
      const xMin = Math.min(start.x, end.x);
      const yMin = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);

      return (
        <g key={id}>
          <rect
            x={xMin}
            y={yMin}
            width={w}
            height={h}
            fill="#0284c7"
            fillOpacity={0.15}
            stroke="#38bdf8"
            strokeWidth={1.5}
            strokeDasharray="3,3"
          />
          <rect
            x={xMin + 6}
            y={yMin + 6}
            width={120}
            height={20}
            rx={3}
            fill="#0f172a"
            fillOpacity={0.85}
          />
          <text
            x={xMin + 12}
            y={yMin + 20}
            fill="#38bdf8"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
          >
            ΔY: {h.toFixed(0)}px | ΔX: {w.toFixed(0)}px
          </text>
        </g>
      );
    }

    return null;
  };

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 z-10 w-full h-full ${
        tool === 'cursor' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {drawings.map((d) => renderItem(d))}
      {isDrawing &&
        currentStart &&
        currentEnd &&
        renderItem(
          {
            id: 'preview',
            type: tool,
            start: currentStart,
            end: currentEnd,
            color: tool === 'measure' ? '#38bdf8' : tool === 'fibonacci' ? '#a78bfa' : '#22c55e',
          },
          true
        )}
    </svg>
  );
}
