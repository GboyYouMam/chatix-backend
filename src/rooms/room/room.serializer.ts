export function toPublicRoom<T extends { password?: string | null }>(
  room: T,
): Omit<T, 'password'> & { hasPassword: boolean } {
  const { password, ...publicRoom } = room;
  return { ...publicRoom, hasPassword: Boolean(password) };
}
