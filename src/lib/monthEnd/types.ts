export interface MonthEndTask {
  id: string;
  area: string;
  title: string;
  description?: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface MonthEndCheck {
  id: string;
  taskId: string;
  area: string;
  period: string; // "YYYY-MM"
  completedAt: string;
  completedBy: string; // uid
  completedByName: string;
}
