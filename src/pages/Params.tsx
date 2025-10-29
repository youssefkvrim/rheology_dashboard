export default function Params() {
  return (
    <div>
      <h2>Paramètres</h2>
      <p className="muted">Paramètres de démonstration. Rien de persistant ici.</p>
      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Réinitialiser paramètres graphiques</h3>
        <p className="muted">Supprime les unités, options (moyenne, tendance, ΔY, fenêtre), et bornes min/max enregistrées pour toutes les barbotines (utilisateur courant).</p>
        <button className="borderline" onClick={() => {
          try {
            const userId = sessionStorage.getItem('userId') || 'anonymous';
            localStorage.removeItem(`chartParams:${userId}`);
            localStorage.removeItem(`chartParamsById:${userId}`);
            localStorage.removeItem(`bounds:${userId}`);
            localStorage.removeItem(`boundsById:${userId}`);
          } finally {
            window.location.reload();
          }
        }}>Supprimer tous les paramètres graphiques</button>
      </div>
      <ul>
        <li>Rafraîchissement: 5 secondes</li>
        <li>Seed: via ?seed=123</li>
        <li>Bornes: définies dans le code</li>
      </ul>
    </div>
  );
}


