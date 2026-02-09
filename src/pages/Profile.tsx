import { useState, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { hashPassword } from '../services/api';

export default function Profile() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local state for editable fields (stub - will connect to UTILISATEUR table)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>(() => {
    const email = user?.email || '';
    const base = (email.split('@')[0] || '').replace(/[_.-]/g, ' ').trim();
    const parts = base.split(/\s+/).filter(Boolean);
    return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : base || 'Utilisateur';
  });
  const [email, setEmail] = useState<string>(user?.email || '');
  const [phoneRaw, setPhoneRaw] = useState<string>('');
  const [role, setRole] = useState<string>(() => {
    const e = user?.email?.toLowerCase() || '';
    return e === 'youssef.karim@safrangroup.com' ? 'Editor' : 'Read-only';
  });

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Admin rights dialog state
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminEmailError, setAdminEmailError] = useState('');
  const [adminSending, setAdminSending] = useState(false);

  // Initials for avatar fallback
  const initials = (() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
      : displayName.charAt(0).toUpperCase();
  })();

  // Phone formatting: display with spaces, store raw digits
  const formatPhoneDisplay = (raw: string): string => {
    if (!raw) return '';
    // Format: +33 6 12 34 56 78
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 2) return '+' + digits;
    let formatted = '+' + digits.slice(0, 2);
    for (let i = 2; i < digits.length; i += 2) {
      formatted += ' ' + digits.slice(i, i + 2);
    }
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const lastChar = input.slice(-1);
    
    // If empty, reset
    if (!input) {
      setPhoneRaw('');
      return;
    }
    
    // Get only digits from input
    let digits = input.replace(/[^\d+]/g, '').replace(/\+/g, '');
    
    // Handle first character cases
    if (phoneRaw === '' && digits.length === 1) {
      if (lastChar === '+') {
        // User typed +, start with empty (will show +)
        setPhoneRaw('');
        return;
      } else if (lastChar === '0') {
        // User typed 0, prefill +33
        setPhoneRaw('33');
        return;
      } else if (/[1-9]/.test(lastChar)) {
        // User typed a digit 1-9, prefill +33 + that digit
        setPhoneRaw('33' + lastChar);
        return;
      } else if (/[a-zA-Z]/.test(lastChar)) {
        // Ignore letters
        return;
      }
    }
    
    // Filter out any letters
    digits = digits.replace(/[a-zA-Z]/g, '');
    
    // Limit to 15 digits (after +33, so 17 total including country code)
    if (digits.length > 17) {
      digits = digits.slice(0, 17);
    }
    
    setPhoneRaw(digits);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  };

  const handleSave = () => {
    // TODO: Connect to backend UTILISATEUR table
    alert('Modifications enregistrées (simulation). Connecter au backend UTILISATEUR pour persistance.');
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (!newPassword || !confirmPassword) {
      setPasswordError('Veuillez remplir tous les champs.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    try {
      const hashedPassword = await hashPassword(newPassword);
      console.log('New password hash:', hashedPassword);
      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError('Erreur lors du changement de mot de passe.');
    }
  };

  const handleForgotPassword = () => {
    alert('Un email de réinitialisation sera envoyé à votre adresse.');
    setShowPasswordModal(false);
  };

  const handleAdminRequest = () => {
    setAdminEmailError('');
    if (!adminEmail) {
      setAdminEmailError('Email du supérieur requis.');
      return;
    }
    if (!adminEmail.toLowerCase().endsWith('@safrangroup.com')) {
      setAdminEmailError('L\'email doit être @safrangroup.com');
      return;
    }
    setAdminSending(true);
    // Simulate sending
    setTimeout(() => {
      alert(`Demande envoyée à ${adminEmail}`);
      setShowAdminDialog(false);
      setAdminEmail('');
      setAdminMessage('');
      setAdminSending(false);
    }, 1000);
  };

  return (
    <div>
      <h2>Profil</h2>

      {/* Avatar section */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Photo de profil</h3>
        <div className="row" style={{ gap: 16, alignItems: 'center', marginTop: 12 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '2px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              background: avatarUrl ? 'transparent' : '#f3f4f6',
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 28, fontWeight: 600, color: '#374151' }}>{initials}</span>
            )}
          </div>
          <div>
            <button onClick={() => fileInputRef.current?.click()}>Changer la photo</button>
            {avatarUrl && (
              <button onClick={() => setAvatarUrl(null)} style={{ marginLeft: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Supprimer
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      {/* Personal info */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Informations personnelles</h3>
        <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 400 }}>
          <div>
            <label>Nom complet</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label>Téléphone</label>
            <input
              type="tel"
              value={formatPhoneDisplay(phoneRaw)}
              onChange={handlePhoneChange}
              placeholder="+33 6 XX XX XX XX"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label>Rôle actuel</label>
            <input
              type="text"
              value={role}
              disabled
              style={{ width: '100%', marginTop: 4, opacity: 0.7 }}
            />
          </div>
          <button onClick={handleSave} style={{ marginTop: 8 }}>Enregistrer les modifications</button>
        </div>
      </div>

      {/* Password section - same width as other inputs */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Mot de passe</h3>
        <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="password"
              value="You really thought I'd show it?"
              readOnly
              style={{ flex: 1, cursor: 'default', fontStyle: 'italic', color: 'var(--muted)' }}
            />
            <button onClick={() => setShowPasswordModal(true)}>Modifier</button>
          </div>
        </div>
      </div>

      {/* Password change modal */}
      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Changer le mot de passe</h3>
              <button className="icon-btn" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {passwordSuccess ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#16a34a' }}>
                  ✓ Mot de passe modifié avec succès !
                </div>
              ) : (
                <>
                  <div>
                    <label>Ancien mot de passe</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      style={{ width: '100%', marginTop: 4 }}
                      autoComplete="current-password"
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label>Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ width: '100%', marginTop: 4 }}
                      autoComplete="new-password"
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label>Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ width: '100%', marginTop: 4 }}
                      autoComplete="new-password"
                    />
                  </div>
                  {passwordError && (
                    <div className="badge err" style={{ marginTop: 8 }}>{passwordError}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                    <button
                      onClick={handleForgotPassword}
                      style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}
                    >
                      J'ai oublié mon ancien mot de passe
                    </button>
                    <button onClick={handlePasswordChange}>Enregistrer</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin rights request */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Droits d'accès</h3>
        <p className="muted" style={{ marginTop: 8 }}>
          Votre niveau d'accès actuel : <strong>{role}</strong>
        </p>
        <button
          onClick={() => setShowAdminDialog(true)}
          disabled={role === 'Admin'}
          style={{ marginTop: 8 }}
        >
          Demander des droits supérieurs
        </button>
      </div>

      {/* Admin rights dialog */}
      {showAdminDialog && (
        <div className="modal-backdrop" onClick={() => setShowAdminDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Demander des droits supérieurs</h3>
              <button className="icon-btn" onClick={() => setShowAdminDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
                Trois niveaux de droits existent :
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 13, color: 'var(--muted)' }}>
                <li><strong>Read-only</strong> : Consultation des données uniquement</li>
                <li><strong>Editor</strong> : Modification des données et paramètres</li>
                <li><strong>Admin</strong> : Gestion complète (utilisateurs, configuration système)</li>
              </ul>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
                Votre demande sera envoyée au supérieur indiqué pour validation.
              </p>
              <div>
                <label>Email du supérieur hiérarchique *</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="prenom.nom@safrangroup.com"
                  style={{ width: '100%', marginTop: 4 }}
                />
                {adminEmailError && (
                  <div className="badge err" style={{ marginTop: 4 }}>{adminEmailError}</div>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <label>Message (optionnel)</label>
                <textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Expliquez pourquoi vous avez besoin de droits supérieurs..."
                  style={{ width: '100%', marginTop: 4, minHeight: 80, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => setShowAdminDialog(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  Annuler
                </button>
                <button onClick={handleAdminRequest} disabled={adminSending}>
                  {adminSending ? 'Envoi...' : 'Envoyer la demande'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note about future UTILISATEUR table */}
      <div className="panel" style={{ marginTop: 16, background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)' }}>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          <strong>Note :</strong> Cette page doit encore être connectée à la table UTILISATEUR.
          Pour l'instant c'est que du front-end. Les champs seront persistés via PUT /api/user une fois le backend configuré.
        </p>
      </div>
    </div>
  );
}
