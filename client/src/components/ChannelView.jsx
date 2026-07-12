import { useEffect, useState, useRef } from "react";

function ChannelView({ channel, accessToken, socket }) {
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const bottomRef = useRef(null);

    useEffect(() => {
        if (!channel) return;

        const fetchMessages = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `http://localhost:5000/api/messages/${channel.id}`,
                    {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    }
                );

                const data = await res.json();
                setMessages(data.messages || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        const fetchDetails = async () => {
            const res = await fetch(
                `http://localhost:5000/api/channels/${channel.id}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const data = await res.json();
            setMembers(data.members || []);
        };

        fetchMessages();
        fetchDetails();

        return () => {
            setMessages([]);
            setMembers([]);
        };
    }, [channel]);

    useEffect(() => {
        if (!socket) return;

        console.log('registering new_message listener, socket id:', socket.id);

        const handleNewMessage = (message) => {
            console.log('incoming message:', message);
            setMessages(prev => [...prev, message]);
        };


        socket.on('new_message', handleNewMessage);
        console.log('listener registered');

        return () => {
            console.log('cleaning up listener');
            socket.off('new_message', handleNewMessage);
        };
    }, [socket, channel]);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = () => {
        console.log('sendMessage called');
        console.log('input:', input);
        console.log('socket:', socket);
        console.log('channel:', channel);
        console.log('socket id when sending:', socket?.id);

        if (!input.trim() || !socket || !channel) return;
        socket.emit('send_message', {
            channelId: channel.id,
            content: input.trim()
        });
        setInput('');
    };

    const handleKeyDown = (e) => {

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (!channel) {
        return (
            <div style={{
                display: 'flex',
                flex: 1,
                padding: 24,
                alignItems: 'center',
                justifyContent: 'center',
                color: '#aaa',
            }}>
                <p>Select a channel to get started</p>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

            //channel header
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h3 style={{ margin: 0 }}> #{channel.name}</h3>
                <span style={{ color: '#888', fontSize: 13 }}>
                    {members.length} members
                </span>
            </div>


            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}>
                {loading && <p styles={{ color: '#aaa' }}>Loading Messages...</p>}

                {!loading && messages.length === 0 && (
                    <p style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>
                        No messages yet. Say Hello!🫦
                    </p>
                )}

                {messages.map(msg => (
                    <div key={msg.id} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2
                    }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontweight: 'bold', fontSize: 14 }}>
                                {msg.username}
                            </span>
                            <span style={{ fontsize: 11, color: '#aaa' }}>
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>

                        <span style={{ fontSize: 14 }}>{msg.content}</span>
                    </div>
                ))}


                <div ref={bottomRef} />
            </div>


            <div style={{
                padding: 16,
                borderTop: '1px solid #eee',
                display: 'flex',
                gap: 8
            }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message #${channel.name}`}
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 4,
                        border: '1px solid #ccc',
                        fontSize: 14,
                    }}
                />
                <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 4,
                        backgroundColor: '#007bff',
                        color: '#fff',
                        border: 'none',
                        cursor: input.trim() ? 'pointer' : 'not-allowed'
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default ChannelView;
















































































































































