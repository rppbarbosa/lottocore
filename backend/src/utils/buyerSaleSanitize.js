/** Limites e sanitização de dados de comprador na venda (defesa em profundidade). */

const MAX = {
  name: 200,
  phoneDigits: 11,
  email: 254,
  cepDigits: 8,
  street: 200,
  streetNumber: 30,
  complement: 120,
  neighborhood: 120,
  city: 100,
  state: 2,
  seller: 200,
  addressLegacy: 2000,
};

const CTRL_OR_ANGLE = /[\x00-\x08\x0B\x0C\x0E-\x1F<>]/g;
const MULTISPACE = /\s{2,}/g;

/**
 * @param {unknown} v
 * @param {number} maxLen
 * @returns {string | null}
 */
export function sanitizePlainText(v, maxLen) {
  if (typeof v !== 'string') return null;
  let t = v.replace(CTRL_OR_ANGLE, ' ').replace(MULTISPACE, ' ').trim();
  if (!t) return null;
  if (t.length > maxLen) t = t.slice(0, maxLen);
  return t;
}

/** @param {unknown} v */
export function digitsOnly(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/\D/g, '');
}

/** @param {unknown} v — CEP; vazio ok */
export function normalizeCep(v) {
  const d = digitsOnly(v);
  if (!d) return null;
  if (d.length !== MAX.cepDigits) {
    const err = new Error('CEP deve ter 8 dígitos');
    err.statusCode = 400;
    throw err;
  }
  return d;
}

/** @param {unknown} v — telefone BR; vazio ok */
export function normalizePhoneBr(v) {
  const d = digitsOnly(v);
  if (!d) return null;
  if (d.length < 10 || d.length > MAX.phoneDigits) {
    const err = new Error('Telefone inválido (use DDD + número, 10 ou 11 dígitos)');
    err.statusCode = 400;
    throw err;
  }
  return d;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @param {unknown} v */
export function normalizeEmail(v) {
  const t = sanitizePlainText(v, MAX.email);
  if (!t) return null;
  if (!EMAIL_RE.test(t)) {
    const err = new Error('E-mail inválido');
    err.statusCode = 400;
    throw err;
  }
  return t.toLowerCase();
}

/** @param {unknown} v — UF; vazio ok */
export function normalizeUf(v) {
  if (typeof v !== 'string') return null;
  const t = v.replace(CTRL_OR_ANGLE, '').trim().toUpperCase();
  if (!t) return null;
  if (t.length !== 2 || !/^[A-Z]{2}$/.test(t)) {
    const err = new Error('Estado (UF) inválido');
    err.statusCode = 400;
    throw err;
  }
  return t;
}

/**
 * Monta uma linha única para buyer_address (relatórios / compatibilidade).
 * @param {{
 *   street: string | null,
 *   streetNumber: string | null,
 *   complement: string | null,
 *   neighborhood: string | null,
 *   city: string | null,
 *   state: string | null,
 * }} p
 */
export function composeBuyerAddressLine(p) {
  let s = '';
  if (p.street) s += p.street;
  if (p.streetNumber) s += (s ? ', ' : '') + p.streetNumber;
  if (p.complement) s += (s ? ' — ' : '') + p.complement;
  if (p.neighborhood) s += (s ? ' — ' : '') + p.neighborhood;
  const loc = [p.city, p.state].filter(Boolean).join('/');
  if (loc) s += (s ? ' — ' : '') + loc;
  return s || null;
}

/**
 * Extrai e valida campos de comprador/endereço do body da API.
 * @param {Record<string, unknown>} body
 */
export function parseSanitizedSaleBuyerPayload(body) {
  const name = sanitizePlainText(body.buyerName ?? body.buyer_name, MAX.name);
  const wa = normalizePhoneBr(body.buyerWhatsapp ?? body.buyer_whatsapp ?? body.buyerContact ?? body.buyer_contact);
  const email = normalizeEmail(body.buyerEmail ?? body.buyer_email);
  const cep = normalizeCep(body.buyerCep ?? body.buyer_cep);
  const seller = sanitizePlainText(body.sellerName ?? body.seller_name, MAX.seller);

  const street = sanitizePlainText(
    body.buyerStreet ?? body.buyer_street,
    MAX.street,
  );
  const streetNumber = sanitizePlainText(
    body.buyerStreetNumber ?? body.buyer_street_number,
    MAX.streetNumber,
  );
  const complement = sanitizePlainText(
    body.buyerAddressComplement ?? body.buyer_address_complement,
    MAX.complement,
  );
  const neighborhood = sanitizePlainText(
    body.buyerNeighborhood ?? body.buyer_neighborhood,
    MAX.neighborhood,
  );
  const city = sanitizePlainText(body.buyerCity ?? body.buyer_city, MAX.city);
  const state = normalizeUf(body.buyerState ?? body.buyer_state);

  const legacyAddress = sanitizePlainText(
    body.buyerAddress ?? body.buyer_address,
    MAX.addressLegacy,
  );

  const hasStructured = !!(
    street ||
    streetNumber ||
    complement ||
    neighborhood ||
    city ||
    state
  );

  let buyer_address;
  if (hasStructured) {
    buyer_address = composeBuyerAddressLine({
      street,
      streetNumber,
      complement,
      neighborhood,
      city,
      state,
    });
  } else if (legacyAddress) {
    buyer_address = legacyAddress;
  } else {
    buyer_address = null;
  }

  return {
    buyer_name: name,
    buyer_whatsapp: wa,
    buyer_email: email,
    buyer_cep: cep,
    buyer_address,
    buyer_street: hasStructured ? street : null,
    buyer_street_number: hasStructured ? streetNumber : null,
    buyer_address_complement: hasStructured ? complement : null,
    buyer_neighborhood: hasStructured ? neighborhood : null,
    buyer_city: hasStructured ? city : null,
    buyer_state: hasStructured ? state : null,
    seller_name: seller,
  };
}
