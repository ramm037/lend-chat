import { useEffect, useState, useRef } from 'react';

function DMView({ dm, accessToken, socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Load DM message history
  useEffect(() => {
    if (!dm) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        // Reuse the same messages endpoint — DM is just a channel
        const res = await fetch(
          `http://localhost:5000/api/messages/${dm.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    return () => setMessages([]);
  }, [dm]);

  // Listen for incoming DMs
  useEffect(() => {
    if (!socket || !dm) return;

    const handleNewDM = (message) => {
      if (message.dm_id === dm.id) {
        setMessages(prev => [...prev, message]);
      }
    };

    socket.on('new_dm', handleNewDM);
    return () => socket.off('new_dm', handleNewDM);
  }, [socket, dm]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendDM = () => {
    if (!input.trim() || !socket || !dm) return;

    socket.emit('send_dm', {
      dmId: dm.id,
      content: input.trim()
    });

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
        <h3 style={{ margin: 0 }}>@ {dm.other_username}</h3>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <p style={{ color: '#aaa' }}>Loading...</p>}

        {!loading && messages.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>
            Start the conversation 👋
          </p>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 'bold', fontSize: 14 }}>{msg.username}</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <span style={{ fontSize: 14 }}>{msg.content}</span>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 16, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendDM())}
          placeholder={`Message @ ${dm.other_username}`}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
        />
        <button
          onClick={sendDM}
          disabled={!input.trim()}
          style={{ padding: '8px 16px', borderRadius: 4, background: '#007bff', color: 'white', border: 'none' }}
        >
          Send
        </button>
      </div>

    </div>
  );
}

export default DMView;