import React from "react";
import { ToggleSwitch } from "../../common/ToggleSwitch";

type CustomCssEditorProps = {
  isAdvanced: boolean;
  onToggleAdvanced: (val: boolean) => void;
  cssCode: string;
  onChangeCss: (val: string) => void;
};

export const CustomCssEditor: React.FC<CustomCssEditorProps> = ({
  isAdvanced,
  onToggleAdvanced,
  cssCode,
  onChangeCss,
}) => {
  const lines = cssCode.split("\n");
  const minLines = Math.max(7, lines.length);

  return (
    <div className="ahoy-theme-section ahoy-custom-css-section">
      <div className="ahoy-advanced-toggle-row">
        <h3 className="ahoy-theme-section-title">Advanced</h3>
        <ToggleSwitch
          checked={isAdvanced}
          onChange={onToggleAdvanced}
          ariaLabel="Toggle advanced theme options"
        />
      </div>

      {isAdvanced && (
        <div className="ahoy-custom-css-wrapper">
          <label className="ahoy-custom-css-label" htmlFor="ahoy-custom-css-textarea">
            Custom CSS
          </label>
          <div className="ahoy-code-editor">
            <div className="ahoy-code-gutters" aria-hidden="true">
              {Array.from({ length: minLines }).map((_, i) => (
                <div key={i} className="ahoy-gutter-number">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              id="ahoy-custom-css-textarea"
              className="ahoy-code-textarea"
              value={cssCode}
              onChange={(e) => onChangeCss(e.target.value)}
              spellCheck="false"
              rows={minLines}
              aria-label="Custom CSS code editor"
            />
          </div>
        </div>
      )}
    </div>
  );
};
