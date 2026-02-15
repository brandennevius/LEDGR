const CATEGORY_COLOR_PALETTE = [
  "#3B82F6",
  "#06B6D4",
  "#10B981",
  "#84CC16",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#6366F1",
] as const;

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

export const isHexColor = (value?: string | null) =>
  Boolean(value && HEX_COLOR_REGEX.test(value.trim()));

export const normalizeHexColor = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return null;
  return `#${trimmed.slice(1).toUpperCase()}`;
};

const hashCategoryName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const defaultCategoryColor = (name: string) => {
  const idx = hashCategoryName(name) % CATEGORY_COLOR_PALETTE.length;
  return CATEGORY_COLOR_PALETTE[idx];
};

export const resolveCategoryColor = (name: string, color?: string | null) =>
  normalizeHexColor(color) ?? defaultCategoryColor(name);

export const categoryColorPalette = CATEGORY_COLOR_PALETTE;
