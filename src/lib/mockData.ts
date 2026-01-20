export const metrics = {
  visitsToday: {
    value: 8,
    max: 17,
    progress: 48,
  },
  visitsMonth: {
    value: 390,
    max: 520,
    progress: 71,
  },
  nps: {
    value: 94,
    progress: 88,
  },
};

export const dailyVisits = [
  { day: "06/15", value: 22 },
  { day: "06/16", value: 18 },
  { day: "06/17", value: 24 },
  { day: "06/18", value: 21 },
  { day: "06/19", value: 20 },
  { day: "06/20", value: 12 },
  { day: "06/21", value: 15 },
  { day: "06/22", value: 11 },
  { day: "06/23", value: 26 },
  { day: "06/24", value: 19 },
  { day: "06/25", value: 28 },
  { day: "06/26", value: 25 },
  { day: "06/27", value: 30 },
  { day: "06/28", value: 18 },
  { day: "06/29", value: 23 },
  { day: "06/30", value: 24 },
  { day: "07/01", value: 24 },
  { day: "07/02", value: 24 },
  { day: "07/03", value: 24 },
  { day: "07/04", value: 12 },
  { day: "07/05", value: 14 },
  { day: "07/06", value: 10 },
  { day: "07/07", value: 21 },
  { day: "07/08", value: 23 },
  { day: "07/09", value: 18 },
  { day: "07/10", value: 28 },
  { day: "07/11", value: 26 },
  { day: "07/12", value: 15 },
  { day: "07/13", value: 16 },
  { day: "07/14", value: 19 },
];

export const dateChips = [
  { day: 19, label: "Jul", active: true },
  { day: 20, label: "Jul" },
  { day: 21, label: "Jul" },
  { day: 22, label: "Jul" },
  { day: 23, label: "Jul" },
  { day: 24, label: "Jul" },
];

export const timeSlots = [
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
];

export const appointments = [
  {
    id: 1,
    name: "N. Hamilton",
    time: "10:15-10:30 am",
    selected: false,
  },
  {
    id: 2,
    name: "R. Richardson",
    time: "10:30-10:45 am",
    selected: false,
  },
  {
    id: 3,
    name: "A. Schultz",
    time: "10:45-11:00 am",
    selected: true,
  },
  {
    id: 4,
    name: "Team meeting",
    time: "11:00-11:30 am",
    selected: false,
  },
  {
    id: 5,
    name: "C. Morales",
    time: "11:30-11:45 am",
    selected: false,
  },
  {
    id: 6,
    name: "N. Hamilton",
    time: "12:00-12:15 pm",
    selected: false,
  },
  {
    id: 7,
    name: "P. James",
    time: "12:15-12:30 pm",
    selected: false,
  },
  {
    id: 8,
    name: "Alice <> Ryan",
    time: "12:30-12:45 pm",
    selected: false,
  },
];

export const treatmentPhases = [
  { label: "Early Stage", value: 26, color: "bg-[#d8dcff]" },
  { label: "Ongoing", value: 13, color: "bg-[#9ea6ff]" },
  { label: "Maintenance", value: 5, color: "bg-[#4f56d3]" },
];
