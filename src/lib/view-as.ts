const KEY = "reach_view_as_client";

export function startViewAsClient(brandName: string) {
  sessionStorage.setItem(KEY, brandName);
}

export function stopViewAsClient() {
  sessionStorage.removeItem(KEY);
}

export function isViewingAsClient(): boolean {
  if (typeof window === "undefined") return false;
  return !!sessionStorage.getItem(KEY);
}

export function viewingAsClientBrandName(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}
