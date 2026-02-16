/** @file packages/shared-types/generics.ts */
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;