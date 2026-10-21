import React from 'react';
import { hexToRgb, normalizeHexColor, PRESET_ACCENT_COLORS, rgbToHex } from '../domain/color';

export const CustomColorPopover: React.FC<{
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}> = ({ color, onChange, onClose }) => {
  const { r, g, b } = hexToRgb(color);
  const handleChange = (nr: number, ng: number, nb: number) => {
    onChange(rgbToHex(nr, ng, nb));
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={{ boxShadow: 'var(--shadow-elevated)' }}
        className="absolute top-[calc(100%+8px)] left-0 z-50 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] w-[260px] animate-pop-in space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[var(--text)]">Ajustar Cor</span>
          <div
            className="w-6 h-6 rounded-lg shadow-inner border border-[var(--border)]"
            style={{ backgroundColor: normalizeHexColor(color) }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_ACCENT_COLORS.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => onChange(p.hex)}
              style={{ backgroundColor: p.hex }}
              className="w-6 h-6 rounded-lg cursor-pointer border border-black/10 dark:border-white/10 shadow-sm hover:scale-110 transition-transform btn-press"
              title={p.name}
            />
          ))}
        </div>

        <div className="space-y-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-bold text-rose-500 w-3 text-center">R</span>
            <input
              type="range"
              min="0"
              max="255"
              value={r}
              onChange={(e) => handleChange(Number(e.target.value), g, b)}
              className="flex-1 accent-rose-500 cursor-pointer h-1.5 bg-[var(--surface-2)] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-rose-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-bold text-emerald-500 w-3 text-center">G</span>
            <input
              type="range"
              min="0"
              max="255"
              value={g}
              onChange={(e) => handleChange(r, Number(e.target.value), b)}
              className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-[var(--surface-2)] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-bold text-blue-500 w-3 text-center">B</span>
            <input
              type="range"
              min="0"
              max="255"
              value={b}
              onChange={(e) => handleChange(r, g, Number(e.target.value))}
              className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-[var(--surface-2)] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>
      </div>
    </>
  );
};