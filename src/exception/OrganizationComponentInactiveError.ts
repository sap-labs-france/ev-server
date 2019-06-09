export default class OrganizationComponentInactiveError extends Error {
  constructor(
    readonly action: string,
    readonly entity: string,
    readonly errorCode: number = 500,
    readonly module: string = "N/A",
    readonly method: string = "N/A")
  {
    super(`Component Organization inactive - not allowed to perform '${action}' on '${entity}'`);
  }
}
