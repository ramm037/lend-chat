import { useEffect, useState, useRef } from 'react';
import ImageUpload from './ImageUpload';

function DMView({ dm, accessToken, socket, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState(null);

  const typingTimeoutRef = useRef(null);
  const bottomRef = useRef(null);

  // Load DM message history
  useEffect(() => {
    if (!dm) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/messages/${dm.id}?limit=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        setMessages(data.messages || []);
        setHasMore(data.hasMore || false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    return () => {
      setMessages([]);
      setTypingUsers([]);
      setHasMore(false);
    };
  }, [dm]);

  // Load older messages when user clicks "Load older messages"
  const loadMoreMessages = async () => {
    if (!dm || messages.length === 0 || loadingMore) return;

    setLoadingMore(true);
    const oldestId = messages[0].id;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/messages/${dm.id}?before=${oldestId}&limit=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();

      if (data.messages.length > 0) {
        setMessages(prev => [...data.messages, ...prev]);
        setHasMore(data.hasMore || false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Listen for incoming DMs + typing events
  useEffect(() => {
    if (!socket || !dm) return;

    const handleNewDM = (message) => {
      console.log('new_dm received:', message);
      console.log('dm.id:', dm?.id);
      console.log('match dm_id:', Number(message.dm_id) === Number(dm?.id));
      console.log('match channel_id:', Number(message.channel_id) === Number(dm?.id));

      if (Number(message.dm_id) === Number(dm?.id) ||
        Number(message.channel_id) === Number(dm?.id)) {
        setMessages(prev => [...prev, message]);
      }
    };

    const handleTypingStart = ({ username, channelId }) => {
      if (Number(channelId) === Number(dm.id)) {
        setTypingUsers(prev =>
          prev.includes(username) ? prev : [...prev, username]
        );
      }
    };

    const handleTypingStop = ({ channelId, username: typingUsername }) => {
      if (Number(channelId) === Number(dm.id)) {
        setTypingUsers(prev => prev.filter(u => u !== typingUsername));
      }
    };

    socket.on('dm_message_deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    socket.on('new_dm', handleNewDM);
    socket.on('user_typing', handleTypingStart);
    socket.on('user_stopped_typing', handleTypingStop);

    return () => {
      socket.off('new_dm', handleNewDM);
      socket.off('user_typing', handleTypingStart);
      socket.off('user_stopped_typing', handleTypingStop);
      socket.off('dm_message_deleted');
    };
  }, [socket, dm]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  //delete message function
  const deleteDMMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/dms/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      if (res.ok) {
        // Notify other user in real time
        socket.emit('delete_dm_message', { dmId: dm.id, messageId });
        // Remove locally
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  //clear entire dm
  const clearDM = async () => {
    if (!window.confirm('Clear this conversation? Only clears for you.')) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/dms/${dm.id}/clear`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      if (res.ok) {
        setMessages([]); // clear locally immediately
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!socket || !dm) return;

    // isDM: true so server uses dm_ room prefix
    socket.emit('typing_start', { channelId: dm.id, isDM: true });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { channelId: dm.id, isDM: true });
    }, 2000);
  };

  const sendDM = () => {
    if (!input.trim() || !socket || !dm) return;

    socket.emit('send_dm', {
      dmId: dm.id,
      content: input.trim()
    });

    // Stop typing indicator on send
    socket.emit('typing_stop', { channelId: dm.id, isDM: true });
    clearTimeout(typingTimeoutRef.current);

    setInput('');
  };

  if (!dm) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
        <p>Select a conversation</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--surface)'
      }}>
        <h3 style={{ margin: 0, color: 'var(--text-h)' }}>@ {dm.other_username}</h3>
        <button
          onClick={clearDM}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer'
          }}
          title="Clear conversation for you only"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Load more button at top */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <button
              onClick={loadMoreMessages}
              disabled={loadingMore}
              style={{
                padding: '6px 16px',
                borderRadius: 4,
                border: '1px solid #ccc',
                backgroundColor: 'transparent',
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                fontSize: 13,
                color: '#666'
              }}
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {loading && <p style={{ color: '#aaa' }}>Loading...</p>}

        {!loading && messages.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>
            Start the conversation 👋
          </p>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            onMouseEnter={() => setHoveredMsg(msg.id)}
            onMouseLeave={() => setHoveredMsg(null)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '8px 12px', borderRadius: 8,
              backgroundColor: hoveredMsg === msg.id ? 'var(--surface-hover)' : 'transparent',
              position: 'relative', transition: 'background 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: '600', fontSize: 14, color: 'var(--accent-bright)' }}>
                {msg.username}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
              {/* Delete button — only shows on hover for sender's own messages */}
              {hoveredMsg === msg.id && msg.sender_id === user?.id && (
                <button
                  onClick={() => deleteDMMessage(msg.id)}
                  style={{
                    marginLeft: 8, padding: '1px 6px',
                    borderRadius: 4, border: 'none',
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    color: 'var(--red)', fontSize: 10,
                    cursor: 'pointer'
                  }}
                >
                  delete
                </button>
              )}
            </div>
            {msg.content && (
              <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                {msg.content}
              </span>
            )}
            {msg.image_url && (
              <img
                src={msg.image_url}
                alt="shared"
                style={{
                  maxWidth: 300, maxHeight: 300, borderRadius: 8,
                  cursor: 'pointer', border: '1px solid var(--border)'
                }}
                onClick={() => window.open(msg.image_url, '_blank')}
              />
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <div style={{ padding: '0 16px', height: 20, fontSize: 12, color: '#888' }}>
        {typingUsers.length > 0 && (
          <span>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: 16, borderTop: '1px solid #eee', display: 'flex', gap: 8
      }}>
        <input
          value={input}
          onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendDM())}
          placeholder={`Message @ ${dm.other_username}`}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            color: 'var(--text-h)',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'var(--font-body)'
          }}
        />
        <ImageUpload
          accessToken={accessToken}
          dmId={dm.id}
          socket={socket}
          isDM={true}
        />
        <button
          onClick={sendDM}
          disabled={!input.trim()}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, var(--accent), #4c1d95)',
            color: 'white',
            cursor: 'pointer',
            fontWeight: '600',
            boxShadow: 'var(--glow-sm)',
            transition: 'all 0.2s'
          }}
        >
          Send
        </button>
      </div>

    </div>
  );
}

export default DMView;
