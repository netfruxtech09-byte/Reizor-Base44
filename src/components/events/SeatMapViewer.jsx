import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const SEAT_SIZE = 18;
const SEAT_GAP = 4;

function getSeatId(sectionId, row, col) {
  return `${sectionId}_r${row}_c${col}`;
}

export default function SeatMapViewer({ seatMap, takenSeats = [], selectedSeats = [], onSeatToggle, maxSelectable = 10 }) {
  const { sections = [], stage_label = "STAGE", canvas_width = 800, canvas_height = 600 } = seatMap;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const takenSet = new Set(takenSeats);
  const selectedSet = new Set(selectedSeats);

  const handleSeatClick = (sectionId, row, col, price, tierName, proximity) => {
    const seatId = getSeatId(sectionId, row, col);
    if (takenSet.has(seatId)) return;
    onSeatToggle?.({ seatId, sectionId, row, col, price, tierName, proximity });
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === "rect" && e.target.dataset.clickable) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.4, Math.min(3, z - e.deltaY * 0.001)));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const getSeatColor = (seatId, sectionColor) => {
    if (takenSet.has(seatId)) return "#374151"; // taken = gray
    if (selectedSet.has(seatId)) return "#ffffff"; // selected = white
    return `${sectionColor}bb`;
  };

  const getSeatStroke = (seatId, sectionColor) => {
    if (takenSet.has(seatId)) return "#4b5563";
    if (selectedSet.has(seatId)) return "#ffffff";
    return sectionColor;
  };

  // Build legend entries from sections
  const legendEntries = sections.reduce((acc, sec) => {
    if (!acc.find(e => e.tierName === sec.tier_name)) {
      acc.push({ tierName: sec.tier_name || sec.name, color: sec.color, price: sec.price, proximity: sec.proximity });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-muted-foreground">
          {selectedSet.size > 0
            ? `${selectedSet.size} seat${selectedSet.size > 1 ? "s" : ""} selected`
            : "Click seats to select · Scroll or pinch to zoom · Drag to pan"}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="p-1.5 rounded-md bg-secondary border border-border/50 hover:bg-muted transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
            className="p-1.5 rounded-md bg-secondary border border-border/50 hover:bg-muted transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetView}
            className="p-1.5 rounded-md bg-secondary border border-border/50 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-muted-foreground ml-1">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* SVG Viewport */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden bg-slate-950 border border-border/50"
        style={{ height: 420, cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          style={{ width: "100%", height: "100%" }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: "center center" }}>

            {/* Grid */}
            {Array.from({ length: Math.floor(canvas_width / 40) }).map((_, i) => (
              <line key={`v${i}`} x1={(i + 1) * 40} y1={0} x2={(i + 1) * 40} y2={canvas_height} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            ))}
            {Array.from({ length: Math.floor(canvas_height / 40) }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={(i + 1) * 40} x2={canvas_width} y2={(i + 1) * 40} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            ))}

            {/* Stage */}
            <rect x={canvas_width / 2 - 130} y={8} width={260} height={56} rx={10}
              fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
            <text x={canvas_width / 2} y={35} textAnchor="middle" fill="rgba(255,255,255,0.7)"
              fontSize={14} fontWeight="bold" fontFamily="monospace">{stage_label}</text>
            <text x={canvas_width / 2} y={52} textAnchor="middle" fill="rgba(255,255,255,0.3)"
              fontSize={9} fontFamily="monospace">▲ FRONT OF STAGE</text>

            {/* Sections */}
            {sections.map(sec => {
              const seatW = SEAT_SIZE + SEAT_GAP;
              const seatH = SEAT_SIZE + SEAT_GAP;
              const secW = sec.cols * seatW + SEAT_GAP * 2;
              const secH = sec.rows * seatH + 30 + SEAT_GAP;

              return (
                <g key={sec.id} transform={`translate(${sec.x}, ${sec.y})`}>
                  {/* Section background */}
                  <rect width={secW} height={secH} rx={7}
                    fill={`${sec.color}10`}
                    stroke={`${sec.color}50`}
                    strokeWidth={1.5} />

                  {/* Section label */}
                  <text x={secW / 2} y={15} textAnchor="middle"
                    fill={sec.color} fontSize={9} fontWeight="bold" fontFamily="monospace">
                    {sec.name.toUpperCase()}
                  </text>
                  <text x={secW / 2} y={25} textAnchor="middle"
                    fill="rgba(255,255,255,0.35)" fontSize={7.5} fontFamily="monospace">
                    ${sec.price} · {sec.proximity}
                  </text>

                  {/* Seats */}
                  {Array.from({ length: sec.rows }).map((_, r) =>
                    Array.from({ length: sec.cols }).map((_, c) => {
                      const seatId = getSeatId(sec.id, r, c);
                      const isTaken = takenSet.has(seatId);
                      const isSelected = selectedSet.has(seatId);
                      const canSelect = !isTaken && (isSelected || selectedSet.size < maxSelectable);
                      return (
                        <rect
                          key={seatId}
                          x={SEAT_GAP + c * seatW}
                          y={30 + r * seatH}
                          width={SEAT_SIZE}
                          height={SEAT_SIZE}
                          rx={3}
                          fill={getSeatColor(seatId, sec.color)}
                          stroke={getSeatStroke(seatId, sec.color)}
                          strokeWidth={isSelected ? 2 : 0.8}
                          opacity={isTaken ? 0.35 : canSelect ? 1 : 0.5}
                          style={{ cursor: isTaken ? "not-allowed" : "pointer", transition: "fill 0.1s, opacity 0.1s" }}
                          data-clickable={!isTaken ? "true" : undefined}
                          onClick={e => {
                            e.stopPropagation();
                            if (canSelect || isSelected) {
                              handleSeatClick(sec.id, r, c, sec.price, sec.tier_name, sec.proximity);
                            }
                          }}
                        >
                          {isSelected && (
                            <title>✓ Selected · {sec.tier_name} · ${sec.price}</title>
                          )}
                        </rect>
                      );
                    })
                  )}

                  {/* Row labels */}
                  {Array.from({ length: sec.rows }).map((_, r) => (
                    <text key={r} x={-2} y={30 + r * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2 + 3}
                      textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize={7} fontFamily="monospace">
                      {String.fromCharCode(65 + r)}
                    </text>
                  ))}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {legendEntries.map(e => (
          <div key={e.tierName} className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-sm border" style={{ background: `${e.color}bb`, borderColor: e.color }} />
            <span className="text-xs font-mono text-muted-foreground">
              {e.tierName} — <span className="text-foreground font-bold">${e.price}</span>
              {e.proximity ? ` · ${e.proximity}` : ""}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-white border border-white/80" />
          <span className="text-xs font-mono text-muted-foreground">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-gray-600 border border-gray-500 opacity-50" />
          <span className="text-xs font-mono text-muted-foreground">Taken</span>
        </div>
      </div>
    </div>
  );
}