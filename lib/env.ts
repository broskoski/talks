function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  get arenaToken() {
    return required("ARENA_TOKEN");
  },
  get arenaGroup() {
    return required("ARENA_GROUP");
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
};
