export interface IProgress {
  isDownloading: boolean;
  current: number;
  total: number;
}

export interface CancellablePromise<T> extends Promise<T> {
  cancel: () => void;
}

export type QueryPromise = CancellablePromise<string | boolean>;
