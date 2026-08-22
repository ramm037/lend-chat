import { useState } from 'react';

function AdminPanel({ channel, members, accessToken, socket, onChannelDeleted, user }) {
    const [showPanel, setShowPanel] = useState(false);

    const authHeaders = {
        Authorization: `Bearer ${accessToken}`
    };

    const deleteMessage = async (messageId) => {
        if (!window.confirm('Delete this message?')) return;

        try {
            const res = await fetch(
                `http://localhost:5000/api/admin/channels/${channel.id}/messages/${messageId}`,
                { method: 'DELETE', headers: authHeaders }
            );

            if (res.ok) {
                // Tell all clients to remove message from UI
                socket.emit('admin_delete_message', {
                    channelId: channel.id,
                    messageId
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const kickUser = async (targetUserId, targetUsername) => {
        if (!window.confirm(`Kick ${targetUsername} from this channel?`)) return;

        try {
            const res = await fetch(
                `http://localhost:5000/api/admin/channels/${channel.id}/members/${targetUserId}`,
                { method: 'DELETE', headers: authHeaders }
            );

            if (res.ok) {
                //broadcast message deletion to all the members
                socket.emit('admin_kick_user', {
                    channelId: channel.id,
                    targetUserId
                });
                alert(`${targetUsername} has been kicked`);
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteChannel = async () => {
        if (!window.confirm('Delete this entire channel? This cannot be undone.')) return;

        try {
            const res = await fetch(
                `http://localhost:5000/api/admin/channels/${channel.id}`,
                { method: 'DELETE', headers: authHeaders }
            );

            if (res.ok) {
                socket.emit('admin_delete_channel', {
                    channelId: channel.id
                });

                onChannelDeleted(channel.id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Only show for admins
    const isAdmin = members.find(m => m.id === user?.id && m.role === 'admin');
    if (!isAdmin) return null;

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowPanel(!showPanel)}
                style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12
                }}
            >
                ⚙️ Admin
            </button>

            {showPanel && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: 280,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    padding: 16
                }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Admin Controls</h4>

                    {/* Members list with kick button */}
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px 0' }}>MEMBERS</p>
                        {members.map(member => (
                            <div
                                key={member.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 0',
                                    borderBottom: '1px solid #f0f0f0'
                                }}
                            >
                                <span style={{ fontSize: 13 }}>
                                    {member.username}
                                    {member.role === 'admin' && (
                                        <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>admin</span>
                                    )}
                                </span>
                                {member.role !== 'admin' && (
                                    <button
                                        onClick={() => kickUser(member.id, member.username)}
                                        style={{
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            border: '1px solid #ef4444',
                                            backgroundColor: 'transparent',
                                            color: '#ef4444',
                                            fontSize: 11,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Kick
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Delete channel */}
                    <button
                        onClick={deleteChannel}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: 4,
                            border: 'none',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            fontSize: 13,
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        🗑️ Delete Channel
                    </button>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;