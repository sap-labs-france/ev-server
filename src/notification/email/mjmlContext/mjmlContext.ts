export default class mjmlContext {
  public title: string;
  public username: string;
  public buttonText: string;

  public constructor(title?: string, username?: string, buttonText?: string) {
    this.title = title;
    this.username = username;
    this.buttonText = buttonText;
  }
}
