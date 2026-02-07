export type CoachReview = {
  highlights: string[];
  actions: string[];
  notes: string;
  approvedAt: string;
};

const STORAGE_KEY = "coachReview:v1";

export const loadReview = (): CoachReview | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CoachReview;
    if (!parsed?.highlights || !parsed?.actions) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveReview = (review: CoachReview) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(review));
};

export const clearReview = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};
