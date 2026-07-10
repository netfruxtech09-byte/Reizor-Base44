import { useState, useRef } from "react";
import { Plus, Trash2, Save, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const SECTION_COLORS = [
  "#ff1b8d", "#1e64ff", "#a855f7", "#f97316", "#10b981", "#eab308", "#ec4899", "#06b6d4",
];

const PROXIMITY_OPTIONS = ["Front (Stage-side)", "Mid", "Back", "Balcony", "Floor", "Mezzanine"];

const SEAT_SIZE = 18;
const SEAT_GAP = 4;

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SeatMapEditor({ eventId, eventTitle, existingSeatMap, onSaved }) {
  const [sections, setSections] = useState(existingSeatMap?.sections || []);
  const [stageLabel, setStageLabel] = useState(existingSeatMap?.stage_label || "STAGE");
  const [canvasW] = useState(existingSeatMap?.canvas_width || 800);
  const [canvasH] = useState(existingSeatMap?.canvas_height || 600);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef(null);

  // New section form
  const [newSection, setNewSection] = useState({
    name: "", rows: 5, cols: 8, price: 50, tier_name: "General", proximity: "Mid",
    color: SECTION_COLORS[0],
  });

  const addSection = () => {
    if (!newSection.name || !newSection.rows || !newSection.cols || !newSection.price) {
      toast.error("Fill in section name, rows, columns, and price");
      return;
    }
    setSections(prev => [...prev, {
      ...newSection,
      id: generateId(),
      x: 50 + (prev.length % 3) * 240,
      y: 120 + Math.floor(prev.length / 3) * 180,
      rows: Number(newSection.rows),
      cols: Number(newSection.cols),
      price: Number(newSection.price),
    }]);
    setNewSection({ name: "", rows: 5, cols: 8, price: 50, tier_name: "General", proximity: "Mid", color: SECTION_COLORS[sections.length % SECTION_COLORS.length] });
  };

  const removeSection = (id) => {
    setSections(prev => prev.filter(s => s.id !== id));
    if (selected === id) setSelected(null);
  };

  const updateSection = (id, field, value) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: field === "rows" || field === "cols" || field === "price" ? Number(value) : value } : s));
  };

  // SVG drag
  const onMouseDown = (e, sectionId) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const sec = sections.find(s => s.id === sectionId);
    setDragging(sectionId);
    setSelected(sectionId);
    setDragOffset({ x: mx - sec.x, y: my - sec.y });
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    setSections(prev => prev.map(s => s.id === dragging
      ? { ...s, x: Math.max(0, mx - dragOffset.x), y: Math.max(0, my - dragOffset.y) }
      : s
    ));
  };

  const onMouseUp = () => setDragging(null);

  const handleSave = async () => {
    setSaving(true);
    const data = { event_id: eventId, event_title: eventTitle, canvas_width: canvasW, canvas_height: canvasH, stage_label: stageLabel, sections, taken_seats: existingSeatMap?.taken_seats || [] };
    if (existingSeatMap?.id) {
      await base44.entities.SeatMap.update(existingSeatMap.id, data);
    } else {
      await base44.entities.SeatMap.create(data);
    }
    setSaving(false);
    toast.success("Seat map saved!");
    onSaved?.();
  };

  const selectedSection = sections.find(s => s.id === selected);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display font-black text-xl tracking-tight">SEAT MAP EDITOR</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Design your venue layout. Drag sections to position them.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold gap-2">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Map"}
        </Button>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-5">
        {/* SVG Canvas */}
        <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
          <div className="p-2 bg-secondary/50 border-b border-border/30 flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">Drag sections to position · Click to edit</span>
          </div>
          <div className="p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              className="w-full border border-border/30 rounded-lg bg-slate-950 select-none"
              style={{ cursor: dragging ? "grabbing" : "default" }}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {/* Grid lines */}
              {Array.from({ length: Math.floor(canvasW / 40) }).map((_, i) => (
                <line key={`v${i}`} x1={(i + 1) * 40} y1={0} x2={(i + 1) * 40} y2={canvasH} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              ))}
              {Array.from({ length: Math.floor(canvasH / 40) }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={(i + 1) * 40} x2={canvasW} y2={(i + 1) * 40} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              ))}

              {/* Stage */}
              <rect x={canvasW / 2 - 120} y={10} width={240} height={52} rx={8} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
              <text x={canvasW / 2} y={41} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={15} fontWeight="bold" fontFamily="monospace">{stageLabel}</text>

              {/* Sections */}
              {sections.map(sec => {
                const seatW = SEAT_SIZE + SEAT_GAP;
                const seatH = SEAT_SIZE + SEAT_GAP;
                const secW = sec.cols * seatW + SEAT_GAP;
                const secH = sec.rows * seatH + 28 + SEAT_GAP;
                const isSelected = selected === sec.id;
                return (
                  <g key={sec.id} transform={`translate(${sec.x},${sec.y})`}
                    style={{ cursor: "grab" }}
                    onMouseDown={e => onMouseDown(e, sec.id)}>
                    {/* Section bg */}
                    <rect width={secW} height={secH} rx={6}
                      fill={`${sec.color}18`}
                      stroke={isSelected ? sec.color : `${sec.color}60`}
                      strokeWidth={isSelected ? 2.5 : 1.5} />
                    {/* Section label */}
                    <text x={secW / 2} y={16} textAnchor="middle" fill={sec.color} fontSize={10} fontWeight="bold" fontFamily="monospace">
                      {sec.name.toUpperCase()}
                    </text>
                    <text x={secW / 2} y={26} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={8} fontFamily="monospace">
                      ${sec.price} · {sec.rows * sec.cols} seats
                    </text>
                    {/* Seats */}
                    {Array.from({ length: sec.rows }).map((_, r) =>
                      Array.from({ length: sec.cols }).map((_, c) => (
                        <rect
                          key={`${r}-${c}`}
                          x={SEAT_GAP + c * seatW}
                          y={30 + r * seatH}
                          width={SEAT_SIZE}
                          height={SEAT_SIZE}
                          rx={3}
                          fill={`${sec.color}55`}
                          stroke={`${sec.color}99`}
                          strokeWidth={0.8}
                        />
                      ))
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Stage label */}
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Stage Label</p>
            <Input value={stageLabel} onChange={e => setStageLabel(e.target.value)}
              className="bg-secondary border-border/50 text-sm" />
          </div>

          {/* Add section */}
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Add Section</p>
            <Input placeholder="Section name (e.g. VIP)" value={newSection.name}
              onChange={e => setNewSection(p => ({ ...p, name: e.target.value }))}
              className="bg-secondary border-border/50 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">Rows</p>
                <Input type="number" min="1" max="30" value={newSection.rows}
                  onChange={e => setNewSection(p => ({ ...p, rows: e.target.value }))}
                  className="bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">Cols</p>
                <Input type="number" min="1" max="30" value={newSection.cols}
                  onChange={e => setNewSection(p => ({ ...p, cols: e.target.value }))}
                  className="bg-secondary border-border/50 text-sm" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-1">Price per seat ($)</p>
              <Input type="number" min="0" value={newSection.price}
                onChange={e => setNewSection(p => ({ ...p, price: e.target.value }))}
                className="bg-secondary border-border/50 text-sm" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-1">Tier name</p>
              <Input placeholder="VIP / GA / Balcony" value={newSection.tier_name}
                onChange={e => setNewSection(p => ({ ...p, tier_name: e.target.value }))}
                className="bg-secondary border-border/50 text-sm" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-1">Stage proximity</p>
              <select value={newSection.proximity}
                onChange={e => setNewSection(p => ({ ...p, proximity: e.target.value }))}
                className="w-full rounded-md bg-secondary border border-border/50 px-3 py-1.5 text-sm">
                {PROXIMITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {SECTION_COLORS.map(c => (
                  <button key={c} onClick={() => setNewSection(p => ({ ...p, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${newSection.color === c ? "border-white scale-110" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <Button onClick={addSection} className="w-full gap-2 font-display font-bold" size="sm">
              <Plus className="w-3.5 h-3.5" /> Add Section
            </Button>
          </div>

          {/* Selected section editor */}
          {selectedSection && (
            <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-primary uppercase tracking-wider">Edit: {selectedSection.name}</p>
                <button onClick={() => removeSection(selectedSection.id)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground mb-1">Rows</p>
                  <Input type="number" min="1" max="30" value={selectedSection.rows}
                    onChange={e => updateSection(selectedSection.id, "rows", e.target.value)}
                    className="bg-secondary border-border/50 text-sm" />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground mb-1">Cols</p>
                  <Input type="number" min="1" max="30" value={selectedSection.cols}
                    onChange={e => updateSection(selectedSection.id, "cols", e.target.value)}
                    className="bg-secondary border-border/50 text-sm" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">Price per seat ($)</p>
                <Input type="number" min="0" value={selectedSection.price}
                  onChange={e => updateSection(selectedSection.id, "price", e.target.value)}
                  className="bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">Tier name</p>
                <Input value={selectedSection.tier_name}
                  onChange={e => updateSection(selectedSection.id, "tier_name", e.target.value)}
                  className="bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-2">Color</p>
                <div className="flex flex-wrap gap-2">
                  {SECTION_COLORS.map(c => (
                    <button key={c} onClick={() => updateSection(selectedSection.id, "color", c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${selectedSection.color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sections list */}
          {sections.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Sections ({sections.length})</p>
              {sections.map(s => (
                <div key={s.id} onClick={() => setSelected(s.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selected === s.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{s.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{s.rows * s.cols} seats · ${s.price}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeSection(s.id); }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}