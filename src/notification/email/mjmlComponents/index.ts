import * as fs from 'fs';

const FOOTER = fs.readFileSync('src/notification/email/mjmlComponents/footer.mjml', { encoding: 'utf8', flag: 'r' });
const HEADER = fs.readFileSync('src/notification/email/mjmlComponents/header.mjml', { encoding: 'utf8', flag: 'r' });
const CONFIG = fs.readFileSync('src/notification/email/mjmlComponents/config.mjml', { encoding: 'utf8', flag: 'r' });

const BUTTON = fs.readFileSync('src/notification/email/mjmlComponents/button.mjml', { encoding: 'utf8', flag: 'r' });
const TITLE = fs.readFileSync('src/notification/email/mjmlComponents/title.mjml', { encoding: 'utf8', flag: 'r' });
const TEXT1 = fs.readFileSync('src/notification/email/mjmlComponents/text1.mjml', { encoding: 'utf8', flag: 'r' });
const TEXT2 = fs.readFileSync('src/notification/email/mjmlComponents/text2.mjml', { encoding: 'utf8', flag: 'r' });

export { BUTTON, TITLE, TEXT2, TEXT1, FOOTER, HEADER, CONFIG };
