import Database from '../utils/Database';
import TenantStorage from '../storage/mongodb/TenantStorage';
import User from './User';
import Setting from '../entity/Setting';
import TenantComponents from '../types/TenantComponents';


export default class Tenant {
  // pragma private _id: string;
  // private _name: string;
  // private _email: string;
  // private _subdomain: string;
  // private _components: Array<TenantComponents>;
  // private _createdOn: number; //Timestamp
  // private _createdByUser: User; //Use UserId instead of User object copy
  // private _lastChangedOn: number; //Timestamp
  // private _lastChangedByUser: User; //STee above

  // // ID getter
  // public getID(): string {
  //   return this._id;
  // }

  // // Name getter/setters
  // public getName(): string {
  //   return this._name;
  // }

  // // Chainable
  // public setName(newName: string): Tenant {
  //   this._name = newName;
  //   return this;
  // }

  // // Email getter/setters

  private _model: any = {};

  constructor(tenant: any) {
    this._model = tenant;
    Database.updateTenant(tenant, this._model);
  }

  public static getTenant(id: any): Promise<Tenant | null> {
    return TenantStorage.getTenant(id);
  }

  public static getTenantByName(name: string): Promise<Tenant | null> {
    return TenantStorage.getTenantByName(name);
  }

  static getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    return TenantStorage.getTenantBySubdomain(subdomain);
  }

  static getTenants(params = {}, limit?: number, skip?: number, sort?: boolean): Promise<{ count: number; result: Tenant[] }> {
    return TenantStorage.getTenants(params, limit, skip, sort);
  }

  getModel() {
    return this._model;
  }

  getID(): string {
    return this._model.id;
  }

  setName(name: string): void {
    this._model.name = name;
  }

  getName(): string {
    return this._model.name;
  }

  setEmail(email: string): void {
    this._model.email = email;
  }

  getEmail(): string {
    return this._model.email;
  }

  setSubdomain(subdomain: string): void {
    this._model.subdomain = subdomain;
  }

  getSubdomain(): string {
    return this._model.subdomain;
  }

  isComponentActive(identifier: string): boolean {
    return (this._model.components[identifier] && this._model.components[identifier].active ? true : false);
  }

  activateComponent(identifier: string): void {
    if (!this._model.components[identifier]) {
      this._model.components[identifier] = {};
    }
    this._model.components[identifier].active = true;
  }

  deactivateComponent(identifier: string): void {
    if (!this._model.components[identifier]) {
      this._model.components[identifier] = {};
    }
    this._model.components[identifier].active = false;
  }

  getActiveComponentNames(): string[] {
    const activeComponents = [];
    for (const componentName in this._model.components) {
      if (this._model.components.hasOwnProperty(componentName) && this._model.components[componentName].active) {
        activeComponents.push(componentName);
      }
    }
    return activeComponents;
  }

  getActiveComponents() {
    const activeComponents = [];
    for (const componentName in this._model.components) {
      if (this._model.components.hasOwnProperty(componentName) && this._model.components[componentName].active) {
        if (this._model.components[componentName].type) {
          activeComponents.push(`${componentName}_${this._model.components[componentName].type}`);
        }
        activeComponents.push(componentName);
      }
    }
    return activeComponents;
  }

  getComponents() {
    const components = [];
    for (const componentName in this._model.components) {
      components.push({ name: componentName, ...this._model.components[componentName] });
    }
    return components;
  }

  setComponentConfigTenantLevel(identifier: any, configuration: any) {
    if (!this._model.components[identifier]) {
      this._model.components[identifier] = {};
    }

    if (configuration) {
      this._model.components[identifier].configuration = configuration;
    }
  }

  async getSetting(identifier: any) {
    return await Setting.getSettingByIdentifier(this.getID(), identifier);
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user: any) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn: any) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user: any) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn: any) {
    this._model.lastChangedOn = lastChangedOn;
  }

}
