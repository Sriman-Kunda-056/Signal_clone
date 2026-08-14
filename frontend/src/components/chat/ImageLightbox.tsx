"use client";

import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

/** Full-bleed image viewer — deliberately chrome-less (no title bar) unlike
 * the generic Modal, since a photo viewer should just be the photo. */
export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 rounded-full p-2 hover:bg-white/10">
        <X className="h-6 w-6 text-white" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- data-URL image, next/image can't optimize it */}
      <img
        src={src}
        alt="Attachment"
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
