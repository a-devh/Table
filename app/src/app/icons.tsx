// Small inline stroke icons. Decorative: buttons carry their own aria-label.
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const SearchIcon = () => (
  <svg {...base}><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
);
export const StarIcon = () => (
  <svg {...base}><polygon points="12,3 14.8,9 21,9.6 16.3,13.8 17.7,20 12,16.8 6.3,20 7.7,13.8 3,9.6 9.2,9" /></svg>
);
export const HeartIcon = () => (
  <svg {...base}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
);
export const BoxIcon = () => (
  <svg {...base}><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M7 7V4h10v3" /></svg>
);
export const GearIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
);
export const ExitIcon = () => (
  <svg {...base}><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4" /><line x1="6" y1="12" x2="15" y2="12" /></svg>
);
export const HandIcon = () => (
  <svg {...base} width={18} height={18}><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12" /><path d="M14 10.5a1.5 1.5 0 0 1 3 0V12" /><path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.3 15a1.6 1.6 0 0 1 2.6-1.8L8 15" /></svg>
);
export const PencilIcon = () => (
  <svg {...base} width={18} height={18}><path d="M16.5 3.5l4 4L8 20H4v-4z" /><line x1="13.5" y1="6.5" x2="17.5" y2="10.5" /></svg>
);
export const GridIcon = () => (
  <svg {...base} width={18} height={18}><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
);
export const FitIcon = () => (
  <svg {...base} width={16} height={16}><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
);

export const UndoIcon = () => (
  <svg {...base} width={16} height={16}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
);

export const RedoIcon = () => (
  <svg {...base} width={16} height={16}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
);
export const SunIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const MoonIcon = () => (
  <svg {...base}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
);
export const TableIcon = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><rect x="7" y="8.5" width="4" height="6" rx="0.8" /><rect x="13" y="9.5" width="4" height="6" rx="0.8" /></svg>
);
export const SelectIcon = () => (
  <svg {...base}><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" /><path d="M10 9l6 3-2.6 1 1.6 3-1.4.7-1.6-3L10 15z" /></svg>
);
export const MoreIcon = () => (
  <svg {...base}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>
);
export const FlipIcon = () => (
  <svg {...base}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" /><path d="M4 20v-5h5" /></svg>
);
