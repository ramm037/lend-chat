import { useEffect, useState, useRef } from "react";

function ChannelView({ channel, accessToken, socket }) {
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    //typing users =  array of usernames currently typing

    const bottomRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    //typingTimeoutRef = used to auto stop typing after 2 seconds
    //of no keystrokes , even if the user doesn't clear the inputs

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
            setTypingUsers([]);
        };
    }, [channel]);

    //message = typing listeners
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message) => {
            if (Number(message.channel_id) === Number(channel?.id)) {
                setMessages(prev => [...prev, message]);
            }
        };

        //Add username to typing list
        const handleTypingStart = ({ username, channelId }) => {
            if (Number(channelId) === Number(channel?.id)) {
                setTypingUsers(prev =>
                    prev.includes(username) ? prev : [...prev, username]
                );
            }
        };

        //remove username from typing list
        const handleTypingStop = ({ channelId, username: typingUsername }) => {
            if (Number(channelId) === Number(channel?.id)) {
                setTypingUsers(prev =>
                    prev.filter(u => u !== typingUsername)
                );
            }
        };

        socket.on('new_message', handleNewMessage);
        socket.on('user_typing', handleTypingStart);
        socket.on('user_stopped_typing', handleTypingStop);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('user_typing', handleTypingStart);
            socket.off('user_stopped_typing', handleTypingStop);
        };
    }, [socket, channel]);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const handleInputChange = (e) => {
        setInput(e.target.value);

        if (!socket || !channel) return;

        //emit typing_start every keystroke
        socket.emit('typing_start', { channelId: channel.id, isDM: false });

        //clear previous timeout and set a new one-
        //if user stops typing for 2 seconds, enit typing_stop
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing_stop', { channelId: channel.id, isDM: false });
        }, 2000);
    };

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

        // Stop typing when message sent
        socket.emit('typing_stop', { channelId: channel.id, isDM: false });
        clearTimeout(typingTimeoutRef.current);
        
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

            {/* channel header*/}
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
                            <span style={{ fontWeight: 'bold', fontSize: 14 }}>
                                {msg.username}
                            </span>
                            <span style={{ fontSize: 11, color: '#aaa' }}>
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

            {/* Typing indicator */}
            <div style={{ padding: '0 16px', height: 20, fontsize: 12, color: '#888' }}>
                {typingUsers.length > 0 && (
                    <span>
                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </span>
                )}
            </div>


            <div style={{
                padding: 16,
                borderTop: '1px solid #eee',
                display: 'flex',
                gap: 8
            }}>
                <input
                    value={input}
                    onChange={handleInputChange}
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
















































































































































