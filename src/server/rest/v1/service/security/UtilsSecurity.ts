import Utils from '../../../../../utils/Utils';
import sanitize from 'mongo-sanitize';

export default class UtilsSecurity {
  public static filterBoolean(value): boolean {
    let result = false;
    // Check boolean
    if (value) {
      // Sanitize
      value = sanitize(value);
      // Check the type
      if (Utils.isBoolean(value)) {
        // Already a boolean
        result = value;
      } else {
        // Convert
        result = (value === 'true');
      }
    }
    return result;
  }
}
