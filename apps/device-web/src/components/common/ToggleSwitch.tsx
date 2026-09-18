import React from "react";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  ariaLabel?: string;
};

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  ariaLabel = "Toggle switch",
}) => {
  return (
    <label className="ahoy-toggle-switch">
      {label && <span className="ahoy-toggle-label">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className={`ahoy-toggle-track ${checked ? "is-checked" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="ahoy-toggle-thumb" />
      </button>
    </label>
  );
};
