"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageError, prepareImageForAi, type AiImage } from "@/lib/image";

interface PhotoPickerProps {
  /** The resized photo ready for `requestAiParse`, or null when removed. */
  onChange: (photo: AiImage | null) => void;
  disabled?: boolean;
}

export function PhotoPicker({ onChange, disabled = false }: PhotoPickerProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<AiImage | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const prepared = await prepareImageForAi(file);
      setPhoto(prepared);
      onChange(prepared);
    } catch (e) {
      setError(e instanceof ImageError ? e.message : "Can't open this image");
    } finally {
      setProcessing(false);
    }
  }

  function remove() {
    setPhoto(null);
    setError(null);
    onChange(null);
  }

  const busy = disabled || processing;

  return (
    <div className="flex flex-col gap-3">
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={handleFile} />
      <input ref={galleryInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={handleFile} />

      {photo ? (
        <div className="relative overflow-hidden rounded-md border border-border">
          {/* A small local data URL: next/image optimization does not apply. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:${photo.mimeType};base64,${photo.image}`} alt="Selected photo" className="max-h-72 w-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 size-11"
            aria-label="Remove photo"
            disabled={busy}
            onClick={remove}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => cameraInput.current?.click()}>
            <Camera aria-hidden />
            Take photo
          </Button>
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => galleryInput.current?.click()}>
            <ImageIcon aria-hidden />
            Gallery
          </Button>
        </div>
      )}

      {processing && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Preparing photo…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
