/** Alvo no cliente (margem face ao limite do servidor). */
export const MAX_PRINT_DATA_URL_LEN = 2_200_000

/** Ficheiro de entrada máximo antes de tentar comprimir (20 MB). */
const MAX_INPUT_BYTES = 20 * 1024 * 1024

/** Maior lado ao desenhar no canvas (evita limites do browser e memória). */
const MAX_CANVAS_EDGE = 4096

/** Se o ficheiro for pequeno, tentamos data URL direto (preserva PNG com transparência). */
const TRY_RAW_MAX_BYTES = 450_000

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'))
    r.readAsDataURL(file)
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem comprimida.'))),
      'image/jpeg',
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Leitura do resultado falhou.'))
    r.readAsDataURL(blob)
  })
}

/**
 * Redimensiona e comprime para JPEG até caber em MAX_PRINT_DATA_URL_LEN.
 * Fecha sempre o ImageBitmap.
 */
async function compressBitmapToDataUrl(bitmap: ImageBitmap): Promise<string> {
  try {
    let w = bitmap.width
    let h = bitmap.height
    if (w < 1 || h < 1) {
      throw new Error('Imagem inválida.')
    }

    const maxEdge = Math.max(w, h)
    if (maxEdge > MAX_CANVAS_EDGE) {
      const s = MAX_CANVAS_EDGE / maxEdge
      w = Math.round(w * s)
      h = Math.round(h * s)
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Este navegador não permite processar a imagem (canvas).')
    }

    let quality = 0.9

    for (let attempt = 0; attempt < 48; attempt++) {
      canvas.width = w
      canvas.height = h
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(bitmap, 0, 0, w, h)

      const blob = await canvasToJpegBlob(canvas, quality)
      const dataUrl = await blobToDataUrl(blob)
      if (dataUrl.length <= MAX_PRINT_DATA_URL_LEN) {
        return dataUrl
      }

      if (quality > 0.48) {
        quality = Math.max(0.45, quality - 0.065)
        continue
      }

      quality = 0.88
      w = Math.max(280, Math.round(w * 0.86))
      h = Math.max(280, Math.round(h * 0.86))
      if (Math.min(w, h) < 300 && attempt > 12) {
        throw new Error(
          'Não foi possível comprimir a imagem o suficiente. Experimente um ficheiro menor ou com menos detalhe.',
        )
      }
    }
    throw new Error('Compressão da imagem excedeu o limite de tentativas.')
  } finally {
    bitmap.close()
  }
}

/**
 * Imagem para guardar em print_settings: comprime quando necessário.
 * PNG pequenos podem ser enviados sem JPEG para manter transparência.
 */
export async function imageFileToPrintDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Use PNG, JPEG ou WebP.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Ficheiro demasiado grande (máx. 20 MB antes de comprimir).')
  }

  if (file.size <= TRY_RAW_MAX_BYTES) {
    const raw = await readFileAsDataUrl(file)
    if (raw.length <= MAX_PRINT_DATA_URL_LEN) {
      return raw
    }
  }

  const bitmap = await createImageBitmap(file)
  return compressBitmapToDataUrl(bitmap)
}
