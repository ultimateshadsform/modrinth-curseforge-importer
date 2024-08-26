class Store<T> {
  private store: Map<string, T>;

  constructor() {
    this.store = new Map<string, T>();
  }

  set(key: string, value: T): void {
    this.store.set(key, value);
  }

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  reset(): void {
    this.store.clear();
  }
}

export default Store;
