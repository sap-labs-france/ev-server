export default class ComponentInactiveError extends Error {
  constructor(
    readonly component: string,
    readonly action: string,
    readonly entity: string,
    readonly errorCode: number = 500,
    readonly module: string = "N/A",
    readonly method: string = "N/A")
  {
    super(`Component ${component} is inactive - Not allowed to perform '${action}' on '${entity}'`);
  }
}
