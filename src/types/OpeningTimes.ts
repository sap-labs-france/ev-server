
export interface OpeningTimes {
  twentyFourBySeven: boolean;
  regularHours: RegularHour[];
  exceptionalOpenings: Period[];
  exceptionalClosings: Period[];
}

export interface Period {
  periodBegin: Date;
  periodEnd: Date;
}

export interface RegularHour extends Period {
  weekday: number; // Number of day in the week, from Monday (1) till Sunday (7)
}
