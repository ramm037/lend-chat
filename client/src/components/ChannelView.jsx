import { useEffect, useState, useRef } from "react";
import ImageUpload from "./ImageUpload";
import AdminPanel from "./AdminPanel";

function ChannelView({ channel, accessToken, socket, user }) {
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    //typing users =  array of usernames currently typing

    const [isKicked, setIsKicked] = useState(false);

    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const bottomRef = useRef(null);
    const topRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    //typingTimeoutRef = used to auto stop typing after 2 seconds
    //of no keystrokes , even if the user doesn't clear the inputs

    const [userRole, setUserRole] = useState('member');


    //fetch latest messages on channel open
    useEffect(() => {
        if (!channel) return;

        setIsKicked(false);

        const fetchMessages = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `http://localhost:5000/api/messages/${channel.id}?limit=50`,
                    {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    }
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

        const fetchDetails = async () => {
            const res = await fetch(
                `http://localhost:5000/api/channels/${channel.id}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const data = await res.json();
            setMembers(data.members || []);

            // Find current user's role
            const currentUser = data.members.find(m => m.id === user?.id);
            if (currentUser) setUserRole(currentUser.role)
        };


        fetchMessages();
        fetchDetails();

        return () => {
            setMessages([]);
            setMembers([]);
            setTypingUsers([]);
        };
    }, [channel]);

    //load older messages when user clicks "load More"
    const loadMoreMessages = async () => {
        if (!channel || messages.length === 0 || loadingMore) return;

        setLoadingMore(true);
        const oldestId = messages[0].id;

        try {
            const res = await fetch(
                `http://localhost:5000/api/messages/${channel.id}?before=${oldestId}&limit=50`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const data = await res.json();

            if (data.messages.length > 0) {
                //prepend older messages to the top
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

        // In socket useEffect — add message_deleted and kicked listeners
        socket.on('message_deleted', ({ messageId }) => {
            setMessages(prev => prev.filter(m => m.id !== messageId));
        });

        socket.on('kicked_from_channel', ({ channelId: kickedChannelId }) => {
            if (Number(kickedChannelId) === Number(channel?.id)) {

                setMembers([]);
                setMessages([]);
                setIsKicked(true);
            
                alert("You have been removed from this channel");
            }
        });

        socket.on('member_kicked', ({ channelId: kickedChannel, targetUserId }) => {
            if (Number(kickedChannel) === Number(channel?.id)) {
                // Remove from members state immediately
                setMembers(prev => prev.filter(m => m.id !== Number(targetUserId)));
            }
        });

        socket.on('new_message', handleNewMessage);
        socket.on('user_typing', handleTypingStart);
        socket.on('user_stopped_typing', handleTypingStop);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('user_typing', handleTypingStart);
            socket.off('user_stopped_typing', handleTypingStop);
            socket.off('message_deleted');
            socket.off('kicked_from_channel');
            socket.off('member_kicked');
        };
    }, [socket, channel]);

    // Auto scroll to bottom only on first load and new messages
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#888', fontSize: 13 }}>{members.length} members</span>
                    {userRole === 'admin' && (
                        <AdminPanel
                            channel={channel}
                            members={members}
                            accessToken={accessToken}
                            socket={socket}
                            user={user}
                            onChannelDeleted={(id) => {
                                // Handle channel deletion — clear view
                                alert('Channel deleted');
                            }}
                        />
                    )}
                </div>
            </div>

            {/* message area*/}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}>
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
                        >{loadingMore ? 'Loading...' : 'Load more'}</button>
                    </div>
                )}


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
                        gap: 2,
                        position: 'relative'
                    }}

                        onMouseEnter={e => {
                            const btn = e.currentTarget.querySelector('.delete-btn');
                            if (btn) btn.style.display = 'block';
                        }}

                        onMouseLeave={e => {
                            const btn = e.currentTarget.querySelector('.delete-btn');
                            if (btn) btn.style.display = 'none';
                        }}
                    >

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
                            {/* Admin delete button — only shows on hover */}
                            {userRole === 'admin' && (
                                <button
                                    className="delete-btn"
                                    onClick={() => {
                                        if (window.confirm('Delete this message?')) {
                                            fetch(
                                                `http://localhost:5000/api/admin/channels/${channel.id}/messages/${msg.id}`,
                                                { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
                                            ).then(() => {
                                                socket.emit('admin_delete_message', {
                                                    channelId: channel.id,
                                                    messageId: msg.id
                                                });
                                            });
                                        }
                                    }}
                                    style={{
                                        display: 'none',
                                        marginLeft: 8,
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        border: 'none',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        fontSize: 10,
                                        cursor: 'pointer'
                                    }}
                                >
                                    delete
                                </button>
                            )}
                        </div>
                        {/* Text message */}
                        {msg.content && (
                            <span style={{ fontSize: 14 }}>{msg.content}</span>
                        )}
                        {/*Image message*/}
                        {msg.image_url && (
                            <img
                                src={msg.image_url}
                                alt="shared image"
                                style={{
                                    maxWidth: 300,
                                    maxHeight: 300,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    objectFit: 'cover'
                                }}
                                onClick={() => window.open(msg.image_url, '_blank')}
                            />

                        )}
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


            {/* Input area */}
            {isKicked ? (
                <div style={{
                    padding: 16,
                    borderTop: '1px solid #eee',
                    textAlign: 'center',
                    color: '#ef4444',
                    fontSize: 14
                }}>
                    You have been removed from this channel.
                </div>
            ) : (
                <div style={{ padding: 16, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
                    <ImageUpload
                        accessToken={accessToken}
                        channelId={channel.id}
                        socket={socket}
                        isDM={false}
                    />
                    <input
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message #${channel.name}`}
                        style={{
                            flex: 1, padding: '8px 12px',
                            borderRadius: 4, border: '1px solid #ccc', fontSize: 14
                        }}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        style={{
                            padding: '8px 16px', borderRadius: 4,
                            background: input.trim() ? '#007bff' : '#ccc',
                            color: 'white', border: 'none',
                            cursor: input.trim() ? 'pointer' : 'not-allowed'
                        }}
                    >
                        Send
                    </button>
                </div>
            )}
        </div>
    );
}

export default ChannelView;
















































































































































