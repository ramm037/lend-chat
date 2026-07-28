import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import ChannelView from './ChannelView';
import DMView from './DMView';
import usePresence from '../hooks/usePresence';

function Chat({ accessToken, user, onLogout }) {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDM, setSelectedDM] = useState(null);

  //presencehoook = returns {userId: isOnline} map
  const onlineUsers = usePresence(accessToken, socket);
  
  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      auth: { token: accessToken }
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('connect_error', err => console.log('socket error:', err.message));

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [accessToken]);

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setSelectedDM(null); // clear DM when switching to channel
    if (socket) socket.emit('join_channel', channel.id);
  };

  const handleSelectDM = (dm) => {
    setSelectedDM(dm);
    setSelectedChannel(null); // clear channel when switching to DM
    if (socket) socket.emit('join_dm', dm.id);
  };

  // selectedId used by Sidebar to highlight active item
  const selectedId = selectedChannel
    ? `c_${selectedChannel.id}`
    : selectedDM
    ? `d_${selectedDM.id}`
    : null;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        accessToken={accessToken}
        onSelectChannel={handleSelectChannel}
        onSelectDM={handleSelectDM}
        selectedId={selectedId}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid #ccc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{user.username} — {connected ? '🟢 Online' : '🔴 Connecting...'}</span>
          <button onClick={onLogout}>Logout</button>
        </div>

        {/* Show ChannelView or DMView depending on what's selected */}
        {selectedDM
          ? <DMView dm={selectedDM} accessToken={accessToken} socket={socket} />
          : <ChannelView channel={selectedChannel} accessToken={accessToken} socket={socket} />
        }
      </div>
    </div>
  );
}

export default Chat;