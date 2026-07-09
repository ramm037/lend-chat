import { useEffect, useState } from "react";
import { io } from 'socket.io-client';
import Sidebar from "./sidebar";
import ChannelView from "./ChannelView";

function Chat({ accessToken, user, onLogout }) {
    const [connected, setConnected] = useState(false);
    const [socket, setSocket] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);

    useEffect(() => {
        // send access token in socket handshake auth object-
        // server's io.use() middleware raeds socket.handshake.auth.token
        const newSocket = io('http://localhost:5000', {
            auth: { token: accessToken }
        });

        newSocket.on('connect', () => {
            setConnected(true);
        });

        newSocket.on('connect_error', (err) => {
            console.log('socket error:', err.message);
        });

        setSocket(newSocket);

        //disconnect socket when component unmounts or token changes
        return () => newSocket.disconnect();
    }, [accessToken]);

    // When user selects a new channel, tell the socket to join that room
    const handleSelectChannel = (channel) => {
        setSelectedChannel(channel);
        if (socket) {
            // This triggers the 'join_channel' event on server
            // which calls socket.join('channel_<id>')
            socket.emit('join_channel', channel.id);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            <Sidebar
                accessToken={accessToken}
                onSelectChannel={handleSelectChannel}
                selectedChannelId={selectedChannel?.id}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{
                    padding: '12px 24px',
                    borderBottom: '1px solid #ccc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>
                        {user.username} — Socket: {connected ? '🟢' : '🔴'}
                    </span>
                    <button onClick={onLogout}>Logout</button>
                </div>

                {/* Channel content */}
                <ChannelView
                    channel={selectedChannel}
                    accessToken={accessToken}
                />
            </div>
        </div>
    );

}

export default Chat;