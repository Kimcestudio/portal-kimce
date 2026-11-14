import type { Proyecto } from '../types'
export function canManageProject(project: Proyecto, user?: {uid?: string; role?: string} | null) { return !!user && (user.role?.toLowerCase() === 'admin' || !!(user.uid && project.ownerIds?.includes(user.uid))) }
