import { FlagBadge } from "./icons";
import type { FlagOptions } from "../types";

export function GuildFlagBuilder({
  options,
  name,
  color,
  decal,
  onNameChange,
  onColorChange,
  onDecalChange,
}: {
  options: FlagOptions;
  name: string;
  color: string;
  decal: string;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onDecalChange: (v: string) => void;
}) {
  return (
    <div className="flag-builder">
      <div className="flag-builder__preview">
        <FlagBadge color={color} decal={decal} size={64} />
      </div>

      <label htmlFor="guild-name">Guild name</label>
      <input id="guild-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Ironhold Company" maxLength={40} />

      <label>Banner color</label>
      <div className="swatch-grid">
        {options.colors.map((c) => (
          <button
            key={c}
            type="button"
            className={"swatch-btn" + (c === color ? " swatch-btn--active" : "")}
            style={{ background: c }}
            aria-label={c}
            onClick={() => onColorChange(c)}
          />
        ))}
      </div>

      <label>Emblem</label>
      <div className="decal-grid">
        {options.decals.map((d) => (
          <button
            key={d}
            type="button"
            className={"decal-btn" + (d === decal ? " decal-btn--active" : "")}
            onClick={() => onDecalChange(d)}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
