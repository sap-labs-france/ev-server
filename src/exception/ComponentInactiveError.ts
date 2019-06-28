import Constants from '../utils/Constants';

export default class ComponentInactiveError extends Error {
  constructor(
    readonly component: string,
    readonly action: string,
    readonly entity: string,
    readonly errorCode: number = Constants.HTTP_GENERAL_ERROR,
    readonly module: string = 'N/A',
    readonly method: string = 'N/A') {
    super(`Component ${component} is inactive - Not allowed to perform '${action}' on '${entity}'`);
  }
}
