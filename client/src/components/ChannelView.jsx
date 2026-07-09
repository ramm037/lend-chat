import { useEffect, useState } from "react";

function ChannelView({ channel, accessToken }) {
    const [details, setDetails] = useState(null);

    useEffect(() => {
        if (!channel) return;

        //fetch channel details + members when a channel is selected
        const fetchDetails = async () => {
            const res = await fetch(`http://localhost:5000/api/channels/${channel.id}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            const data = await res.json();
            setDetails(data);
        };

        fetchDetails();
    }, [channel]); //re fetch whenever selected channel changes

    if (!channel) {
        return (
            <div style={{ flex: 1, padding: 24 }}>
                <p> Select a channel to get started</p>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, padding: 24 }}>
            <h2># {channel.name}</h2>

            {details && (
                <div>
                    <p style={{ color: 'gray' }}>
                        {details.members.length} members
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {details.members.map(member => (
                            <span key={member.id} style={{
                                background: '#f0f0f0',
                                padding: '4px 8px',
                                borderRadius: 12,
                                fontSize: 13
                            }}>
                                {member.username}
                                {member.role === 'admin' && ' 👑'}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ marginTop: 24 }}>
                <p style={{ color: '#aaa' }}>Messages coming Day 4...</p>
            </div>
        </div>
    );
}

export default ChannelView;
