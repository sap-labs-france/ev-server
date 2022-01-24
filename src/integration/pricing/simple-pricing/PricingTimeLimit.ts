import Utils from '../../../utils/Utils';

export default class PricingTimeLimit {
  private hour: number;
  private minute: number;
  private second: number;

  public constructor(hour: number, minute: number, second: number) {
    this.hour = hour;
    this.minute = minute;
    this.second = second;
  }

  public static parseTime(timeAsString: string): PricingTimeLimit {
    const hour = Utils.convertToInt(timeAsString.slice(0, 2));
    const minute = Utils.convertToInt(timeAsString.slice(3, 5));
    const second = Utils.convertToInt(timeAsString.slice(6, 8));
    return new PricingTimeLimit(hour, minute, second);
  }

  public isGreaterThan(aTimeLimit: PricingTimeLimit): boolean {
    if (this.hour === aTimeLimit.hour) {
      if (this.minute === aTimeLimit.minute) {
        return (this.second > aTimeLimit.second);
      }
      return (this.minute > aTimeLimit.minute);
    }
    return (this.hour > aTimeLimit.hour);
  }

  public isSameOrLowerThan(aTimeLimit: PricingTimeLimit): boolean {
    return !this.isGreaterThan(aTimeLimit);
  }

  public isLowerThan(aTimeLimit: PricingTimeLimit): boolean {
    if (this.hour === aTimeLimit.hour) {
      if (this.minute === aTimeLimit.minute) {
        return (this.second < aTimeLimit.second);
      }
      return (this.minute < aTimeLimit.minute);
    }
    return (this.hour < aTimeLimit.hour);
  }

  public isSameOrGreaterThan(aTimeLimit: PricingTimeLimit): boolean {
    return !this.isLowerThan(aTimeLimit);
  }

  public isBetween(timeFrom: PricingTimeLimit, timeTo: PricingTimeLimit): boolean {
    // Regular time range or not?
    const spanTwoDays = timeTo.isLowerThan(timeFrom);
    if (spanTwoDays) {
      // Time range spanning two days - e.g.: - Time range from 20:00 to 08:00
      return !this.isBetween(timeTo, timeFrom); // Let's check the opposite
    }
    // Regular time range - e.g.: - Time range from 08:00 to 20:00
    return this.isSameOrGreaterThan(timeFrom) && this.isLowerThan(timeTo);
  }
}
