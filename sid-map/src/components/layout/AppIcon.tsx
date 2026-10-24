'use client';

import { useState } from 'react';
import { iconPath } from '@/lib/apps';
import { Glyph } from '@/components/icons/SidIcon';

// Affiche /public/apps/<id>.png ; retombe sur l'icône dessinée du S.I.D. (ou l'emoji) si le fichier n'existe pas.
export default function AppIcon({ id, emoji, size = 56 }: { id: string; emoji: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className="flex items-center justify-center" style={{ width: size, height: size, fontSize: size * 0.62 }}>
        <Glyph e={emoji} size={size * 0.8} />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconPath(id)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
