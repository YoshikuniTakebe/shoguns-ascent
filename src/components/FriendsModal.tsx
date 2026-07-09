import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';

export interface Friend {
  id: string;
  username: string;
  email: string;
}

/** Fetch the current user's friends list. Shared helper used by the lobby too. */
export async function fetchFriends(authToken: string): Promise<Friend[]> {
  try {
    const res = await fetch(`${API_BASE}/api/friends`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** "Add friend" modal: search a user by username/email and add them. */
export const AddFriendModal = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const authToken = useGameStore((s) => s.authToken);
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!identifier.trim() || !authToken) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/friends/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.alreadyFriend) {
          setMessage({ text: t('friends.alreadyFriend', { name: data.friend.username }), ok: true });
        } else {
          setMessage({ text: t('friends.added', { name: data.friend.username }), ok: true });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'self') setMessage({ text: t('friends.self'), ok: false });
        else if (err.error === 'not_found') setMessage({ text: t('friends.notFound'), ok: false });
        else setMessage({ text: t('friends.error'), ok: false });
      }
    } catch {
      setMessage({ text: t('friends.error'), ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="friends-modal-overlay" onClick={onClose}>
      <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
        <button className="friends-modal-close" onClick={onClose}>&times;</button>
        <h3 className="friends-modal-title">{t('friends.addTitle')}</h3>
        <input
          className="friends-modal-input"
          value={identifier}
          autoFocus
          placeholder={t('friends.addPlaceholder')}
          onChange={(e) => { setIdentifier(e.target.value); setMessage(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        {message && (
          <p className={`friends-modal-msg ${message.ok ? 'friends-modal-msg-ok' : 'friends-modal-msg-err'}`}>{message.text}</p>
        )}
        <div className="friends-modal-actions">
          {message?.ok ? (
            <button className="btn-primary" onClick={onClose}>{t('friends.accept')}</button>
          ) : (
            <>
              <button className="btn-primary" onClick={handleAdd} disabled={busy}>{t('friends.addButton')}</button>
              <button className="btn-secondary" onClick={onClose}>{t('friends.close')}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Friends list modal. */
export const FriendsListModal = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const authToken = useGameStore((s) => s.authToken);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authToken) return;
    fetchFriends(authToken).then((f) => { setFriends(f); setLoading(false); });
  }, [authToken]);

  return (
    <div className="friends-modal-overlay" onClick={onClose}>
      <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
        <button className="friends-modal-close" onClick={onClose}>&times;</button>
        <h3 className="friends-modal-title">{t('friends.listTitle')}</h3>
        {loading ? (
          <p className="friends-modal-msg">...</p>
        ) : friends.length === 0 ? (
          <p className="friends-modal-msg">{t('friends.empty')}</p>
        ) : (
          <div>
            {friends.map((f) => (
              <div key={f.id} className="friends-list-entry">
                <span className="friends-list-avatar">{f.username.charAt(0).toUpperCase()}</span>
                <span>{f.username}</span>
              </div>
            ))}
          </div>
        )}
        <div className="friends-modal-actions" style={{ marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={onClose}>{t('friends.close')}</button>
        </div>
      </div>
    </div>
  );
};
