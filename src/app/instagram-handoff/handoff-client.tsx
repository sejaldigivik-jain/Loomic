"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Download, Instagram, Link as LinkIcon, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function InstagramHandoffClient() {
  const params = useSearchParams();
  const media = params.get("media") ?? "";
  const type = params.get("type") === "video" ? "video" : "image";
  const mention = params.get("mention") ?? "";
  const link = params.get("link") ?? "";
  const hasData = Boolean(media);

  const nativeCopy = useMemo(() => [link, mention].filter(Boolean).join("\n"), [link, mention]);

  const copy = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  };

  const openInstagram = () => {
    // Mobile browsers may allow the Instagram deep link when triggered by a tap.
    window.location.href = "instagram://camera";
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = "https://www.instagram.com/";
    }, 1200);
  };

  if (!hasData) {
    return <main className="mx-auto max-w-lg p-6"><h1 className="text-xl font-semibold">Story handoff unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Open Finish in Instagram from Loomic again and scan the new QR code.</p></main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-background p-4 pb-10">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Loomic</div>
        <h1 className="mt-1 text-2xl font-semibold">Finish in Instagram</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your Story is prepared. Complete the native sticker inside Instagram.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-black">
        {type === "video" ? <video src={media} controls playsInline className="max-h-[58vh] w-full object-contain" /> : <img src={media} alt="Prepared Instagram Story" className="max-h-[58vh] w-full object-contain" />}
      </div>

      <div className="mt-4 grid gap-3">
        <Button asChild variant="outline" className="h-11"><a href={media} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Open / save Story media</a></Button>
        {link && <Button variant="outline" className="h-11 justify-start" onClick={() => copy(link, "Link")}><LinkIcon className="mr-2 h-4 w-4" /><span className="min-w-0 flex-1 truncate text-left">{link}</span><Copy className="ml-2 h-4 w-4" /></Button>}
        {mention && <Button variant="outline" className="h-11 justify-start" onClick={() => copy(mention, "Mention")}><AtSign className="mr-2 h-4 w-4" /><span className="min-w-0 flex-1 truncate text-left">{mention}</span><Copy className="ml-2 h-4 w-4" /></Button>}
        {nativeCopy && <Button variant="secondary" className="h-11" onClick={() => copy(nativeCopy, "Sticker details")}><Copy className="mr-2 h-4 w-4" />Copy all sticker details</Button>}
        <Button className="h-12" onClick={openInstagram}><Instagram className="mr-2 h-5 w-5" />Open Instagram</Button>
      </div>

      <div className="mt-5 rounded-2xl border bg-muted/30 p-4 text-sm">
        <div className="font-semibold">Final steps</div>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>Save the Story media to your phone if Instagram cannot pick it directly.</li>
          <li>Tap Open Instagram and create a new Story.</li>
          <li>Select the prepared media.</li>
          {link && <li>Add Instagram's Link sticker and paste the copied URL.</li>}
          {mention && <li>Add Instagram's Mention sticker and paste/type the copied username.</li>}
          <li>Share the Story from Instagram.</li>
        </ol>
      </div>
    </main>
  );
}
