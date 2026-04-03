const STORAGE_KEY = "admin-room-passwords";

function load(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function save(data: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function setRoomPassword(room: string, password: string) {
  const data = load();
  data[room] = password;
  save(data);
}

export function getRoomPassword(room: string): string | undefined {
  return load()[room];
}

export function getAllRoomPasswords(): Record<string, string> {
  return load();
}

export function deleteRoomPassword(room: string) {
  const data = load();
  delete data[room];
  save(data);
}
