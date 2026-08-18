import { useEffect, useState } from 'react';

function NotificationBell({ accessToken, socket }) {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // Fetch existing notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/notifications', {
          headers: authHeaders
        });
        const data = await res.json();
        setNotifications(data.notifications || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchNotifications();
  }, []);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      setNotifications(prev => [notification, ...prev]);
    };

    const handleKicked = ({ channelId }) => {
      setNotifications(prev => [{
        type: 'kicked',
        content: 'You were removed from a channel',
        channelId,
        created_at: new Date().toISOString()
      }, ...prev]);
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('kicked_from_channel', handleKicked);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('kicked_from_channel', handleKicked);
    };
  }, [socket]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    try {
      await fetch('http://localhost:5000/api/notifications/mark-read', {
        method: 'POST',
        headers: authHeaders
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (!showDropdown) markAllRead();
        }}
        style={{
          position: 'relative',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid #ccc',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          fontSize: 18
        }}
      >
        🔔
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: 16, height: 16,
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: 320,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxHeight: 400,
          overflowY: 'auto'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>Notifications</h4>
            <button
              onClick={markAllRead}
              style={{ fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', color: '#007bff' }}
            >
              Mark all read
            </button>
          </div>

          {notifications.length === 0 ? (
            <p style={{ padding: 16, color: '#aaa', fontSize: 13, textAlign: 'center' }}>
              No notifications
            </p>
          ) : (
            notifications.map((notif, index) => (
              <div
                key={notif.id || index}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: notif.is_read ? 'transparent' : '#eff6ff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: '#333' }}>
                    {notif.content}
                  </p>
                  <span style={{ fontSize: 11, color: '#aaa' }}>
                    {new Date(notif.created_at).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                {notif.id && (
                  <button
                    onClick={() => deleteNotification(notif.id)}
                    style={{
                      border: 'none', background: 'none',
                      cursor: 'pointer', color: '#aaa', fontSize: 14
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;