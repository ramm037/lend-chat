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
                    `${import.meta.env.VITE_SERVER_URL}/api/messages/${channel.id}?limit=50`,
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
                `${import.meta.env.VITE_SERVER_URL}/api/channels/${channel.id}`,
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
                `${import.meta.env.VITE_SERVER_URL}/api/messages/${channel.id}?before=${oldestId}&limit=50`,
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
        const handleTypingStart = ({ userId, username, channelId }) => {
            if (Number(channelId) !== Number(channel?.id)) return;

            setTypingUsers(prev => {
                if (prev.some(user => Number(user.id) === Number(userId))) {
                    return prev;
                }

                return [
                    ...prev,
                    {
                        id: userId,
                        username
                    }
                ];
            });
        };

        //remove username from typing list
        const handleTypingStop = ({ channelId, username: typingUsername }) => {
            if (Number(channelId) !== Number(channel?.id)) return;

            setTypingUsers(prev =>
                prev.filter(user => user.username !== typingUsername)
            );
        };

        const handleMembersUpdated = ({ channelId, members }) => {
            if (Number(channelId) === Number(channel?.id)) {
                setMembers(members);
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
                setTypingUsers([]);

                alert("You have been removed from this channel");
            }
        });

        socket.on('member_kicked', ({ channelId: kickedChannel, targetUserId }) => {
            if (Number(kickedChannel) === Number(channel?.id)) {
                // Remove from members state immediately
                setMembers(prev => prev.filter(m => m.id !== Number(targetUserId)));

                // Remove user from typing indicator
                setTypingUsers(prev =>
                    prev.filter(user => user.id !== Number(targetUserId))
                );
            }
        });


        socket.on('members_updated', handleMembersUpdated);
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
            socket.off('members_updated', handleMembersUpdated);
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

            {/* channel header*/}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
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
                        gap: 4,
                        padding: '8px 12px',
                        borderRadius: 8,
                        transition: 'background 0.15s'
                    }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{
                                fontWeight: '600', fontSize: 14,
                                color: 'var(--accent-bright)'
                            }}>
                                {msg.username}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
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
                                    maxWidth: 300, maxHeight: 300,
                                    borderRadius: 8, cursor: 'pointer',
                                    border: '1px solid var(--border)'
                                }}
                                onClick={() => window.open(msg.image_url, '_blank')}
                            />
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div style={{ padding: '0 16px', height: 22, fontSize: 12, color: 'var(--text-muted)' }}>
                {typingUsers.length > 0 && (
                    <span>
                        {typingUsers.map(typingUser => typingUser.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </span>
                )}
            </div>

            {/* Input area */}
            {isKicked ? (
                <div style={{
                    padding: 16,
                    borderTop: '1px solid var(--border)',
                    textAlign: 'center',
                    color: '#ef4444',
                    fontSize: 14
                }}>
                    You have been removed from this channel.
                </div>
            ) : (
                <div style={{
                    padding: '12px 16px 16px',
                    borderTop: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    display: 'flex',
                    gap: 8
                }}>
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
                    <button
                        onClick={sendMessage}
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
            )}
        </div>
    );
}

export default ChannelView;
















































































































































