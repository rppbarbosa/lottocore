const AUTH_TOKEN_KEY = 'lottocore_auth_token'

export function getStoredAuthToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredAuthToken(token: string) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredAuthToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  body?: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

function notifyAuthExpired() {
  try {
    window.dispatchEvent(new CustomEvent('lottocore:auth-expired'))
  } catch {
    /* ignore */
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit & { authToken?: string | null } = {},
): Promise<Response> {
  const { authToken, headers: h, ...rest } = init
  const headers = new Headers(h)
  const token = authToken !== undefined ? authToken : getStoredAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (rest.body && typeof rest.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, { ...rest, headers })
  if (res.status === 401 && token) {
    clearStoredAuthToken()
    notifyAuthExpired()
  }
  return res
}

const API_DOWN_MSG =
  'Servidor da API indisponível. Na raiz do projeto: npm run dev (API + frontend) ou npm run dev:backend (só API na porta 3003).'

/** Primeiros bytes de um PDF válido (%PDF). */
export function isPdfArrayBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 5) return false
  const u = new Uint8Array(buf)
  return u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46
}

function parseFilenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null
  const utf8 = /filename\*=UTF-8''([^;\s]+)/i.exec(cd)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      return utf8[1]
    }
  }
  const q = /filename="([^"]+)"/.exec(cd)
  if (q) return q[1]
  const plain = /filename=([^;\s]+)/.exec(cd)
  return plain ? plain[1].replace(/^"|"$/g, '') : null
}

/**
 * Obtém PDF binário autenticado; valida assinatura %PDF (evita guardar JSON/HTML como .pdf).
 */
export async function apiFetchPdf(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(path)
  const buf = await res.arrayBuffer()
  if (!res.ok) {
    let message = res.statusText || 'Erro ao obter PDF'
    try {
      const text = new TextDecoder().decode(buf.slice(0, 4096))
      const j = JSON.parse(text) as { error?: string }
      if (typeof j?.error === 'string') message = j.error
    } catch {
      /* corpo não é JSON */
    }
    throw new ApiError(message, res.status)
  }
  if (!isPdfArrayBuffer(buf)) {
    throw new ApiError(
      'A resposta não é um PDF válido. Confirme que o backend está na porta 3003 e que o pedido não passou por um proxy que altere o ficheiro.',
      res.status,
    )
  }
  const filename =
    parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ?? 'folha.pdf'
  return { blob: new Blob([buf], { type: 'application/pdf' }), filename }
}

export function isPngArrayBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false
  const u = new Uint8Array(buf)
  return u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47
}

export function isJpegArrayBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 3) return false
  const u = new Uint8Array(buf)
  return u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff
}

/** Assinatura de arquivo ZIP (início típico PK). */
export function isZipArrayBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false
  const u = new Uint8Array(buf)
  return u[0] === 0x50 && u[1] === 0x4b
}

/**
 * Download binário (ZIP, etc.) com autenticação; valida assinatura ZIP.
 */
export async function apiFetchZip(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(path)
  const buf = await res.arrayBuffer()
  if (!res.ok) {
    let message = res.statusText || 'Erro ao obter arquivo'
    try {
      const text = new TextDecoder().decode(buf.slice(0, 4096))
      const j = JSON.parse(text) as { error?: string }
      if (typeof j?.error === 'string') message = j.error
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status)
  }
  if (!isZipArrayBuffer(buf)) {
    throw new ApiError('A resposta não é um arquivo ZIP válido.', res.status)
  }
  const filename =
    parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ?? 'folhas.zip'
  return { blob: new Blob([buf], { type: 'application/zip' }), filename }
}

/**
 * PNG ou JPEG da folha (autenticado).
 */
export async function apiFetchRaster(
  path: string,
  kind: 'png' | 'jpeg',
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(path)
  const buf = await res.arrayBuffer()
  if (!res.ok) {
    let message = res.statusText || 'Erro ao obter imagem'
    try {
      const text = new TextDecoder().decode(buf.slice(0, 4096))
      const j = JSON.parse(text) as { error?: string }
      if (typeof j?.error === 'string') message = j.error
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status)
  }
  const valid = kind === 'png' ? isPngArrayBuffer(buf) : isJpegArrayBuffer(buf)
  if (!valid) {
    throw new ApiError(
      'Resposta inválida: não é uma imagem ' + kind.toUpperCase() + '.',
      res.status,
    )
  }
  const mime = kind === 'png' ? 'image/png' : 'image/jpeg'
  const filename =
    parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ??
    (kind === 'png' ? 'folha.png' : 'folha.jpg')
  return { blob: new Blob([buf], { type: mime }), filename }
}

export async function apiJson<T>(path: string, init?: Parameters<typeof apiFetch>[1]): Promise<T> {
  const res = await apiFetch(path, init)
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      /* 502 do proxy Vite pode devolver HTML — não é JSON */
    }
  }
  if (!res.ok) {
    let msg: string
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      msg = API_DOWN_MSG
    } else if (typeof data === 'object' && data !== null && 'error' in data) {
      msg = String((data as { error: string }).error)
    } else {
      msg = res.statusText || 'Erro na API'
    }
    throw new ApiError(msg, res.status, data)
  }
  return data as T
}
