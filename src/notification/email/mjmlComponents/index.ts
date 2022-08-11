import * as fs from 'fs';

const FOOTER = fs.readFileSync('src/mjmlComponents/footer.mjml', { encoding: 'utf8', flag: 'r' });
const HEADER = fs.readFileSync('src/mjmlComponents/header.mjml', { encoding: 'utf8', flag: 'r' });
const CONFIG = fs.readFileSync('src/mjmlComponents/config.mjml', { encoding: 'utf8', flag: 'r' });

const BUTTON = fs.readFileSync('src/mjmlComponents/button.mjml', { encoding: 'utf8', flag: 'r' });
const TITLE = fs.readFileSync('src/mjmlComponents/title.mjml', { encoding: 'utf8', flag: 'r' });
const TEXT1 = fs.readFileSync('src/mjmlComponents/text1.mjml', { encoding: 'utf8', flag: 'r' });
const TEXT2 = fs.readFileSync('src/mjmlComponents/text2.mjml', { encoding: 'utf8', flag: 'r' });

export { BUTTON, TITLE, TEXT2, TEXT1, FOOTER, HEADER, CONFIG };
