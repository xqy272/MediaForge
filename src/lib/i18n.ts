import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import zhCN from '../locales/zh-CN.json';
import ja from '../locales/ja.json';

const resources = {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
    ja: { translation: ja },
};

// Read saved language from localStorage, default to zh-CN
const savedLanguage = typeof window !== 'undefined'
    ? localStorage.getItem('language') || 'zh-CN'
    : 'zh-CN';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: savedLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;

export const languages = [
    { code: 'en', name: 'English' },
    { code: 'zh-CN', name: '简体中文' },
    { code: 'ja', name: '日本語' },
];
