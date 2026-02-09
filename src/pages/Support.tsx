import { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';

type Category = 'bug' | 'feature' | 'access' | 'question' | 'other';

const CATEGORIES: Record<Category, string> = {
  bug: 'Signaler un bug',
  feature: 'Demande de fonctionnalité',
  access: 'Demande d\'accès / permissions',
  question: 'Question générale',
  other: 'Autre',
};

export default function Support() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>('question');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      alert('Veuillez remplir tous les champs.');
      return;
    }

    setSending(true);
    try {
      // TODO: Replace with actual SMTP/SAML email sending via backend
      // POST /api/support { category, subject, message, userEmail }
      // Backend should use nodemailer with SMTP config from vault/secrets.env
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate network delay

      // For now, open mailto as fallback
      const mailto = `mailto:youssef.karim@safrangroup.com?subject=${encodeURIComponent(`[Support - ${CATEGORIES[category]}] ${subject}`)}&body=${encodeURIComponent(`De: ${user?.email || 'Utilisateur'}\n\nCatégorie: ${CATEGORIES[category]}\n\n${message}`)}`;
      window.open(mailto, '_blank');

      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err) {
      alert('Erreur lors de l\'envoi. Veuillez réessayer.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h2>Support</h2>

      {/* Contact form - FIRST */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Contacter le support</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Remplissez le formulaire ci-dessous. Votre message sera envoyé à l'équipe de support.
        </p>

        {sent ? (
          <div style={{ marginTop: 16, padding: 16, background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)' }}>
            <p style={{ margin: 0, color: '#16a34a' }}>
              ✓ Votre message a été envoyé. Nous vous répondrons dans les plus brefs délais.
            </p>
            <button onClick={() => setSent(false)} style={{ marginTop: 12 }}>
              Envoyer un autre message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 16, maxWidth: 500 }}>
            <div>
              <label>Catégorie</label>
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
              <label>Sujet</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Décrivez brièvement votre demande"
                style={{ width: '100%', marginTop: 4 }}
                required
              />
            </div>

            <div>
              <label>Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Détaillez votre demande..."
                rows={6}
                style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
                required
              />
            </div>

            <div>
              <label>Votre email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{ width: '100%', marginTop: 4, opacity: 0.7 }}
              />
            </div>

            <button type="submit" disabled={sending} style={{ marginTop: 8 }}>
              {sending ? 'Envoi en cours...' : 'Envoyer le message'}
            </button>
          </form>
        )}
      </div>

      {/* Direct contact - SECOND */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Contact direct</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Pour les urgences ou questions techniques :
        </p>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>
            Email : <a href="mailto:youssef.karim@safrangroup.com">youssef.karim@safrangroup.com</a>
          </li>
        </ul>
      </div>

      {/* FAQ / Quick links - THIRD */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Questions fréquentes</h3>
        <div style={{ marginTop: 12 }}>
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Comment exporter mes données en CSV ?</summary>
            <p className="muted" style={{ marginTop: 8, paddingLeft: 16 }}>
              Allez dans la page "Données", sélectionnez une barbotine et une période, puis cliquez sur "Télécharger CSV".
            </p>
          </details>
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Comment modifier les bornes de conformité ?</summary>
            <p className="muted" style={{ marginTop: 8, paddingLeft: 16 }}>
              Sur chaque graphique, cliquez sur "…" puis modifiez les valeurs min/max dans la section "Conformité".
            </p>
          </details>
          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Comment demander des droits supplémentaires ?</summary>
            <p className="muted" style={{ marginTop: 8, paddingLeft: 16 }}>
              Allez dans votre Profil et cliquez sur "Demander des droits supérieurs". Un administrateur traitera votre demande.
            </p>
          </details>
        </div>
      </div>

      {/* Developer note */}
      <div className="panel" style={{ marginTop: 16, background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)' }}>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          <strong>Note :</strong> Le formulaire utilise actuellement mailto comme fallback.
          Pour une vraie intégration SMTP/SAML, configurer les variables dans vault/secrets.env
          (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) et implémenter POST /api/support. -voir démarche avec Javid MOUGAMADOU
        </p>
      </div>
    </div>
  );
}
