// In-memory store for room passwords (set by admin, lost on refresh)
const roomPasswords: Record<string, string> = {};

export function setRoomPassword(room: string, password: string) {
  roomPasswords[room] = password;
}

export function getRoomPassword(room: string): string | undefined {
  return roomPasswords[room];
}

export function getAllRoomPasswords(): Record<string, string> {
  return { ...roomPasswords };
}

export function deleteRoomPassword(room: string) {
  delete roomPasswords[room];
}
