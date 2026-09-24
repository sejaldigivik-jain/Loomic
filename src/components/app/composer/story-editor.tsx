"use client";

import { useMemo, useRef, useState } from "react";
import {
  AtSign,
  Download,
  Link as LinkIcon,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authenticatedFetch } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StoryMedia = { type: "image" | "video"; url: string; alt?: string };
type OverlayKind = "text" | "mention" | "sticker" | "link";
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
type Tool = "text" | "sticker" | "mention" | "link" | "draw" | "effects" | null;

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
  initialMention = "",
  initialLink = "",
  onNativeFeaturesChange,
}: {
  media: StoryMedia;
  onApplied: (url: string) => void;
  initialMention?: string;
  initialLink?: string;
  onNativeFeaturesChange?: (value: { mention?: string; link?: string }) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [mentionValue, setMentionValue] = useState(initialMention);
  const [linkValue, setLinkValue] = useState(initialLink);
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

  const setNativeMention = (raw: string) => {
    const handle = raw.trim().replace(/^@+/, "").replace(/\s+/g, "");
    if (!handle) return;
    const mention = `@${handle}`;
    setMentionValue(mention);
    onNativeFeaturesChange?.({ mention, link: linkValue.trim() || undefined });
    addOverlay("mention", mention);
  };

  const setNativeLink = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    new URL(normalized);
    setLinkValue(normalized);
    onNativeFeaturesChange?.({ mention: mentionValue.trim() || undefined, link: normalized });
    addOverlay("link", normalized);
  };

  const addOverlay = (kind: OverlayKind, raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    const text = kind === "mention" ? `@${clean.replace(/^@+/, "").replace(/\s+/g, "")}` : kind === "link" ? clean.replace(/^https?:\/\//i, "").replace(/\/$/, "") : clean;
    const item: Overlay = {
      id: uid(kind),
      kind,
      text,
      x: 0.5,
      y: kind === "sticker" ? 0.42 : kind === "link" ? 0.62 : 0.5,
      size: kind === "sticker" ? 72 : kind === "link" ? 38 : 48,
      color: "#ffffff",
    };
    setOverlays((current) => [...current, item]);
    setSelectedId(item.id);
    setTextValue("");
    setMentionValue("");
    setLinkValue("");
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
      // Mention and Link are preview-only native Instagram stickers. Baking them
      // into pixels would make them non-interactive after publishing.
      if (overlay.kind === "mention" || overlay.kind === "link") continue;
      ctx.save();
      const px = overlay.x * canvas.width;
      const py = overlay.y * canvas.height;
      const fontPx = overlay.size * 2.1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = overlay.color;
      ctx.font = overlay.kind === "sticker"
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
    { id: "link" as const, label: "Link", icon: LinkIcon },
    { id: "draw" as const, label: "Draw", icon: PenLine },
    { id: "effects" as const, label: "Effects", icon: Sparkles },
  ];

  const resetStory = () => {
    setOverlays([]);
    setDrawPaths([]);
    setActivePath(null);
    setSelectedId(null);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
  };

  const stage = (
    <div
      ref={stageRef}
      className={cn(
        "relative mx-auto aspect-[9/16] w-full max-w-[360px] touch-none overflow-hidden rounded-[24px] bg-black shadow-2xl",
        tool === "draw" && "cursor-crosshair"
      )}
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
          <polyline key={path.id} fill="none" stroke={path.color} strokeWidth={path.width * 2.6} strokeLinecap="round" strokeLinejoin="round" points={path.points.map((point) => `${point.x * 1000},${point.y * 1777}`).join(" ")} />
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
            "absolute max-w-[88%] -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap rounded-lg px-2 py-1 text-center font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,.65)]",
            selectedId === overlay.id && "ring-2 ring-white/80 ring-offset-2 ring-offset-transparent",
            overlay.kind === "mention" && "bg-black/45",
            overlay.kind === "link" && "bg-white/95 text-[#1687ff] shadow-md drop-shadow-none",
            overlay.kind === "sticker" && "bg-transparent drop-shadow-none"
          )}
          style={{ left: `${overlay.x * 100}%`, top: `${overlay.y * 100}%`, fontSize: `clamp(18px, ${overlay.size / 8}vw, ${overlay.size}px)`, color: overlay.color }}
        >{overlay.text}</button>
      ))}
      <div className="pointer-events-none absolute left-3 right-3 top-3 flex gap-1"><div className="h-0.5 flex-1 rounded-full bg-white/90" /></div>
    </div>
  );

  const toolPanel = (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      {!tool && !selected && <div className="flex min-h-[150px] flex-col items-center justify-center text-center text-xs text-muted-foreground"><ImageIcon className="mb-2 h-7 w-7 opacity-60" /><span>Choose a tool to edit your Story.</span></div>}
      {tool === "text" && <div className="space-y-3"><div className="text-sm font-semibold">Add text</div><textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Type Story text…" className="min-h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary" /><Button type="button" size="sm" onClick={() => addOverlay("text", textValue)}>Add text</Button></div>}
      {tool === "mention" && <div className="space-y-3"><div className="text-sm font-semibold">Instagram @mention</div><input value={mentionValue} onChange={(e) => setMentionValue(e.target.value)} placeholder="@username" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /><Button type="button" size="sm" onClick={() => setNativeMention(mentionValue)}><AtSign className="mr-1 h-4 w-4" />Add mention preview</Button><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] leading-4 text-muted-foreground"><b className="text-foreground">Native feature:</b> this is preview-only in Loomic. It is kept out of the exported pixels so you can add Instagram's real tappable Mention sticker during Finish in Instagram.</div></div>}
      {tool === "link" && <div className="space-y-3"><div className="text-sm font-semibold">Instagram Link</div><input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://example.com" inputMode="url" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /><Button type="button" size="sm" onClick={() => { try { setNativeLink(linkValue); } catch { toast.error("Enter a valid link", { description: "Example: https://example.com" }); } }}><LinkIcon className="mr-1 h-4 w-4" />Add link preview</Button><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] leading-4 text-muted-foreground"><b className="text-foreground">Native feature:</b> this URL is saved with the Story and kept out of the exported pixels. Add it with Instagram's native Link sticker during Finish in Instagram so it is genuinely tappable.</div></div>}
      {tool === "sticker" && <div className="space-y-3"><div className="text-sm font-semibold">Decorative stickers</div><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{STICKERS.map((sticker) => <button key={sticker} type="button" onClick={() => addOverlay("sticker", sticker)} className="rounded-xl border border-border bg-background p-2 text-xl hover:border-primary/50">{sticker}</button>)}</div><p className="text-[11px] text-muted-foreground">Decorative stickers are baked into the Story image for automatic publishing.</p></div>}
      {tool === "draw" && <div className="space-y-4"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Draw</span><Button type="button" variant="ghost" size="sm" onClick={() => setDrawPaths((p) => p.slice(0, -1))}><Eraser className="mr-1 h-4 w-4" />Undo</Button></div><div className="flex flex-wrap gap-2">{["#ffffff", "#111111", "#ff3040", "#ffcf33", "#3bc8ff", "#8e5cff"].map((color) => <button key={color} type="button" onClick={() => setDrawColor(color)} className={cn("h-8 w-8 rounded-full border-2", drawColor === color ? "border-primary" : "border-background")} style={{ backgroundColor: color }} />)}</div><label className="block text-xs text-muted-foreground">Brush size<input type="range" min="3" max="24" value={drawWidth} onChange={(e) => setDrawWidth(Number(e.target.value))} className="mt-2 w-full" /></label></div>}
      {tool === "effects" && <div className="space-y-4"><div className="flex items-center gap-1.5 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4" />Effects</div>{[["Brightness", brightness, setBrightness, 50, 150],["Contrast", contrast, setContrast, 50, 150],["Saturation", saturation, setSaturation, 0, 180],["B&W", grayscale, setGrayscale, 0, 100]].map(([label, value, setter, min, max]) => <label key={String(label)} className="block text-xs text-muted-foreground"><span className="flex justify-between"><span>{String(label)}</span><span>{Number(value)}%</span></span><input type="range" min={Number(min)} max={Number(max)} value={Number(value)} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))} className="mt-2 w-full" /></label>)}</div>}
      {selected && tool !== "draw" && <div className="mt-4 border-t border-border pt-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">Selected element</span><button type="button" onClick={() => { setOverlays((items) => items.filter((item) => item.id !== selected.id)); setSelectedId(null); }} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button></div><label className="block text-xs text-muted-foreground">Size<input type="range" min="24" max="96" value={selected.size} onChange={(e) => updateSelected({ size: Number(e.target.value) })} className="mt-2 w-full" /></label>{selected.kind !== "sticker" && <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">Text color<input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} className="h-8 w-12 rounded border-0 bg-transparent" /></label>}</div>}
    </div>
  );

  return (
    <>
      <div className="min-w-0 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-xl bg-black sm:w-20">
            {media.type === "video" ? <video src={media.url} className="h-full w-full object-cover" muted playsInline /> : <img src={media.url} alt={media.alt || "Story"} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">Story editor</div><div className="mt-1 text-[11px] leading-4 text-muted-foreground">Edit text, stickers, drawings and effects in a full responsive workspace.</div><Button type="button" size="sm" className="mt-3" onClick={() => setEditorOpen(true)}><Sparkles className="mr-1.5 h-4 w-4" />Open Story editor</Button></div>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent showCloseButton={false} className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[94dvh] sm:w-[96vw] sm:max-w-[1180px] sm:rounded-2xl sm:border">
          <DialogHeader className="sr-only"><DialogTitle>Instagram Story editor</DialogTitle><DialogDescription>Edit and prepare a Story for publishing.</DialogDescription></DialogHeader>
          <div className="flex h-full min-h-0 flex-col bg-muted/20">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5 sm:px-5 sm:py-3">
              <div className="min-w-0"><div className="truncate text-sm font-semibold sm:text-base">Create Instagram Story</div><div className="hidden text-[11px] text-muted-foreground sm:block">9:16 editor • automatic Story publishing</div></div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2"><Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex" onClick={resetStory}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button><Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => void downloadStory()} disabled={media.type !== "image"}><Download className="mr-1 h-4 w-4" />Download</Button><button type="button" aria-label="Close editor" onClick={() => setEditorOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button></div>
            </div>

            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 sm:justify-center sm:px-4">
              {toolbar.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTool((current) => current === id ? null : id)} className={cn("flex min-w-[70px] shrink-0 flex-col items-center gap-1 rounded-xl border border-transparent px-2 py-2 text-[10px] transition hover:bg-muted sm:min-w-[82px]", tool === id && "border-primary/30 bg-primary/10 text-primary")}><Icon className="h-5 w-5" />{label}</button>)}
              <button type="button" onClick={() => void downloadStory()} className="flex min-w-[70px] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] hover:bg-muted sm:hidden"><Download className="h-5 w-5" />Download</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:overflow-hidden lg:p-5">
              <div className="mx-auto grid min-h-full w-full max-w-[1080px] gap-4 lg:grid-cols-[minmax(300px,1fr)_minmax(280px,360px)] lg:items-center">
                <div className="min-w-0 lg:order-2">{stage}</div>
                <div className="min-w-0 lg:order-1">{toolPanel}<div className="mt-3 rounded-xl border border-border bg-card p-3 text-[11px] leading-4 text-muted-foreground"><div className="font-semibold text-foreground">Native Instagram features</div><div className="mt-1">Mention, Music, Link, Poll and other native Story stickers cannot be created by baking pixels into the media. For those, prepare the Story here and finish that sticker inside Instagram.</div></div></div>
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-card px-3 py-2.5 sm:px-5 sm:py-3"><div className="mx-auto flex max-w-[1080px] flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={resetStory}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button><Button type="button" variant="outline" size="sm" onClick={() => setEditorOpen(false)}>Close</Button></div><Button type="button" size="sm" onClick={() => void applyStory()} disabled={exporting || media.type !== "image"} className="bg-gradient-to-r from-primary to-accent text-white">{exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}{exporting ? "Applying…" : "Apply Story design"}</Button></div></div>
          </div>
        </DialogContent>
      </Dialog>

      {media.type === "video" && <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-4 text-muted-foreground">Video Story preview is supported, but Loomic keeps the original video for automatic publishing. Native Instagram stickers should be finished in Instagram.</div>}
    </>
  );
}
