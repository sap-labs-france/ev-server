export default abstract class MigrationTask {
  public abstract migrate(): Promise<void>;

  public abstract getVersion(): string;

  public abstract getName(): string;

  public isAsynchronous(): boolean {
    return false;
  }
}
