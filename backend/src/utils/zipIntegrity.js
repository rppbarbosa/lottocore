/** Assinatura little-endian do "End of central directory record" (PK\x05\x06). */
const EOCD_SIG = 0x06054b50;

/**
 * Verifica se o buffer parece um ZIP completo: encontra o EOCD e confirma que
 * o comentário opcional termina exatamente no fim do ficheiro (APPNOTE).
 * @param {Buffer} buf
 */
export function zipBufferLooksComplete(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return false;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) !== EOCD_SIG) continue;
    const commentLen = buf.readUInt16LE(i + 20);
    if (i + 22 + commentLen === buf.length) return true;
  }
  return false;
}
