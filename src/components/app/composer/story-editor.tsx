"use client";

import { useMemo, useRef, useState } from "react";
import {
  AtSign,
  Download,
  Eraser,
  Image as ImageIcon,
  Loader2,
  PenLine,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authenticatedFetch } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StoryMedia = { type: "image" | "video"; url: string; alt?: string };
type OverlayKind = "text" | "mention" | "sticker";
type Overlay = {
  id: string;
  kind: OverlayKind;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
};
type DrawPoint = { x: number; y: number };
type DrawPath = { id: string; points: DrawPoint[]; color: string; width: number };
type Tool = "text" | "sticker" | "mention" | "draw" | "effects" | null;

const STICKERS = ["❤️", "🔥", "✨", "🎉", "😍", "🙌", "📍", "⭐", "💯", "🥂", "🎵", "👀"];

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function coverRect(sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight };
}

export function StoryEditor({
  media,
  onApplied,
}: {
  media: StoryMedia;
  onApplied: (url: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [mentionValue, setMentionValue] = useState("");
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [activePath, setActivePath] = useState<DrawPath | null>(null);
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(8);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);

  const selected = overlays.find((item) => item.id === selectedId) ?? null;
  const filter = useMemo(
    () => `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%)`,
    [brightness, contrast, saturation, grayscale]
  );

  const addOverlay = (kind: OverlayKind, raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    const text = kind === "mention" ? `@${clean.replace(/^@+/, "").replace(/\s+/g, "")}` : clean;
    const item: Overlay = {
      id: uid(kind),
      kind,
      text,
      x: 0.5,
      y: kind === "sticker" ? 0.42 : 0.5,
      size: kind === "sticker" ? 72 : 48,
      color: "#ffffff",
    };
    setOverlays((current) => [...current, item]);
    setSelectedId(item.id);
    setTextValue("");
    setMentionValue("");
  };

  const updateSelected = (patch: Partial<Overlay>) => {
    if (!selectedId) return;
    setOverlays((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  };

  const stagePoint = (event: React.PointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      rect,
    };
  };

  const onStagePointerDown = (event: React.PointerEvent) => {
    if (tool !== "draw") return;
    const point = stagePoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActivePath({ id: uid("path"), points: [{ x: point.x, y: point.y }], color: drawColor, width: drawWidth });
  };

  const onStagePointerMove = (event: React.PointerEvent) => {
    if (dragging) {
      const point = stagePoint(event);
      if (!point) return;
      setOverlays((current) => current.map((item) => item.id === dragging.id ? {
        ...item,
        x: Math.max(0.03, Math.min(0.97, point.x - dragging.dx)),
        y: Math.max(0.03, Math.min(0.97, point.y - dragging.dy)),
      } : item));
      return;
    }
    if (tool !== "draw" || !activePath) return;
    const point = stagePoint(event);
    if (!point) return;
    setActivePath((current) => current ? { ...current, points: [...current.points, { x: point.x, y: point.y }] } : current);
  };

  const finishPointer = () => {
    if (activePath && activePath.points.length > 1) setDrawPaths((current) => [...current, activePath]);
    setActivePath(null);
    setDragging(null);
  };

  const startOverlayDrag = (event: React.PointerEvent, overlay: Overlay) => {
    if (tool === "draw") return;
    event.stopPropagation();
    setSelectedId(overlay.id);
    const point = stagePoint(event);
    if (!point) return;
    setDragging({ id: overlay.id, dx: point.x - overlay.x, dy: point.y - overlay.y });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const renderStory = async (): Promise<Blob> => {
    if (media.type !== "image") throw new Error("Automatic Story canvas export currently supports image Stories. Video Stories keep the original video and use Finish in Instagram for native overlays.");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = media.url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load the Story image for editing. Re-upload it and try again."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");

    ctx.save();
    ctx.filter = filter;
    const box = coverRect(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height);
    ctx.drawImage(img, box.x, box.y, box.width, box.height);
    ctx.restore();

    const paths = activePath ? [...drawPaths, activePath] : drawPaths;
    for (const path of paths) {
      if (path.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width * 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      path.points.forEach((point, index) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    for (const overlay of overlays) {
      ctx.save();
      const px = overlay.x * canvas.width;
      const py = overlay.y * canvas.height;
      const fontPx = overlay.size * 2.1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = overlay.color;
      ctx.font = overlay.kind === "mention"
        ? `700 ${fontPx}px Arial, sans-serif`
        : overlay.kind === "sticker"
          ? `${fontPx * 1.25}px Arial, sans-serif`
          : `700 ${fontPx}px Arial, sans-serif`;
      if (overlay.kind !== "sticker") {
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
      }
      ctx.fillText(overlay.text, px, py, canvas.width * 0.88);
      ctx.restore();
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render Story image.")), "image/jpeg", 0.86);
    });
  };

  const downloadStory = async () => {
    try {
      const blob = await renderStory();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `loomic-story-${Date.now()}.jpg`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error("Story export failed", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  const applyStory = async () => {
    setExporting(true);
    try {
      const blob = await renderStory();
      const file = new File([blob], `loomic-story-${Date.now()}.jpg`, { type: "image/jpeg" });
      const formData = new FormData();
      formData.set("file", file);
      const response = await authenticatedFetch("/api/v1/upload", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok || !json?.data?.url) throw new Error(json?.error?.message ?? "Rendered Story upload failed");
      onApplied(json.data.url);
      toast.success("Story design applied", { description: "The rendered 1080×1920 Story will be used for publishing/scheduling." });
    } catch (error) {
      toast.error("Could not apply Story design", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setExporting(false);
    }
  };

  const toolbar = [
    { id: "text" as const, label: "Text", icon: Type },
    { id: "sticker" as const, label: "Stickers", icon: Smile },
    { id: "mention" as const, label: "Mention", icon: AtSign },
    { id: "draw" as const, label: "Draw", icon: PenLine },
    { id: "effects" as const, label: "Effects", icon: Sparkles },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Instagram-style Story editor</div>
          <div className="text-[10px] text-muted-foreground">Drag text/stickers directly on the 9:16 canvas. Apply before scheduling.</div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { setOverlays([]); setDrawPaths([]); setBrightness(100); setContrast(100); setSaturation(100); setGrayscale(0); }}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void downloadStory()} disabled={media.type !== "image"}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download
          </Button>
          <Button type="button" size="sm" onClick={() => void applyStory()} disabled={exporting || media.type !== "image"} className="bg-gradient-to-r from-primary to-accent text-white">
            {exporting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            {exporting ? "Applying…" : "Apply to Story"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(260px,390px)_88px_minmax(220px,1fr)]">
        <div
          ref={stageRef}
          className={cn("relative mx-auto aspect-[9/16] w-full max-w-[390px] touch-none overflow-hidden rounded-[26px] bg-black shadow-xl", tool === "draw" && "cursor-crosshair")}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onPointerLeave={() => dragging && finishPointer()}
        >
          {media.type === "video" ? (
            <video src={media.url} className="h-full w-full object-cover" controls playsInline style={{ filter }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt={media.alt || "Story"} crossOrigin="anonymous" className="h-full w-full object-cover" style={{ filter }} />
          )}

          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1777" preserveAspectRatio="none">
            {[...drawPaths, ...(activePath ? [activePath] : [])].map((path) => (
              <polyline
                key={path.id}
                fill="none"
                stroke={path.color}
                strokeWidth={path.width * 2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={path.points.map((point) => `${point.x * 1000},${point.y * 1777}`).join(" ")}
              />
            ))}
          </svg>

          {overlays.map((overlay) => (
            <button
              key={overlay.id}
              type="button"
              onPointerDown={(event) => startOverlayDrag(event, overlay)}
              onPointerMove={onStagePointerMove}
              onPointerUp={finishPointer}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap rounded-lg px-2 py-1 text-center font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,.65)]",
                selectedId === overlay.id && "ring-2 ring-white/80 ring-offset-2 ring-offset-transparent",
                overlay.kind === "mention" && "bg-black/45",
                overlay.kind === "sticker" && "bg-transparent drop-shadow-none"
              )}
              style={{ left: `${overlay.x * 100}%`, top: `${overlay.y * 100}%`, fontSize: `${overlay.size}px`, color: overlay.color }}
            >
              {overlay.text}
            </button>
          ))}

          <div className="pointer-events-none absolute left-3 right-3 top-3 flex gap-1">
            <div className="h-0.5 flex-1 rounded-full bg-white/90" />
          </div>
        </div>

        <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {toolbar.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool((current) => current === id ? null : id)}
              className={cn("flex min-w-[72px] flex-col items-center gap-1 rounded-xl border border-transparent px-2 py-2 text-[10px] transition hover:bg-muted", tool === id && "border-primary/30 bg-primary/10 text-primary")}
            >
              <Icon className="h-5 w-5" />{label}
            </button>
          ))}
          <button type="button" onClick={() => void downloadStory()} className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] hover:bg-muted">
            <Download className="h-5 w-5" />Download
          </button>
        </div>

        <div className="min-h-[170px] rounded-xl border border-border bg-muted/20 p-3">
          {!tool && !selected && (
            <div className="flex h-full min-h-[145px] flex-col items-center justify-center text-center text-xs text-muted-foreground">
              <ImageIcon className="mb-2 h-7 w-7 opacity-60" />
              Choose a tool, then drag added elements on the Story.
            </div>
          )}

          {tool === "text" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold">Add text</div>
              <textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Type Story text…" className="min-h-20 w-full rounded-lg border border-border bg-card p-2 text-xs outline-none focus:border-primary" />
              <Button type="button" size="sm" onClick={() => addOverlay("text", textValue)}>Add text</Button>
            </div>
          )}

          {tool === "mention" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold">Visual @mention</div>
              <input value={mentionValue} onChange={(e) => setMentionValue(e.target.value)} placeholder="username" className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary" />
              <Button type="button" size="sm" onClick={() => addOverlay("mention", mentionValue)}><AtSign className="mr-1 h-3.5 w-3.5" />Add mention</Button>
              <p className="text-[10px] leading-4 text-muted-foreground">This becomes visible pixels in an automatically published Story. Instagram&apos;s native Story Mention sticker/DM still requires finishing in Instagram.</p>
            </div>
          )}

          {tool === "sticker" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold">Decorative stickers</div>
              <div className="grid grid-cols-6 gap-2">
                {STICKERS.map((sticker) => <button key={sticker} type="button" onClick={() => addOverlay("sticker", sticker)} className="rounded-lg border border-border bg-card p-2 text-xl hover:border-primary/50">{sticker}</button>)}
              </div>
              <p className="text-[10px] text-muted-foreground">These are baked into the Story image and publish automatically.</p>
            </div>
          )}

          {tool === "draw" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Draw</span><Button type="button" variant="ghost" size="sm" onClick={() => setDrawPaths((p) => p.slice(0, -1))}><Eraser className="mr-1 h-3.5 w-3.5" />Undo stroke</Button></div>
              <div className="flex gap-2">{["#ffffff", "#111111", "#ff3040", "#ffcf33", "#3bc8ff", "#8e5cff"].map((color) => <button key={color} type="button" onClick={() => setDrawColor(color)} className={cn("h-7 w-7 rounded-full border-2", drawColor === color ? "border-primary" : "border-background")} style={{ backgroundColor: color }} />)}</div>
              <label className="block text-[10px] text-muted-foreground">Brush size <input type="range" min="3" max="24" value={drawWidth} onChange={(e) => setDrawWidth(Number(e.target.value))} className="mt-1 w-full" /></label>
            </div>
          )}

          {tool === "effects" && (
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-xs font-semibold"><SlidersHorizontal className="h-3.5 w-3.5" /> Effects</div>
              {[
                ["Brightness", brightness, setBrightness, 50, 150],
                ["Contrast", contrast, setContrast, 50, 150],
                ["Saturation", saturation, setSaturation, 0, 180],
                ["B&W", grayscale, setGrayscale, 0, 100],
              ].map(([label, value, setter, min, max]) => (
                <label key={String(label)} className="block text-[10px] text-muted-foreground">{String(label)}: {Number(value)}%<input type="range" min={Number(min)} max={Number(max)} value={Number(value)} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))} className="mt-1 w-full" /></label>
              ))}
            </div>
          )}

          {selected && tool !== "draw" && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold">Selected element</span><button type="button" onClick={() => { setOverlays((items) => items.filter((item) => item.id !== selected.id)); setSelectedId(null); }} className="text-destructive"><Trash2 className="h-4 w-4" /></button></div>
              <label className="block text-[10px] text-muted-foreground">Size<input type="range" min="24" max="96" value={selected.size} onChange={(e) => updateSelected({ size: Number(e.target.value) })} className="mt-1 w-full" /></label>
              {selected.kind !== "sticker" && <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">Text color <input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} className="h-7 w-10 rounded border-0 bg-transparent" /></label>}
            </div>
          )}
        </div>
      </div>

      {media.type === "video" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-4 text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          Video Story preview editing is available, but Loomic does not bake overlays into video in-browser. Keep the original video for automatic publishing or use Finish in Instagram for native video stickers/text.
        </div>
      )}
    </div>
  );
}
