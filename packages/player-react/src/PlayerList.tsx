import type { PlayerListItem } from "./useAhoyPlayer";

export function PlayerList({
  items,
  focusIndex,
  onActivate,
  emptyLabel = "Nothing here yet"
}: {
  items: PlayerListItem[];
  focusIndex: number;
  onActivate: (index: number) => void;
  emptyLabel?: string;
}) {
  if (items.length === 0) return <p className="player-list__empty">{emptyLabel}</p>;
  return (
    <ol className="player-list" aria-label="Current view">
      {items.map((item, index) => (
        <li key={item.id}>
          <button
            className={index === focusIndex ? "player-list__item is-focused" : "player-list__item"}
            type="button"
            aria-current={index === focusIndex ? "true" : undefined}
            onClick={() => onActivate(index)}
          >
            <span className="player-list__meta">{item.meta ?? String(index + 1).padStart(2, "0")}</span>
            <span className="player-list__copy">
              <strong>{item.primary}</strong>
              {item.secondary && <small>{item.secondary}</small>}
            </span>
            <span className="player-list__mark" aria-hidden="true">◆</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
