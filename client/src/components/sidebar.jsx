import { useEffect, useState } from "react";

function Sidebar({ accessToken, onSelectChannel, selectedChannelId, onSelectDM, onlineUsers = {}, unreadCounts = {}, refreshTrigger = 0, socket }) {
    const [myChannels, setMyChannels] = useState([]);
    const [allChannels, setAllChannels] = useState([]);
    const [myDMs, setMyDMs] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [newChannelName, setNewChannelName] = useState('');
    const [error, setError] = useState('');
    const [view, setView] = useState('my');

    const authHeaders = {
        'Content-Type': "application/json",
        'Authorization': `Bearer ${accessToken}`
    };

    const fetchMyChannels = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/channels', { headers: authHeaders });
            const data = await res.json();
            setMyChannels(data.channels || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAllChannels = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/channels/all', { headers: authHeaders });
            const data = await res.json();
            setAllChannels(data.channels || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMyDMs = async () => {
        const res = await fetch('http://localhost:5000/api/dms', { headers: authHeaders });
        const data = await res.json();
        setMyDMs(data.dms || []);
    };

    const fetchAllUsers = async () => {
        const res = await fetch('http://localhost:5000/api/dms/users', { headers: authHeaders });
        const data = await res.json();
        setAllUsers(data.users || []);
    };

    useEffect(() => {
        fetchAllChannels();
        fetchMyChannels();
        fetchMyDMs();
        fetchAllUsers();
    }, [refreshTrigger]);

    useEffect(() => {
        if (!socket) return;

        socket.on('user_joined', () => {
            fetchAllUsers(); // refetch users list
        });

        return () => socket.off('user_joined');
    }, [socket]);

    const createChannel = async () => {
        if (!newChannelName.trim()) return;
        setError('');
        try {
            const res = await fetch('http://localhost:5000/api/channels', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ name: newChannelName })
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setNewChannelName('');
            fetchMyChannels();
            fetchAllChannels();
        } catch (err) {
            setError('something went wrong');
        }
    };

    const joinChannel = async (channelId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/channels/${channelId}/join`, {
                method: 'POST',
                headers: authHeaders
            });
            const data = await res.json();

            if (res.ok) {
                socket.emit('member_joined', { channelId })
            } else {
                alert(data.error)
            }
            fetchMyChannels();
        } catch (err) {
            console.error(err);
        }
    };

    const startDM = async (targetUserId) => {
        const res = await fetch('http://localhost:5000/api/dms', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ targetUserId })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        await fetchMyDMs();

        // Tell server to put both users in the DM socket room
        if (socket) {
            socket.emit('new_dm_created', {
                dmId: data.dmId,
                targetUserId
            });
        }

        const targetUser = allUsers.find(u => u.id === targetUserId);
        const name = targetUser ? targetUser.username : 'Direct Message';

        if (typeof onSelectDM === 'function') {
            onSelectDM({ id: data.dmId, other_username: name });
        }
    };

    const isMember = (channelId) => myChannels.some(c => c.id === channelId);

    // Unread badge component — reused for channels and DMs
    const UnreadBadge = ({ count }) => {
        if (!count || count === 0) return null;
        return (
            <span style={{
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                minWidth: 18,
                height: 18,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                padding: '0 4px'
            }}>
                {count > 99 ? '99+' : count}
            </span>
        );
    };

    return (
        <div style={{
            width: '260px',
            borderRight: '1px solid var(--border)',
            padding: '20px 16px',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxSizing: 'border-box',
            backgroundColor: 'var(--bg)',
            color: 'var(--text)',
            overflowY: 'auto'
        }}>
            {/* Channels Section */}
            <div>
                <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--text-h)',
                    fontWeight: 'bold'
                }}>
                    Channels
                </h3>

                {/* View Toggles */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                    background: 'var(--social-bg)',
                    padding: '4px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)'
                }}>
                    <button
                        onClick={() => setView('my')}
                        style={{
                            flex: 1, padding: '6px 12px', borderRadius: '6px',
                            border: 'none', cursor: 'pointer', fontSize: '13px',
                            backgroundColor: view === 'my' ? 'var(--bg)' : 'transparent',
                            color: view === 'my' ? 'var(--text-h)' : 'var(--text)',
                            fontWeight: view === 'my' ? '600' : 'normal',
                            boxShadow: view === 'my' ? 'var(--shadow)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        My Channels
                    </button>
                    <button
                        onClick={() => setView('browse')}
                        style={{
                            flex: 1, padding: '6px 12px', borderRadius: '6px',
                            border: 'none', cursor: 'pointer', fontSize: '13px',
                            backgroundColor: view === 'browse' ? 'var(--bg)' : 'transparent',
                            color: view === 'browse' ? 'var(--text-h)' : 'var(--text)',
                            fontWeight: view === 'browse' ? '600' : 'normal',
                            boxShadow: view === 'browse' ? 'var(--shadow)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Browse
                    </button>
                </div>

                {/* My Channels List */}
                {view === 'my' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {myChannels.map(channel => {
                            const isSelected = selectedChannelId === channel.id;
                            const unread = unreadCounts[channel.id] || 0;
                            return (
                                <div
                                    key={channel.id}
                                    onClick={() => onSelectChannel(channel)}
                                    style={{
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        backgroundColor: isSelected ? 'var(--accent-bg)' : 'transparent',
                                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                                        border: isSelected ? '1px solid var(--accent-border)' : '1px solid transparent',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontWeight: isSelected ? '600' : unread > 0 ? '600' : 'normal',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span># {channel.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {/* Unread badge */}
                                        <UnreadBadge count={unread} />
                                        {channel.role === 'admin' && (
                                            <span style={{
                                                fontSize: '10px',
                                                padding: '2px 6px',
                                                backgroundColor: 'var(--border)',
                                                color: 'var(--text)',
                                                borderRadius: '12px'
                                            }}>
                                                admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Create Channel */}
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                                placeholder="New Channel Name"
                                value={newChannelName}
                                onChange={e => setNewChannelName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createChannel()}
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                                    border: '1px solid var(--border)', backgroundColor: 'var(--bg)',
                                    color: 'var(--text-h)', fontSize: '14px', boxSizing: 'border-box'
                                }}
                            />
                            <button
                                onClick={createChannel}
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                                    border: 'none', backgroundColor: 'var(--accent)', color: '#fff',
                                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                + Create Channel
                            </button>
                            {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0 0' }}>{error}</p>}
                        </div>
                    </div>
                )}

                {/* Browse Channels */}
                {view === 'browse' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {allChannels.map(channel => {
                            const joined = isMember(channel.id);
                            return (
                                <div
                                    key={channel.id}
                                    style={{
                                        padding: '10px 12px',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px', fontSize: '14px',
                                        display: 'flex', flexDirection: 'column', gap: '6px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '500', color: 'var(--text-h)' }}>#{channel.name}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text)' }}>
                                            {channel.member_count} member{channel.member_count !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    {joined ? (
                                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>✓ Joined</span>
                                    ) : (
                                        <button
                                            onClick={() => joinChannel(channel.id)}
                                            style={{
                                                padding: '4px 8px', borderRadius: '4px',
                                                border: '1px solid var(--accent)', backgroundColor: 'transparent',
                                                color: 'var(--accent)', fontSize: '12px',
                                                fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start'
                                            }}
                                        >
                                            Join Channel
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Direct Messages Section */}
            <div>
                <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--text-h)',
                    fontWeight: 'bold'
                }}>
                    Direct Messages
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {myDMs.map(dm => {
                        const isSelected = selectedChannelId === dm.id;
                        const unread = unreadCounts[dm.id] || 0;
                        return (
                            <div
                                key={dm.id}
                                onClick={() => onSelectDM({ id: dm.id, other_username: dm.other_username })}
                                style={{
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    backgroundColor: isSelected ? 'var(--accent-bg)' : 'transparent',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontWeight: unread > 0 ? '600' : 'normal',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {/* Online dot */}
                                    <span style={{
                                        width: 8, height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: onlineUsers[dm.other_user_id] ? '#22c55e' : '#6b7280',
                                        display: 'inline-block',
                                        flexShrink: 0
                                    }} />
                                    @ {dm.other_username}
                                </div>
                                {/* Unread badge */}
                                <UnreadBadge count={unread} />
                            </div>
                        );
                    })}

                    {/* Start DM Selector */}
                    <div style={{ marginTop: '16px' }}>
                        <select
                            onChange={(e) => {
                                if (e.target.value) {
                                    startDM(parseInt(e.target.value));
                                    e.target.value = '';
                                }
                            }}
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: '6px',
                                border: '1px solid var(--border)', backgroundColor: 'var(--bg)',
                                color: 'var(--text)', fontSize: '14px',
                                cursor: 'pointer', outline: 'none'
                            }}
                        >
                            <option value="">+ Start Direct Message</option>
                            {allUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.username}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;