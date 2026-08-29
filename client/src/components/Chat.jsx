import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import ChannelView from './ChannelView';
import DMView from './DMView';
import usePresence from '../hooks/usePresence';
import useUnreadCounts from '../hooks/useUnreadCounts';
import SearchBar from './SearchBar';
import NotificationBell from './NotificationBell';
import EmptyState from './EmptyState';

const socketUrl = import.meta.env.VITE_SOCKET_URL || '${import.meta.env.VITE_SERVER_URL}';

function Chat({ accessToken, user, onLogout }) {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDM, setSelectedDM] = useState(null);
  const [shouldRefreshChannels, setShouldRefreshChannels] = useState(0);

  //presencehoook = returns {userId: isOnline} map
  const onlineUsers = usePresence(accessToken, socket);
  const { unreadCounts, incrementUnread, clearUnread } = useUnreadCounts(accessToken, socket);


  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL, {
      auth: { token: accessToken }
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', reason => {
      setConnected(false);
      console.warn('socket disconnected:', reason);
    });
    newSocket.on('connect_error', err => {
      setConnected(false);
      console.error('socket connection error:', err.message);
    });

    setSocket(newSocket);
    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      newSocket.disconnect();
    };
  }, [accessToken]);

  //listen for new messages at chat level to update unread counts
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      //Only increment is the channel is NOT currently selected
      if (Number(message.channel_id) !== Number(selectedChannel?.id)) {
        incrementUnread(message.channel_id);
      }
    };

    const handleNewDM = (message) => {
      if (Number(message.channel_id) !== Number(selectedDM?.id)) {
        incrementUnread(message.channel_id);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('new_dm', handleNewDM);

    socket.on('kicked_from_channel', ({ channelId }) => {
      //if currently viewing that channel - clear it
      if (selectedChannel && Number(selectedChannel.id) === Number(channelId)) {
        setSelectedChannel(null);
      }
      //refresh sidebar channel list
      //emit custom event to trigger sidebar refetch
      setShouldRefreshChannels(prev => prev + 1);
    })

    socket.on('channel_deleted', ({ channelId }) => {
      if (selectedChannel && Number(selectedChannel.id) === Number(channelId)) {
        setSelectedChannel(null);
      }
      setShouldRefreshChannels(prev => prev + 1);
    });

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('new_dm', handleNewDM);
    };
  }, [socket, selectedChannel, selectedDM])

  useEffect(() => {
    if (!socket) return;

    // When server tells us to join a new DM room
    socket.on('join_new_dm', ({ dmId }) => {
      socket.emit('join_dm', dmId);
      // Refresh DM list in sidebar
      setShouldRefreshChannels(prev => prev + 1);
    });

    return () => socket.off('join_new_dm');
  }, [socket]);

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setSelectedDM(null); // clear DM when switching to channel
    if (socket) {
      socket.emit('join_channel', channel.id);

      //mark channel as read when opened
      socket.emit('mark_read', { channelId: channel.id });
    }

    //clear unread count for this channel
    clearUnread(channel.id);

    //also call REST endpoint to persist last_read
    fetch('${import.meta.env.VITE_SERVER_URL}/api/reads/mark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ channelId: channel.id })
    });
  };

  const handleSelectDM = (dm) => {
    setSelectedDM(dm);
    setSelectedChannel(null); // clear channel when switching to DM
    if (socket) {
      socket.emit('join_dm', dm.id);
      socket.emit('mark_read', { channelId: dm.id });
    }

    clearUnread(dm.id);

    fetch('${import.meta.env.VITE_SERVER_URL}/api/reads/mark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ channelId: dm.id })
    });
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
        selectedChannelId={selectedChannel?.id || selectedDM?.id}
        onlineUsers={onlineUsers}
        unreadCounts={unreadCounts}
        refreshTrigger={shouldRefreshChannels}
        socket={socket}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '0 24px',
          height: 56,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          backgroundColor: 'var(--surface)',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Logo + username */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              letterSpacing: 3,
              color: 'var(--accent-bright)',
              textShadow: 'var(--glow-sm)'
            }}>✦ SPACE CHAT
            </span>
            <span style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span style={{
                width: 6, height: 6,
                borderRadius: '50%',
                backgroundColor: connected ? 'var(--green)' : 'var(--red)',
                display: 'inline-block',
                boxShadow: connected ? '0 0 6px var(--green)' : 'none'
              }} />
              {user?.username}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <SearchBar
              accessToken={accessToken}
              onSelectChannel={handleSelectChannel}
              onSelectDM={handleSelectDM}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <NotificationBell accessToken={accessToken} socket={socket} />
              <button
                onClick={onLogout}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: 2,
                  transition: 'all 0.2s'
                }} onMouseEnter={e => {
                  e.target.style.borderColor = 'var(--red)';
                  e.target.style.color = 'var(--red)';
                }}
                onMouseLeave={e => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.color = 'var(--text-muted)';
                }}
              >
                EJECT
              </button>
            </div>
          </div>

        </div>

        {/* Keep the conversation below the global toolbar so it can fill the page. */}

        {socket ? (
          selectedDM
            ? <DMView dm={selectedDM} accessToken={accessToken} socket={socket} user={user} />
            : selectedChannel
              ? <ChannelView channel={selectedChannel} accessToken={accessToken} socket={socket} user={user} setSelectedChannel={setSelectedChannel} />
              : <EmptyState />  // ← shows when nothing selected
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

export default Chat;
