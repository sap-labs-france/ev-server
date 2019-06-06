import Database from '../utils/Database';
import TenantStorage from '../storage/mongodb/TenantStorage';
import User from './User';
import Setting from '../entity/Setting';
//import TenantComponents from './TenantComponents';

export default class Tenant {

	/*private name: string;
	private subdomain: string;
	private email: string;
	private components: TenantComponents[];*/
	private model: any = {};

  constructor(/*name: string, subdomain: string, email: string, comps: Array<TenantComponents>*/ tenant: any) {
		this.model = tenant;
		//this.name = name;
		//this.subdomain = subdomain;
		//this.email = email;
		//this.components = comps;

    // Set it TODO wtf is this
    Database.updateTenant(tenant, this.model);
  }

  public static getTenant(id: any): Promise<Tenant|null> {
    // Get Tenant
    return TenantStorage.getTenant(id);
  }

  public static getTenantByName(name: string): Promise<Tenant|null> {
    // Get Tenant
    return TenantStorage.getTenantByName(name);
  }

  static getTenantBySubdomain(subdomain: string): Promise<Tenant|null> {
    // Get Tenant
    return TenantStorage.getTenantBySubdomain(subdomain);
  }

  static getTenants(params = {}, limit?: number, skip?: number, sort?: boolean): Promise<{count: number, result: Tenant[]}> {
    // Get Tenants
    return TenantStorage.getTenants(params, limit, skip, sort);
  }

  getModel() {
    return this.model;
  }

  getID(): string {
    return this.model.id;
  }

  setName(name: string): void {
    this.model.name = name;
  }

  getName(): string {
    return this.model.name;
  }

  setEmail(email: string): void {
    this.model.email = email;
  }

  getEmail(): string {
    return this.model.email;
  }

  setSubdomain(subdomain: string): void {
    this.model.subdomain = subdomain;
  }

  getSubdomain(): string {
    return this.model.subdomain;
  }

  isComponentActive(identifier: string): boolean {
    return (this.model.components[identifier] && this.model.components[identifier].active ? true : false);
  }

  activateComponent(identifier: string): void {
    if (!this.model.components[identifier]) {
      this.model.components[identifier] = {};
    }

    this.model.components[identifier].active = true;
  }

  deactivateComponent(identifier: string): void {
    if (!this.model.components[identifier]) {
      this.model.components[identifier] = {};
    }

    this.model.components[identifier].active = false;
  }

  getActiveComponentNames(): string[] {
    const activeComponents = [];
    for (const componentName in this.model.components) {
      if (this.model.components.hasOwnProperty(componentName) && this.model.components[componentName].active) {
        activeComponents.push(componentName);
      }
    }
    return activeComponents;
  }

  getActiveComponents() {
    const activeComponents = [];
    for (const componentName in this.model.components) {
      if (this.model.components.hasOwnProperty(componentName) && this.model.components[componentName].active) {
        if (this.model.components[componentName].type) {
          activeComponents.push(`${componentName}_${this.model.components[componentName].type}`);
        }
        activeComponents.push(componentName);
      }
    }
    return activeComponents;
  }

  getComponents() {
    const components = [];
    for (const componentName in this.model.components) {
      components.push({name: componentName, ...this.model.components[componentName]});
    }
    return components;
  }

  setComponentConfigTenantLevel(identifier: any, configuration: any) {
    if (!this.model.components[identifier]) {
      this.model.components[identifier] = {};
    }

    if (configuration) {
      this.model.components[identifier].configuration = configuration;
    }
  }

  async getSetting(identifier: any) {
    return await Setting.getSettingByIdentifier(this.getID(), identifier);
  }

  getCreatedBy() {
    if (this.model.createdBy) {
      return new User(this.getID(), this.model.createdBy);
    }
    return null;
  }

  setCreatedBy(user: any) {
    this.model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this.model.createdOn;
  }

  setCreatedOn(createdOn: any) {
    this.model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.model.lastChangedBy) {
      return new User(this.getID(), this.model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user: any) {
    this.model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this.model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn: any) {
    this.model.lastChangedOn = lastChangedOn;
  }
}
