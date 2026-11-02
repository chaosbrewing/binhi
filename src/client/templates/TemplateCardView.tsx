import type { TemplateCard } from "../api.js";
import { I } from "../components/Icons.js";
import { cardMeta } from "./labels.js";

/** A template card: one preview button, one favorite toggle. Thumbnails load lazily and keep their aspect ratio so the grid never jumps. */
export function TemplateCardView({ card, favorite, onPreview, onToggleFavorite }: { card: TemplateCard; favorite: boolean; onPreview: (card: TemplateCard) => void; onToggleFavorite: (card: TemplateCard) => void }) {
  const ratio = card.size.kind === "fixed" ? `${card.size.width} / ${card.size.height}` : "4 / 3";
  return (
    <li className="tpl-card">
      <button type="button" className="tpl-thumb" onClick={() => onPreview(card)} aria-label={`Preview ${card.name}`} style={{ aspectRatio: ratio }}>
        {card.thumbnail ? (
          <img src={card.thumbnail} alt={card.thumbnailAlt} loading="lazy" decoding="async" />
        ) : (
          <span className="tpl-thumb-fallback" aria-hidden="true" style={{ background: card.palette[1] ?? "#eee", color: card.palette[0] ?? "#111" }}>{card.name}</span>
        )}
      </button>
      <div className="tpl-card-body">
        <div className="tpl-card-title">
          <h3>{card.name}</h3>
          <button type="button" className={`icon-btn tpl-fav${favorite ? " is-on" : ""}`} aria-pressed={favorite} aria-label={favorite ? `Remove ${card.name} from favorites` : `Add ${card.name} to favorites`} onClick={() => onToggleFavorite(card)}>
            <I.star fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <p className="tpl-meta">{cardMeta(card)}</p>
        <p className="tpl-tools">{card.editorLabel}{card.featured ? <span className="badge badge-ok">Featured</span> : null}</p>
      </div>
    </li>
  );
}
