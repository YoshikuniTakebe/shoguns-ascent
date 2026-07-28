import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import { FRIENDS_CHANGED_EVENT, fetchFriendRequests, fetchFriends, respondToFriendRequest, sendFriendRequest } from '../utils/friendsApi';
import type { Friend, FriendRequests } from '../utils/friendsApi';

function announceFriendRequestsChanged() {
  window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT));
}

export const FriendRequestBadge = () => {
  const authToken = useGameStore((s) => s.authToken);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!authToken) {
      setCount(0);
      return;
    }
    const refresh = () => {
      fetchFriendRequests(authToken).then(requests => setCount(requests.incoming.length));
    };
    refresh();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh);
    };
  }, [authToken]);

  return count > 0 ? <span className="friend-request-badge">{count > 9 ? '9+' : count}</span> : null;
};

/** "Add friend" modal: search a user by username/email and send a request. */
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
      const data = await sendFriendRequest(authToken, identifier.trim());
      const messages = {
        sent: t('friends.requestSent', { name: data.user.username }),
        already_friend: t('friends.alreadyFriend', { name: data.user.username }),
        already_pending: t('friends.requestAlreadyPending', { name: data.user.username }),
        incoming_pending: t('friends.requestIncomingPending', { name: data.user.username }),
      };
      setMessage({ text: messages[data.status], ok: true });
      announceFriendRequestsChanged();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'self') setMessage({ text: t('friends.self'), ok: false });
      else if (code === 'not_found') setMessage({ text: t('friends.notFound'), ok: false });
      else setMessage({ text: t('friends.error'), ok: false });
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
            <button className="btn-primary" onClick={onClose}>{t('friends.close')}</button>
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
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!authToken) return;
    Promise.all([fetchFriends(authToken), fetchFriendRequests(authToken)])
      .then(([nextFriends, nextRequests]) => {
        setFriends(nextFriends);
        setRequests(nextRequests);
        setLoading(false);
      });
  }, [authToken]);

  const handleRequest = async (requestId: string, action: 'accept' | 'reject') => {
    if (!authToken) return;
    setBusyRequestId(requestId);
    setMessage(null);
    const success = await respondToFriendRequest(authToken, requestId, action);
    if (!success) {
      setMessage({ text: t('friends.requestActionError'), ok: false });
      setBusyRequestId(null);
      return;
    }
    const [nextFriends, nextRequests] = await Promise.all([
      fetchFriends(authToken),
      fetchFriendRequests(authToken),
    ]);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setMessage({
      text: action === 'accept' ? t('friends.requestAccepted') : t('friends.requestRejected'),
      ok: true,
    });
    setBusyRequestId(null);
    announceFriendRequestsChanged();
  };

  const hasContent = requests.incoming.length > 0 || requests.outgoing.length > 0 || friends.length > 0;

  return (
    <div className="friends-modal-overlay" onClick={onClose}>
      <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
        <button className="friends-modal-close" onClick={onClose}>&times;</button>
        <h3 className="friends-modal-title">{t('friends.listTitle')}</h3>
        {loading ? (
          <p className="friends-modal-msg">...</p>
        ) : !hasContent ? (
          <p className="friends-modal-msg">{t('friends.empty')}</p>
        ) : (
          <div className="friends-modal-sections">
            {requests.incoming.length > 0 && (
              <section className="friends-modal-section">
                <h4>{t('friends.requestsReceived')}</h4>
                {requests.incoming.map(request => (
                  <div key={request.id} className="friends-list-entry friend-request-entry">
                    <span className="friends-list-avatar">{request.user.username.charAt(0).toUpperCase()}</span>
                    <span className="friend-request-name">{request.user.username}</span>
                    <div className="friend-request-actions">
                      <button
                        className="friend-request-action friend-request-accept"
                        disabled={busyRequestId === request.id}
                        onClick={() => handleRequest(request.id, 'accept')}
                      >
                        {t('friends.accept')}
                      </button>
                      <button
                        className="friend-request-action friend-request-reject"
                        disabled={busyRequestId === request.id}
                        onClick={() => handleRequest(request.id, 'reject')}
                      >
                        {t('friends.reject')}
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {requests.outgoing.length > 0 && (
              <section className="friends-modal-section">
                <h4>{t('friends.requestsSent')}</h4>
                {requests.outgoing.map(request => (
                  <div key={request.id} className="friends-list-entry">
                    <span className="friends-list-avatar">{request.user.username.charAt(0).toUpperCase()}</span>
                    <span className="friend-request-name">{request.user.username}</span>
                    <span className="friend-request-pending">{t('friends.requestPending')}</span>
                  </div>
                ))}
              </section>
            )}
            {friends.length > 0 && (
              <section className="friends-modal-section">
                <h4>{t('friends.yourFriends')}</h4>
                {friends.map((friend) => (
                  <div key={friend.id} className="friends-list-entry">
                    <span className="friends-list-avatar">{friend.username.charAt(0).toUpperCase()}</span>
                    <span>{friend.username}</span>
                  </div>
                ))}
              </section>
            )}
            {message && (
              <p className={`friends-modal-msg ${message.ok ? 'friends-modal-msg-ok' : 'friends-modal-msg-err'}`}>
                {message.text}
              </p>
            )}
          </div>
        )}
        {!loading && message && !hasContent && (
          <p className={`friends-modal-msg ${message.ok ? 'friends-modal-msg-ok' : 'friends-modal-msg-err'}`}>
            {message.text}
          </p>
        )}
        <div className="friends-modal-actions" style={{ marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={onClose}>{t('friends.close')}</button>
        </div>
      </div>
    </div>
  );
};
