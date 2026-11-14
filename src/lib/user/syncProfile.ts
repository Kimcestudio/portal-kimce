import { writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/client'

/**
 * Escribe users/{uid} y userDirectory/{uid} en un único batch atómico.
 * Garantiza que ambas colecciones siempre queden en sync.
 * directoryData debe ser el objeto completo a escribir en userDirectory (usa merge:true).
 */
export async function atomicUserWrite(
  uid: string,
  usersData: Record<string, unknown>,
  directoryData: Record<string, unknown>,
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), { ...usersData, updatedAt: serverTimestamp() }, { merge: true })
  batch.set(doc(db, 'userDirectory', uid), directoryData, { merge: true })
  await batch.commit()
}
