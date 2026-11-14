const MAX_SIDE  = 1920  // px — reduce si la imagen es más grande
const QUALITY   = 0.50  // 0–1, más agresivo — buen balance para capturas de UI

export async function compressImage(file: File): Promise<File> {
  // Solo comprimir imágenes raster; pasar PDFs y otros tal cual
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Calcular dimensiones manteniendo proporción
      let { width, height } = img
      if (width > MAX_SIDE || height > MAX_SIDE) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_SIDE)
          width  = MAX_SIDE
        } else {
          width  = Math.round((width / height) * MAX_SIDE)
          height = MAX_SIDE
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // Preferir WebP si el browser lo soporta (mejor compresión que JPEG)
      const outType = canvas.toDataURL('image/webp').startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/jpeg'

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return }
          const ext      = outType === 'image/webp' ? 'webp' : 'jpg'
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}.${ext}`, { type: outType }))
        },
        outType,
        QUALITY,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('No se pudo cargar la imagen')) }
    img.src = objectUrl
  })
}
