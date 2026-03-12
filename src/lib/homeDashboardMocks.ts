export type HomeTeamMember = {
  id: string;
  name: string;
  role: string;
  photoURL?: string;
};

export type CelebrationType = "birthday" | "anniversary";

export type HomeCelebration = {
  id: string;
  name: string;
  type: CelebrationType;
  dateLabel: string;
  hint: string;
  photoURL?: string;
};

export type HomeAction = {
  id: string;
  label: string;
  description: string;
};

export type HomeNewEmployee = {
  id: string;
  name: string;
  role: string;
  startDate: string;
  elapsedDays: number;
  period: "Este mes" | "2025";
  photoURL?: string;
};

export type HomeRequest = {
  id: string;
  name: string;
  type: string;
  status: "Pendiente" | "Aprobada" | "Observada";
  period: "Este mes" | "2025";
  photoURL?: string;
};

export type HomeEvent = {
  id: string;
  dateLabel: string;
  title: string;
  description?: string;
};

export const homeTeamMembers: HomeTeamMember[] = [
  { id: "u1", name: "Medalie Sánchez", role: "RRHH" },
  { id: "u2", name: "Angela Mendoza", role: "Contabilidad" },
  { id: "u3", name: "Luis A. Minchola", role: "Coordinador" },
  { id: "u4", name: "Carla Díaz", role: "Diseño" },
  { id: "u5", name: "Jorge Peña", role: "Operaciones" },
  { id: "u6", name: "Rosa Flores", role: "Marketing" },
  { id: "u7", name: "Mateo Rojas", role: "Finanzas" },
  { id: "u8", name: "Lucía Paredes", role: "Soporte" },
  { id: "u9", name: "Daniela Vera", role: "Ventas" },
  { id: "u10", name: "Piero Castillo", role: "TI" },
];

export const homeCelebrations: HomeCelebration[] = [
  { id: "c1", name: "Carla Díaz", type: "birthday", dateLabel: "20 Mar", hint: "Cumpleaños" },
  { id: "c2", name: "Jorge Peña", type: "anniversary", dateLabel: "22 Mar", hint: "3 años" },
  { id: "c3", name: "Lucía Paredes", type: "birthday", dateLabel: "25 Mar", hint: "Cumpleaños" },
  { id: "c4", name: "Mateo Rojas", type: "anniversary", dateLabel: "30 Mar", hint: "1 año" },
];

export const homeQuickActions: HomeAction[] = [
  { id: "a1", label: "Agregar colaborador", description: "Alta de nuevo perfil" },
  { id: "a2", label: "Aprobar solicitud", description: "Vacaciones y permisos" },
  { id: "a3", label: "Ver reportes", description: "Indicadores del mes" },
  { id: "a4", label: "Enviar comunicado", description: "Mensaje general" },
  { id: "a5", label: "Revisar pendientes", description: "Tareas por resolver" },
];

export const homeNewEmployees: HomeNewEmployee[] = [
  { id: "n1", name: "Andrea Ruíz", role: "Analista de datos", startDate: "03 Oct", elapsedDays: 23, period: "Este mes" },
  { id: "n2", name: "José Medina", role: "Asistente comercial", startDate: "02 Oct", elapsedDays: 24, period: "Este mes" },
  { id: "n3", name: "Paula Ortiz", role: "Coordinadora de cuentas", startDate: "15 Ene", elapsedDays: 78, period: "2025" },
];

export const homeRequests: HomeRequest[] = [
  { id: "r1", name: "Medalie Sánchez", type: "Permiso por horas", status: "Pendiente", period: "Este mes" },
  { id: "r2", name: "Angela Mendoza", type: "Vacaciones", status: "Aprobada", period: "Este mes" },
  { id: "r3", name: "Piero Castillo", type: "Cambio de turno", status: "Observada", period: "2025" },
];

export const homeEvents: HomeEvent[] = [
  { id: "e1", dateLabel: "20/11/2025", title: "Reunión general", description: "Sincronización trimestral del equipo" },
  { id: "e2", dateLabel: "25/11/2025", title: "Capacitación interna", description: "Buenas prácticas de atención" },
  { id: "e3", dateLabel: "29/11/2025", title: "Cierre de objetivos", description: "Revisión de OKRs" },
];
