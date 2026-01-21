import React from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../lib/utils';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useTranslation();

    const themes = [
        { value: 'light' as const, icon: Sun, label: t('theme_light') },
        { value: 'dark' as const, icon: Moon, label: t('theme_dark') },
        { value: 'system' as const, icon: Monitor, label: t('theme_system') },
    ];

    return (
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
            {themes.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                        'p-2 rounded-md transition-all duration-200',
                        theme === value
                            ? 'bg-background text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                    title={label}
                >
                    <Icon className="w-4 h-4" />
                </button>
            ))}
        </div>
    );
};
