import React from 'react';

interface LogoProps {
  size?: number;
  fixedBrandColor?: boolean;
  showWordmark?: boolean;
  collapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  fixedBrandColor = false,
  showWordmark = true,
  collapsed = false,
}) => {
  const fillStyle = fixedBrandColor ? '#1c3cee' : 'var(--accent)';
  const checkStyle = fixedBrandColor ? '#ffffff' : 'var(--on-accent)';

  return (
    <div className="inline-flex items-center gap-2.5 select-none shrink-0 group">
      <div
        className="relative flex items-center justify-center shrink-0 rounded-[11px] shadow-xs transition-all duration-300 group-hover:scale-[1.05] group-hover:rotate-[-2deg]"
        style={{
          width: size,
          height: size,
          boxShadow: fixedBrandColor
            ? '0 4px 12px -2px rgba(28, 60, 238, 0.35)'
            : '0 4px 12px -2px var(--accent-glow)',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect width="36" height="36" rx="11" style={{ fill: fillStyle }} />
          <rect
            x="0.75"
            y="0.75"
            width="34.5"
            height="34.5"
            rx="10.25"
            stroke="white"
            strokeOpacity="0.22"
            strokeWidth="1.5"
          />
          <path
            d="M11.5 18.5L16 23L25 13.5"
            style={{ stroke: checkStyle }}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showWordmark && !collapsed && (
        <span className="font-extrabold text-[17px] tracking-tight text-[var(--text)] whitespace-nowrap transition-colors">
          In Task
        </span>
      )}
    </div>
  );
};