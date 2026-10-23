const store: Record<string, string> = {};

const asyncStorageMock = {
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete store[key];
  }),
  clear: jest.fn(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
  getAllKeys: jest.fn(async () => Object.keys(store)),
};

export default asyncStorageMock;
