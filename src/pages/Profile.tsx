import { useState, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useTranslation } from '../i18n';

export default function Profile() {
  const t = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // all the profile fields u can edit (not saved to backend yet tho)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // basically turns ur email into a display name like "youssef karim"
  const [displayName, setDisplayName] = useState<string>(() => {
    const email = user?.email || '';
    const base = (email.split('@')[0] || '').replace(/[_.-]/g, ' ').trim();
    const parts = base.split(/\s+/).filter(Boolean);
    return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : base || t('common.user');
  });
  const [email, setEmail] = useState<string>(user?.email || '');
  const [phoneRaw, setPhoneRaw] = useState<string>('');
  // hardcoded role check lol, only youssef gets editor
  const [role, setRole] = useState<string>(() => {
    const e = user?.email?.toLowerCase() || '';
    return e === 'youssef.karim@safrangroup.com' ? 'Editor' : 'Read-only';
  });

  // password change stuff
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // for when u wanna request admin rights
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminEmailError, setAdminEmailError] = useState('');
  const [adminSending, setAdminSending] = useState(false);

  // grabs ur initials so we can show them if u have no profile pic
  const initials = (() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
      : displayName.charAt(0).toUpperCase();
  })();

  // makes the phone number look nice with spaces like +33 6 12 34 56 78
  const formatPhoneDisplay = (raw: string): string => {
    if (!raw) return '';
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
    
    // nothing typed? reset
    if (!input) {
      setPhoneRaw('');
      return;
    }
    
    // strip everything thats not a digit
    let digits = input.replace(/[^\d+]/g, '').replace(/\+/g, '');
    
    // smart auto-fill: typing 0 or any digit auto-adds the +33 french prefix
    if (phoneRaw === '' && digits.length === 1) {
      if (lastChar === '+') {
        setPhoneRaw('');
        return;
      } else if (lastChar === '0') {
        setPhoneRaw('33');
        return;
      } else if (/[1-9]/.test(lastChar)) {
        setPhoneRaw('33' + lastChar);
        return;
      } else if (/[a-zA-Z]/.test(lastChar)) {
        return;
      }
    }
    
    // no letters allowed lol
    digits = digits.replace(/[a-zA-Z]/g, '');
    
    // cap it at 17 digits max (country code included)
    if (digits.length > 17) {
      digits = digits.slice(0, 17);
    }
    
    setPhoneRaw(digits);
  };

  // turns the uploaded file into a url we can display as avatar
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  };

  const handleSave = () => {
    // TODO: this is fake rn, gotta connect it to the real backend later
    alert('Modifications enregistrées (simulation). Connecter au backend UTILISATEUR pour persistance.');
  };

  // checks if the passwords match; backend password-change wiring is still pending
  const handlePasswordChange = () => {
    setPasswordError('');
    if (!newPassword || !confirmPassword) {
      setPasswordError(t('profile.fillAllFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordsNoMatch'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('profile.passwordTooShort'));
      return;
    }

    setPasswordSuccess(true);
    // waits 2s so u can see the success msg then closes the modal
    setTimeout(() => {
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(false);
    }, 2000);
  };

  const handleForgotPassword = () => {
    alert(t('login.resetRequested'));
    setShowPasswordModal(false);
  };

  // sends the admin rights request (only safrangroup emails allowed)
  const handleAdminRequest = () => {
    setAdminEmailError('');
    if (!adminEmail) {
      setAdminEmailError(t('profile.supervisorEmailRequired'));
      return;
    }
    if (!adminEmail.toLowerCase().endsWith('@safrangroup.com')) {
      setAdminEmailError(t('profile.emailMustBeSafran'));
      return;
    }
    setAdminSending(true);
    // fake delay to pretend its sending lol
    setTimeout(() => {
      alert(`${t('profile.requestSent')} ${adminEmail}`);
      setShowAdminDialog(false);
      setAdminEmail('');
      setAdminMessage('');
      setAdminSending(false);
    }, 1000);
  };

  return (
    <div>
      <h2>{t('profile.title')}</h2>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('profile.profilePicture')}</h3>
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
            <button onClick={() => fileInputRef.current?.click()}>{t('profile.changeAvatar')}</button>
            {avatarUrl && (
              <button onClick={() => setAvatarUrl(null)} style={{ marginLeft: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                {t('profile.removeAvatar')}
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

      {/* ur name, email, phone etc */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('profile.personalInfo')}</h3>
        <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 400 }}>
          <div>
            <label>{t('profile.fullName')}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label>{t('profile.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label>{t('profile.phone')}</label>
            <input
              type="tel"
              value={formatPhoneDisplay(phoneRaw)}
              onChange={handlePhoneChange}
              placeholder="+33 6 XX XX XX XX"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label>{t('profile.currentRole')}</label>
            <input
              type="text"
              value={role}
              disabled
              style={{ width: '100%', marginTop: 4, opacity: 0.7 }}
            />
          </div>
          <button onClick={handleSave} style={{ marginTop: 8 }}>{t('profile.saveChanges')}</button>
        </div>
      </div>

      {/* password section */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('profile.password')}</h3>
        <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="password"
              value="You really thought I'd show it?"
              readOnly
              style={{ flex: 1, cursor: 'default', fontStyle: 'italic', color: 'var(--muted)' }}
            />
            <button onClick={() => setShowPasswordModal(true)}>{t('profile.changePassword')}</button>
          </div>
        </div>
      </div>

      {/* the popup where u actually change ur password */}
      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{t('profile.changePasswordTitle')}</h3>
              <button className="icon-btn" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {passwordSuccess ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#16a34a' }}>
                  {t('profile.passwordChanged')}
                </div>
              ) : (
                <>
                  <div>
                    <label>{t('profile.oldPassword')}</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      style={{ width: '100%', marginTop: 4 }}
                      autoComplete="current-password"
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label>{t('profile.newPassword')}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ width: '100%', marginTop: 4 }}
                      autoComplete="new-password"
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label>{t('profile.confirmNewPassword')}</label>
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
                      {t('profile.forgotOldPassword')}
                    </button>
                    <button onClick={handlePasswordChange}>{t('common.save')}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* section to request more permissions */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>{t('profile.accessRights')}</h3>
        <p className="muted" style={{ marginTop: 8 }}>
          {t('profile.accessLevel')} <strong>{role}</strong>
        </p>
        <button
          onClick={() => setShowAdminDialog(true)}
          disabled={role === 'Admin'}
          style={{ marginTop: 8 }}
        >
          {t('profile.requestRights')}
        </button>
      </div>

      {/* popup for requesting admin rights from ur supervisor */}
      {showAdminDialog && (
        <div className="modal-backdrop" onClick={() => setShowAdminDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{t('profile.requestRights')}</h3>
              <button className="icon-btn" onClick={() => setShowAdminDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
                {t('profile.rightsLevels')}
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 13, color: 'var(--muted)' }}>
                <li><strong>{t('profile.readOnly')}</strong> : {t('profile.readOnlyDesc')}</li>
                <li><strong>{t('profile.editor')}</strong> : {t('profile.editorDesc')}</li>
                <li><strong>{t('profile.admin')}</strong> : {t('profile.adminDesc')}</li>
              </ul>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
                {t('profile.requestSentTo')}
              </p>
              <div>
                <label>{t('profile.supervisorEmail')}</label>
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
                <label>{t('profile.messageOptional')}</label>
                <textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder=""
                  style={{ width: '100%', marginTop: 4, minHeight: 80, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => setShowAdminDialog(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  {t('common.cancel')}
                </button>
                <button onClick={handleAdminRequest} disabled={adminSending}>
                  {adminSending ? t('profile.sending') : t('profile.sendRequest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* lil warning that this page is still a work in progress tbh */}
      <div className="panel" style={{ marginTop: 16, background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)' }}>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          <strong>Note :</strong> {t('profile.note')}
        </p>
      </div>
    </div>
  );
}
