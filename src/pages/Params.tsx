import { useState, useEffect } from 'react';
import { useI18n, Language, LANGUAGE_NAMES } from '../i18n';

type NotifChannel = 'email' | 'sms' | 'none';

// the color options u can pick from (each has a light + dark version)
const ACCENT_COLORS = [
  { name: 'Bleu Safran', light: '#0e224b', dark: '#9db0df' },
  { name: 'Bleu Ciel', light: '#0ea5e9', dark: '#7dd3fc' },
  { name: 'Vert', light: '#16a34a', dark: '#86efac' },
  { name: 'Violet', light: '#7c3aed', dark: '#c4b5fd' },
  { name: 'Orange', light: '#ea580c', dark: '#fdba74' },
];

// the settings page where u can change theme, language, alerts etc
export default function Params() {
  const { language, setLanguage, t, availableLanguages } = useI18n();

  const NOTIF_TYPES = [
    { key: 'density', label: t('alert.density') },
    { key: 'viscosity', label: t('alert.viscosity') },
    { key: 'ph', label: t('alert.ph') },
    { key: 'temperature', label: t('alert.temperature') },
    { key: 'tempRoom', label: t('alert.roomTemp') },
    { key: 'humidity', label: t('alert.humidity') },
    { key: 'system', label: t('alert.systemErrors') },
  ];

  // how u wanna get notifications (email, sms, or nah)
  const [notifChannel, setNotifChannel] = useState<NotifChannel>(() => {
    return (localStorage.getItem('notif-channel') as NotifChannel) || 'email';
  });

  // which alerts u actually care about
  const [notifTypes, setNotifTypes] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('notif-types') || '{}');
    } catch { return {}; }
  });

  // the accent color for the whole app
  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('accent-color') || '#0e224b';
  });

  // how often the data refreshes (in seconds)
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    return Number(localStorage.getItem('refresh-interval')) || 30;
  });

  // default chart display options (avg line, trend line, etc)
  const [defaultAvgOn, setDefaultAvgOn] = useState<boolean>(() => {
    return localStorage.getItem('default-avg-on') !== 'false';
  });
  const [defaultTrendOn, setDefaultTrendOn] = useState<boolean>(() => {
    return localStorage.getItem('default-trend-on') === 'true';
  });
  const [defaultDeltaY, setDefaultDeltaY] = useState<number>(() => {
    return Number(localStorage.getItem('default-delta-y')) || 0;
  });

  // finds the color pair that matches what the user picked
  const currentAccent = ACCENT_COLORS.find(c => c.light === accentColor) || ACCENT_COLORS[0];

  // all these effects just save ur preferences to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('notif-channel', notifChannel);
  }, [notifChannel]);

  useEffect(() => {
    localStorage.setItem('notif-types', JSON.stringify(notifTypes));
  }, [notifTypes]);

  // also updates the css variables so the whole app changes color instantly
  useEffect(() => {
    localStorage.setItem('accent-color', accentColor);
    const pair = ACCENT_COLORS.find(c => c.light === accentColor);
    if (pair) {
      document.documentElement.style.setProperty('--accent', pair.light);
      document.documentElement.style.setProperty('--accent-dark', pair.dark);
    }
  }, [accentColor]);

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

      {/* how u wanna be notified about alerts */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.notifications')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('params.howToReceiveAlerts')}
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
              {ch === 'email' ? t('params.email') : ch === 'sms' ? t('params.sms') : t('params.none')}
            </button>
          ))}
        </div>

        {notifChannel !== 'none' && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ fontSize: 12 }}>{t('params.notifTypes')}</p>
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

      {/* pick ur fav color for the app theme */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.accentColor')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('params.accentColorDesc')}
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

      {/* language picker */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.language')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('params.chooseLanguage')}
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

      {/* how often data auto-refreshes */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.refreshInterval')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>{t('params.refreshDesc')}</p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input
            type="number"
            min={5}
            max={300}
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Math.max(5, Math.min(300, Number(e.target.value))))}
            style={{ width: 80 }}
          />
          <span className="muted">{t('params.seconds')}</span>
        </div>
      </div>

      {/* default chart look (avg line, trend, etc) */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.defaultChartParams')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('params.chartDefaultsDesc')}
        </p>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={defaultAvgOn}
              onChange={(e) => setDefaultAvgOn(e.target.checked)}
            />
            {t('params.showAverage')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={defaultTrendOn}
              onChange={(e) => setDefaultTrendOn(e.target.checked)}
            />
            {t('params.showTrend')}
          </label>
          <div>
            <label>{t('params.uncertainty')}</label>
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

      {/* nuke everything and start fresh */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('params.resetAll')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('params.resetDesc')}
        </p>
        <button
          style={{ marginTop: 8, background: '#ef4444', borderColor: '#dc2626' }}
          onClick={() => {
            if (!confirm(t('params.resetConfirm'))) return;
          try {
            // wipes all saved prefs from local storage then reloads the page
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
          {t('params.resetButton')}
        </button>
      </div>
    </div>
  );
}
