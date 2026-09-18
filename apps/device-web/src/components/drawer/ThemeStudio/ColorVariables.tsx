import React from "react";
import { EditPencilIcon } from "../../common/Icons";
import type { ColorVariable } from "../../../types/player-ui";

type ColorVariablesProps = {
  variables: ColorVariable[];
  onChangeColor: (id: string, newColor: string) => void;
};

export const ColorVariables: React.FC<ColorVariablesProps> = ({
  variables,
  onChangeColor,
}) => {
  return (
    <div className="ahoy-theme-section ahoy-color-variables">
      <h3 className="ahoy-theme-section-title">Color variable</h3>
      <div className="ahoy-color-variable-list">
        {variables.map((item) => (
          <div key={item.id} className="ahoy-color-variable-row">
            <div
              className="ahoy-color-swatch-box"
              style={{ backgroundColor: item.value }}
            />
            <span className="ahoy-color-hex-text">{item.value.toUpperCase()}</span>
            <label className="ahoy-color-edit-label" title={`Edit color for ${item.name}`}>
              <input
                type="color"
                className="ahoy-color-native-input"
                value={item.value.length === 7 ? item.value : "#ffffff"}
                onChange={(e) => onChangeColor(item.id, e.target.value)}
                aria-label={`Choose color for ${item.name}`}
              />
              <span className="ahoy-color-edit-btn">
                <EditPencilIcon size={14} />
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
