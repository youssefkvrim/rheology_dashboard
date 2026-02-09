import { useState, useEffect } from 'react';
import { useI18n, Language, LANGUAGE_NAMES } from '../i18n';

type NotifChannel = 'email' | 'sms' | 'none';

// Accent colors with light/dark variants (45° split circle: top=light, bottom=dark)
const ACCENT_COLORS = [
  { name: 'Bleu Safran', light: '#0e224b', dark: '#9db0df' },
  { name: 'Bleu Ciel', light: '#0ea5e9', dark: '#7dd3fc' },
  { name: 'Vert', light: '#16a34a', dark: '#86efac' },
  { name: 'Violet', light: '#7c3aed', dark: '#c4b5fd' },
  { name: 'Orange', light: '#ea580c', dark: '#fdba74' },
];

// Notification types
const NOTIF_TYPES = [
  { key: 'density', label: 'Densité hors bornes' },
  { key: 'viscosity', label: 'Viscosité hors bornes' },
  { key: 'ph', label: 'pH hors bornes' },
  { key: 'temperature', label: 'Température hors bornes' },
  { key: 'tempRoom', label: 'Température salle' },
  { key: 'humidity', label: 'Humidité salle' },
  { key: 'system', label: 'Erreurs système' },
];

export default function Params() {
  const { language, setLanguage, t, availableLanguages } = useI18n();

  // Notification preferences
  const [notifChannel, setNotifChannel] = useState<NotifChannel>(() => {
    return (localStorage.getItem('notif-channel') as NotifChannel) || 'email';
  });

  // Notification types enabled
  const [notifTypes, setNotifTypes] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('notif-types') || '{}');
    } catch { return {}; }
  });

  // Accent color (store the light variant as key)
  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('accent-color') || '#0e224b';
  });

  // Refresh interval (seconds)
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    return Number(localStorage.getItem('refresh-interval')) || 30;
  });

  // Default chart settings for all slurries
  const [defaultAvgOn, setDefaultAvgOn] = useState<boolean>(() => {
    return localStorage.getItem('default-avg-on') !== 'false';
  });
  const [defaultTrendOn, setDefaultTrendOn] = useState<boolean>(() => {
    return localStorage.getItem('default-trend-on') === 'true';
  });
  const [defaultDeltaY, setDefaultDeltaY] = useState<number>(() => {
    return Number(localStorage.getItem('default-delta-y')) || 0;
  });

  // Get current accent pair
  const currentAccent = ACCENT_COLORS.find(c => c.light === accentColor) || ACCENT_COLORS[0];

  // Persist changes
  useEffect(() => {
    localStorage.setItem('notif-channel', notifChannel);
  }, [notifChannel]);

  useEffect(() => {
    localStorage.setItem('notif-types', JSON.stringify(notifTypes));
  }, [notifTypes]);

  useEffect(() => {
    localStorage.setItem('accent-color', accentColor);
    const pair = ACCENT_COLORS.find(c => c.light === accentColor);
    if (pair) {
      document.documentElement.style.setProperty('--accent', pair.light);
      document.documentElement.style.setProperty('--accent-dark', pair.dark);
    }
  }, [accentColor]);

  // Language is now handled by I18nContext

  useEffect(() => {
    localStorage.setItem('refresh-interval', String(refreshInterval));
  }, [refreshInterval]);

  useEffect(() => {
    localStorage.setItem('default-avg-on', String(defaultAvgOn));
  }, [defaultAvgOn]);

  useEffect(() => {
    localStorage.setItem('default-trend-on', String(defaultTrendOn));
  }, [defaultTrendOn]);

  useEffect(() => {
    localStorage.setItem('default-delta-y', String(defaultDeltaY));
  }, [defaultDeltaY]);

  const toggleNotifType = (key: string) => {
    setNotifTypes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <h2>{t('params.title')}</h2>

      {/* Notifications */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.notifications')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {language === 'fr' ? 'Choisissez comment recevoir les alertes' :
           language === 'en' ? 'Choose how to receive alerts' :
           language === 'it' ? 'Scegli come ricevere gli avvisi' :
           'Elija cómo recibir alertas'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {(['email', 'sms', 'none'] as NotifChannel[]).map((ch) => (
            <button
              key={ch}
              onClick={() => setNotifChannel(ch)}
              style={{
                background: notifChannel === ch ? 'var(--accent)' : 'transparent',
                color: notifChannel === ch ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {ch === 'email' ? 'Email' : ch === 'sms' ? 'SMS' : 'Aucune'}
            </button>
          ))}
        </div>

        {notifChannel !== 'none' && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ fontSize: 12 }}>Types d'alertes à recevoir :</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              {NOTIF_TYPES.map(nt => (
                <label key={nt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!notifTypes[nt.key]}
                    onChange={() => toggleNotifType(nt.key)}
                  />
                  {nt.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accent color */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Couleur d'accent</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Personnalisez la couleur principale.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.light}
              onClick={() => setAccentColor(c.light)}
              title={c.name}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${c.light} 50%, ${c.dark} 50%)`,
                border: accentColor === c.light ? '3px solid var(--text)' : '2px solid var(--border)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
          <span className="muted" style={{ marginLeft: 8 }}>{currentAccent.name}</span>
        </div>
      </div>

      {/* Language */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.language')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {language === 'fr' ? 'Choisissez votre langue préférée.' : 
           language === 'en' ? 'Choose your preferred language.' :
           language === 'it' ? 'Scegli la tua lingua preferita.' :
           'Elija su idioma preferido.'}
        </p>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{ marginTop: 8 }}
        >
          {availableLanguages.map(({ code, name }) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>

      {/* Refresh interval */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Rafraîchissement</h3>
        <p className="muted" style={{ fontSize: 12 }}>Intervalle de mise à jour automatique des données (en secondes)</p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input
            type="number"
            min={5}
            max={300}
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Math.max(5, Math.min(300, Number(e.target.value))))}
            style={{ width: 80 }}
          />
          <span className="muted">secondes</span>
        </div>
      </div>

      {/* Default chart settings */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Paramètres graphiques par défaut</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Ces paramètres s'appliquent à tous les graphiques par défaut. Peut être surchargé par barbotine.
        </p>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={defaultAvgOn}
              onChange={(e) => setDefaultAvgOn(e.target.checked)}
            />
            Afficher la moyenne
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={defaultTrendOn}
              onChange={(e) => setDefaultTrendOn(e.target.checked)}
            />
            Afficher la tendance
          </label>
          <div>
            <label>ΔY (incertitude)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={defaultDeltaY}
              onChange={(e) => setDefaultDeltaY(Math.max(0, Number(e.target.value)))}
              style={{ width: 80, marginLeft: 8 }}
            />
          </div>
        </div>
      </div>

      {/* Reset all */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Réinitialiser</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Supprime toutes les préférences locales (paramètres graphiques, bornes, unités).
        </p>
        <button
          style={{ marginTop: 8, background: '#ef4444', borderColor: '#dc2626' }}
          onClick={() => {
            if (!confirm('Supprimer tous les paramètres ? Cette action est irréversible.')) return;
          try {
            const userId = sessionStorage.getItem('userId') || 'anonymous';
            localStorage.removeItem(`chartParams:${userId}`);
            localStorage.removeItem(`chartParamsById:${userId}`);
            localStorage.removeItem(`bounds:${userId}`);
            localStorage.removeItem(`boundsById:${userId}`);
              localStorage.removeItem('notif-channel');
              localStorage.removeItem('notif-types');
              localStorage.removeItem('accent-color');
              localStorage.removeItem('language');
              localStorage.removeItem('refresh-interval');
              localStorage.removeItem('default-avg-on');
              localStorage.removeItem('default-trend-on');
              localStorage.removeItem('default-delta-y');
          } finally {
            window.location.reload();
          }
          }}
        >
          Supprimer tous les paramètres
        </button>
      </div>
    </div>
  );
}
