'use client'
import { useCallback } from 'react'
import {
  doc, setDoc, addDoc, collection, getDoc,
  increment, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { PuntosRefType } from './types'
import { BOT_AVATAR, checkMilestone } from './points'

function now() { return new Date().toISOString() }

const COL_PUNTOS     = 'cmhub_puntos'
const COL_PUNTOS_LOG = 'cmhub_puntos_log'
const COL_SALA       = 'cmhub_mensajes_sala'

export function usePointsActions() {

  const awardPoints = useCallback(async (
    userId:  string,
    amount:  number,
    reason:  string,
    refType: PuntosRefType,
    refId:   string,
    fichas = 0,
  ): Promise<number> => {
    if (!userId || amount <= 0) return 0

    const ref = doc(db, COL_PUNTOS, userId)

    // Leer puntos actuales para detectar milestone
    const snap = await getDoc(ref)
    const antes = (snap.data()?.puntos as number | undefined) ?? 0

    // Incremento atómico (crea el doc si no existe)
    await setDoc(ref, {
      userId,
      puntos:    increment(amount),
      fichas:    increment(fichas),
      updatedAt: now(),
    }, { merge: true })

    // Log de transacción
    await addDoc(collection(db, COL_PUNTOS_LOG), {
      userId, amount, reason, refType, refId,
      createdAt: serverTimestamp(),
    })

    return antes + amount
  }, [])

  const postBotSala = useCallback(async (texto: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    await setDoc(doc(db, COL_SALA, id), {
      ...BOT_AVATAR,
      texto,
      tipo: 'bot',
      createdAt: now(),
      _ts: serverTimestamp(),
    })
  }, [])

  // Award + post bot message + optional milestone message
  const awardAndPost = useCallback(async (opts: {
    userId:   string
    userName: string
    amount:   number
    reason:   string
    refType:  PuntosRefType
    refId:    string
    botTexto: string
    fichas?:  number
  }) => {
    const totalDespues = await awardPoints(
      opts.userId, opts.amount, opts.reason,
      opts.refType, opts.refId, opts.fichas ?? 0,
    )
    await postBotSala(opts.botTexto)

    // Milestone
    const antes = totalDespues - opts.amount
    const milestone = checkMilestone(antes, totalDespues)
    if (milestone) {
      await postBotSala(`🏆 *${opts.userName}* alcanzó **${milestone} puntos** — ¡sigue así!`)
    }
  }, [awardPoints, postBotSala])

  return { awardPoints, postBotSala, awardAndPost }
}
