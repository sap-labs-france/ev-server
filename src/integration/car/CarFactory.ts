import CarIntegration from './CarIntegration';
import EVDatabaseCarIntegration from './ev-database/EVDatabaseCarIntegration';

export default class CarFactory {
  static async getCarImpl(): Promise<CarIntegration> {
    // Always return the EVDatabase
    return new EVDatabaseCarIntegration();
  }
}

