import type { WorkSchedule } from "@/services/firebase/types";

export const DEFAULT_WORK_SCHEDULE_ID = "full_time_44";

export const DEFAULT_WORK_SCHEDULES: WorkSchedule[] = [
  {
    id: "full_time_44",
    name: "Full time",
    weeklyMinutes: 2640,
    days: {
      mon: 480,
      tue: 480,
      wed: 480,
      thu: 480,
      fri: 480,
      sat: 240,
      sun: 0,
    },
  },
  {
    id: "part_time_24",
    name: "Part time",
    weeklyMinutes: 1440,
    days: {
      mon: 240,
      tue: 240,
      wed: 240,
      thu: 240,
      fri: 240,
      sat: 240,
      sun: 0,
    },
  },
];
