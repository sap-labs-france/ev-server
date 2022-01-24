import CarIntegration from './CarIntegration';
import EVDatabaseCarIntegration from './ev-database/EVDatabaseCarIntegration';

export default class CarFactory {
  public static getCarImpl(): CarIntegration {
    // Always return the EVDatabase
    return new EVDatabaseCarIntegration();
  }
}

