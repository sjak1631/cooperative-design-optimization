import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ja' | 'en';

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface Translations {
    [key: string]: any;
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('ja'); // デフォルト言語は日本語
    const [translations, setTranslations] = useState<Record<Language, Translations>>({
        ja: {},
        en: {},
    });

    // ロケールファイルを読み込む
    useEffect(() => {
        const loadTranslations = async () => {
            try {
                const [jaModule, enModule] = await Promise.all([
                    import('../locales/ja.json'),
                    import('../locales/en.json'),
                ]);
                setTranslations({
                    ja: jaModule.default,
                    en: enModule.default,
                });
            } catch (error) {
                console.error('Failed to load translations:', error);
            }
        };
        loadTranslations();
    }, []);

    // ネストされたキーから値を取得する関数
    const getNestedValue = (obj: any, path: string): string | undefined => {
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        return typeof current === 'string' ? current : undefined;
    };

    // 翻訳キーから値を取得し、プレースホルダーを置換する関数
    const t = (key: string, options?: Record<string, string | number>): string => {
        let value = getNestedValue(translations[language], key);

        if (!value) {
            // フォールバック：英語を試す
            value = getNestedValue(translations.en, key);
        }

        if (!value) {
            // デバッグ用：キーそのものを返す
            return key;
        }

        // プレースホルダーを置換
        if (options) {
            Object.entries(options).forEach(([placeholder, val]) => {
                value = value!.replace(`{${placeholder}}`, String(val));
            });
        }

        return value;
    };

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within I18nProvider');
    }
    return context;
};
