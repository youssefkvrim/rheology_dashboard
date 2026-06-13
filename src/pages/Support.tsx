import { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useTranslation } from '../i18n';
import { sendSupportRequest } from '../services/api';

type Category = 'bug' | 'feature' | 'access' | 'question' | 'other';

export default function Support() {
  const t = useTranslation();
  const { user } = useAuth();
  const CATEGORIES: Record<Category, string> = {
    bug: t('support.bugReport'),
    feature: t('support.featureRequest'),
    access: t('support.accessRequest'),
    question: t('support.generalQuestion'),
    other: t('support.other'),
  };
  const [category, setCategory] = useState<Category>('question');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);

  const openMailtoFallback = () => {
    const mailto = `mailto:youssef.karim@safrangroup.com?subject=${encodeURIComponent(`[Support - ${CATEGORIES[category]}] ${subject}`)}&body=${encodeURIComponent(`${user?.email || t('common.user')}\n\n${t('support.category')}: ${CATEGORIES[category]}\n\n${message}`)}`;
    window.open(mailto, '_blank');
  };

  const markSent = () => {
    setSent(true);
    setSubject('');
    setMessage('');
  };

  // sends the support ticket through the backend, with mailto when SMTP is absent
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      alert(t('support.fillAllFields'));
      return;
    }

    setSending(true);
    try {
      const result = await sendSupportRequest({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (result.ok) {
        markSent();
        return;
      }
      if (result.status === 503) {
        openMailtoFallback();
        markSent();
        return;
      }
      alert(t('support.sendError'));
    } catch (err) {
      alert(t('support.sendError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h2>{t('support.title')}</h2>

      {/* the form where u describe ur problem */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('support.contactSupport')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('support.fillForm')}
        </p>

        {sent ? (
          <div style={{ marginTop: 16, padding: 16, background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)' }}>
            <p style={{ margin: 0, color: '#16a34a' }}>
              {t('support.messageSent')}
            </p>
            <button onClick={() => setSent(false)} style={{ marginTop: 12 }}>
              {t('support.sendAnother')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 16, maxWidth: 500 }}>
            <div>
              <label>{t('support.category')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                style={{ width: '100%', marginTop: 4 }}
              >
                {(Object.entries(CATEGORIES) as [Category, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label>{t('support.subject')}</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('support.subjectPlaceholder')}
                style={{ width: '100%', marginTop: 4 }}
                required
              />
            </div>

            <div>
              <label>{t('support.message')}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('support.messagePlaceholder')}
                rows={6}
                style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
                required
              />
            </div>

            <div>
              <label>{t('support.yourEmail')}</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{ width: '100%', marginTop: 4, opacity: 0.7 }}
              />
            </div>

            <button type="submit" disabled={sending} style={{ marginTop: 8 }}>
              {sending ? t('support.sending') : t('support.sendMessage')}
            </button>
          </form>
        )}
      </div>

      {/* if u need help asap just email directly */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('support.directContact')}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('support.urgencies')}
        </p>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>
            Email : <a href="mailto:youssef.karim@safrangroup.com">youssef.karim@safrangroup.com</a>
          </li>
        </ul>
      </div>

      {/* common questions so u dont have to ask lol */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('support.faq')}</h3>
        <div style={{ marginTop: 12 }}>
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{t('support.faqExportCsv')}</summary>
            <p className="muted" style={{ marginTop: 8, paddingLeft: 16 }}>
              {t('support.faqExportCsvAnswer')}
            </p>
          </details>
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{t('support.faqBounds')}</summary>
            <p className="muted" style={{ marginTop: 8, paddingLeft: 16 }}>
              {t('support.faqBoundsAnswer')}
            </p>
          </details>
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{t('support.faqRights')}</summary>
            <p className="muted" style={{ marginTop: 8, paddingLeft: 16 }}>
              {t('support.faqRightsAnswer')}
            </p>
          </details>
        </div>
      </div>

      {/* heads up about the no-SMTP fallback */}
      <div className="panel" style={{ marginTop: 16, background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)' }}>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          <strong>Note :</strong> {t('support.note')}
        </p>
      </div>
    </div>
  );
}
