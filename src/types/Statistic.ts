
export default interface StatisticFilter {
  year?: number;
  startDateTime?: Date;
  endDateTime?: Date;
  siteID?: string;
  siteIDs?: string[];
  periodInMonth?: string|number;
  siteAreaID?: string;
  siteAreaIDs?: string[];
  chargeBoxID?: string;
  chargeBoxIDs?: string[];
  userID?: string;
  userIDs?: string[];
  dataType?: string;
  dataCategory?: string;
  dataScope?: string;
  stop: {
    $exists: boolean;
  };
}

export enum StatsGroupBy {
  CONSUMPTION = 'C',
  USAGE = 'U',
  INACTIVITY = 'I',
  TRANSACTIONS = 'T',
  PRICING = 'P',
}

