const TOKEN_MIN = 8;
const TOKEN_MAX = 36;

/** Valida token na URL pública (folha). */
export function isReasonablePublicToken(t) {
  if (typeof t !== 'string' || t.length < TOKEN_MIN || t.length > TOKEN_MAX) {
    return false;
  }
  return /^[A-Za-z0-9_-]+$/.test(t);
}
