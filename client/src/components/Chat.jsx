import { useEffect, useState, useRef } from "react";
import { io } from 'socket.io-client';
import Sidebar from "./sidebar";
import ChannelView from "./ChannelView";

function Chat({ accessToken, user, onLogout }) {
    const [connected, setConnected] = useState(false);
    const [socket, setSocket] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);

    useEffect(() => {
       
        const newSocket = io('http://localhost:5000', {
            auth: { token: accessToken }
        });
      
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setConnected(true);
        });

        newSocket.on('connect_error', (err) => {
            console.log('socket error:', err.message);
        });

        
        return () => newSocket.disconnect();
    }, [accessToken]);

    
    const handleSelectChannel = (channel) => {
        setSelectedChannel(channel);
        if (socket) {
            
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
                //pass socket to ChannelView so it can listen for messages and send messages
                <ChannelView
                    channel={selectedChannel}
                    accessToken={accessToken}
                    socket={socket}
                    
                />
            </div>
        </div>
    );

}

export default Chat;