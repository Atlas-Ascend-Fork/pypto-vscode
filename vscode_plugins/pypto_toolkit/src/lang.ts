import { env } from 'vscode';

const LangMap = {
  en: 'en',
  'zh-cn': 'zh',
};

export function getIDELang() {
  return LangMap[env.language] ?? 'zh';
}
