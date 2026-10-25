import { useEffect, useId, useState } from "react";
import { getIcon, getLoadedShape, loadIconShape, renderIconSvg, type IconGradient, type IconVariant } from "../../core/icons/index.js";
import type { IconNode } from "../../core/icons/types.js";

export interface IconGlyphProps {
  id: string;
  size?: number;
  variant?: IconVariant;
  strokeWidth?: number;
  color?: string;
  gradient?: IconGradient;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Meaningful icons get a label (role=img); omit for decoration. */
  label?: string;
  className?: string;
}

function useShape(id: string): readonly IconNode[] | undefined {
  const [shape, setShape] = useState(() => getLoadedShape(id));
  useEffect(() => {
    let alive = true;
    const cached = getLoadedShape(id);
    setShape(cached);
    if (!cached) {
      loadIconShape(id)
        .then((nodes) => alive && setShape(nodes))
        .catch(() => undefined); // offline / chunk failed: keep the empty placeholder
    }
    return () => {
      alive = false;
    };
  }, [id]);
  return shape;
}

/**
 * Renders a library icon with the same SVG builder the published site and the Design Studio export use.
 * The markup comes only from registry geometry that passed the allowlist, never from user text.
 */
export function IconGlyph({ id, size = 24, variant, strokeWidth, color, gradient, rotation, flipX, flipY, label, className }: IconGlyphProps) {
  const shape = useShape(id);
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  const def = getIcon(id);
  const box = { width: size, height: size };
  if (!def || !shape) return <span className={`icon-glyph icon-glyph-empty ${className ?? ""}`} style={box} aria-hidden="true" />;
  const effective = variant && def.variants.includes(variant) ? variant : "outline";
  const svg = renderIconSvg(shape, { variant: effective, size, strokeWidth, color, gradient, rotation, flipX, flipY, label, idPrefix: `ig${uid}` });
  return <span className={`icon-glyph ${className ?? ""}`} style={box} dangerouslySetInnerHTML={{ __html: svg }} />;
}
