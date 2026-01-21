import React from 'react';
import { useTranslation } from 'react-i18next';
import { languages } from '../../lib/i18n';
import { Globe } from 'lucide-react';

export const LanguageSelector: React.FC = () => {
    const { i18n } = useTranslation();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        i18n.changeLanguage(e.target.value);
        localStorage.setItem('language', e.target.value);
    };

    return (
        <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <select
                value={i18n.language}
                onChange={handleChange}
                className="bg-secondary text-foreground text-sm rounded-md px-2 py-1.5 border-none outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
                {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                        {lang.name}
                    </option>
                ))}
            </select>
        </div>
    );
};
