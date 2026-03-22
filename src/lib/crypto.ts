import CryptoJS from "crypto-js";

export function encryptMessage(message: string, password: string): string {
  return CryptoJS.AES.encrypt(message, password).toString();
}

export function decryptMessage(ciphertext: string, password: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return ciphertext; // wrong password
    return decrypted;
  } catch {
    return ciphertext; // wrong password shows encrypted text
  }
}
