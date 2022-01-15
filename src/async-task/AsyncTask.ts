import AsyncTask from '../types/AsyncTask';

const MODULE_NAME = 'AbstractAsyncTask';

export default abstract class AbstractAsyncTask {
  private asyncTask: AsyncTask;
  private correlationID: string;

  public constructor(asyncTask: AsyncTask, correlationID: string) {
    this.asyncTask = asyncTask;
    this.correlationID = correlationID;
  }

  public async run(): Promise<void> {
    // Hook
    await this.beforeAsyncTaskRun();
    // Process
    await this.executeAsyncTask();
    // Hook
    await this.afterAsyncTaskRun();
  }

  public getAsyncTask(): AsyncTask {
    return this.asyncTask;
  }

  public getCorrelationID(): string {
    return this.correlationID;
  }

  protected async beforeAsyncTaskRun(): Promise<void> {
  }

  protected async afterAsyncTaskRun(): Promise<void> {
  }

  protected abstract executeAsyncTask(): Promise<void>;
}
