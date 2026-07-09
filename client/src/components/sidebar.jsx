import { useEffect, useState } from "react";

function Sidebar({ accessToken, onSelectChannel, selectedChannelId }) {
    const [myChannels, setMyChannels] = useState([]);
    const [allChannels, setAllChannels] = useState([]);
    const [newChannelName, setNewChannelName] = useState('');
    const [error, setError] = useState('');
    const [view, setView] = useState('my'); //'my' or 'Browse'

    //helper - eveery fetch needs the authorization
    //putting it here avoids repeating it in every fetch call
    const authHeaders = {
        'Content-Type': "application/json",
        'Authorization': `Bearer ${accessToken}`
    };

    //fetch channels the user is already in
    const fetchMyChannels = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/channels', {
                headers: authHeaders
            });
            const data = await res.json();
            setMyChannels(data.channels || []);
        } catch (err) {
            console.error(err);
        }
    };

    //fetch all public channels for browsing
    const fetchAllChannels = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/channels/all', {
                headers: authHeaders
            });
            const data = await res.json();
            setAllChannels(data.channels || []);
        } catch (err) {
            console.error(err);
        }
    };

    //run on mount
    useEffect(() => {
        fetchAllChannels();
        fetchMyChannels();
    }, []);

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

            if (!res.ok) {
                setError(data.error);
                return;
            }

            setNewChannelName('');
            //Refresh my channels list after creating
            fetchMyChannels();
            fetchAllChannels();
        } catch (err) {
            setError('something went  wrong');
        }
    };

    const joinChannel = async (channelId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/channels/${channelId}/join`, {
                method: 'POST',
                headers: authHeaders
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error);
                return;
            }

            //refresh both list after joining
            fetchMyChannels();
        } catch (err) {
            console.error(err)
        }
    };

    //check if user is already in a channel
    const isMember = (channelId) => {
        return myChannels.some(c => c.id === channelId);
    };

    return (
        <div style={{ width: 250, borderRight: '1px solid #ccc', padding: 16, height: '100vh' }}>
            <h3>Channels</h3>

            //toggle between my channels and Browse
            <div style={{ marginBottom: 12 }}>
                <button onClick={() => setView('my')}
                    style={{ fontWeight: view === 'my' ? 'bold' : 'normal' }}>
                    My Channels
                </button>
                <button onClick={() => setView('browse')}
                    style={{ fontWeight: view === 'browse' ? 'bold' : 'normal' }}>
                    Browse
                </button>
            </div>


            //my channels list

            {view === 'my' && (
                <>
                    {myChannels.map(channel => (
                        <div
                            key={channel.id}
                            onClick={() => onSelectChannel(channel)}
                            style={{
                                padding: '8px',
                                cursor: 'pointer',
                                backgroundColor: selectedChannelId === channel.id ? '#e0e0e0' : 'transparent',
                                borderRadius: 4,
                                marginBottom: 4
                            }}
                        >
                            # {channel.name}
                            {channel.role === 'admin' && (
                                <span style={{ fontSize: 10, marginLeft: 6, color: 'gray' }}>admin</span>
                            )}

                        </div>
                    ))}

                    {/*create channel */}
                    <div style={{ marginTop: 16 }}>
                        <input
                            placeholder="New Channel Name"
                            value={newChannelName}
                            onChange={e => setNewChannelName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createChannel()}
                            style={{ width: '100%', marginBottom: 6 }}
                        />
                        <button onClick={createChannel} style={{ width: '100%' }}>
                            + Create Channel
                        </button>
                        {error && <p style={{ color: red, fontSize: 12 }}>{error}</p>}
                    </div>
                </>
            )}

            //Browse all Channels
            {view === 'browse' && (
                <>
                    {allChannels.map(channel => {
                        return (
                            <div key={channel.id} style={{ marginBottom: 8 }}>
                                <span> #{channel.name} ({channel.member_count} members)</span>
                                <br />
                                {isMember(channel.id) ? (
                                    <span style={{ fontSize: 12, color: 'green' }}>🫦Joined</span>
                                ) : (
                                    <button onClick={() => joinChannel(channel.id)} style={{ fontSize: 12 }}>
                                        Join
                                    </button>
                                )}
                            </div>
                        );
                    })

                    }
                </>
            )}
        </div>
    );
}

export default Sidebar;