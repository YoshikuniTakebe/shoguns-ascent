import { API_BASE } from '../config';

export const FRIENDS_CHANGED_EVENT = 'shoguns:friends-changed';

export interface Friend {
  id: string;
  username: string;
}

export interface FriendRequest {
  id: string;
  user: Friend;
  createdAt: string;
}

export interface FriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export type SendFriendRequestStatus = 'sent' | 'already_friend' | 'already_pending' | 'incoming_pending';

export async function fetchFriends(authToken: string): Promise<Friend[]> {
  try {
    const response = await fetch(`${API_BASE}/api/friends`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) return [];
    return await response.json() as Friend[];
  } catch {
    return [];
  }
}

export async function fetchFriendRequests(authToken: string): Promise<FriendRequests> {
  try {
    const response = await fetch(`${API_BASE}/api/friends/requests`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) return { incoming: [], outgoing: [] };
    return await response.json() as FriendRequests;
  } catch {
    return { incoming: [], outgoing: [] };
  }
}

export async function sendFriendRequest(
  authToken: string,
  identifier: string,
): Promise<{ status: SendFriendRequestStatus; user: Friend }> {
  const response = await fetch(`${API_BASE}/api/friends/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ identifier }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'request_failed');
  return data as { status: SendFriendRequestStatus; user: Friend };
}

export async function respondToFriendRequest(
  authToken: string,
  requestId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/friends/requests/${encodeURIComponent(requestId)}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
