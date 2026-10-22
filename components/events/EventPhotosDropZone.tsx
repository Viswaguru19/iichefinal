'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { imageFilesFromDataTransfer } from '@/lib/event-photos';

type Props = {
  children: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  onFiles: (files: File[]) => void;
  className?: string;
  hint?: string;
};

export default function EventPhotosDropZone({
  children,
  disabled,
  busy,
  busyLabel,
  onFiles,
  className = '',
  hint = 'Drop photos here',
}: Props) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    depth.current += 1;
    setOver(true);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    depth.current = 0;
    setOver(false);
    if (disabled) return;
    const files = await imageFilesFromDataTransfer(e.dataTransfer);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative rounded-2xl transition-colors ${
        over ? 'ring-2 ring-purple-500 ring-offset-2 bg-purple-50/80' : ''
      } ${className}`}
    >
      {children}
      {over && !disabled && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-purple-500 bg-purple-600/15">
          <p className="text-sm font-semibold text-purple-800 px-4 text-center">{hint}</p>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/70">
          <p className="text-sm font-semibold text-purple-800">{busyLabel || 'Uploading…'}</p>
        </div>
      )}
    </div>
  );
}
