import { useEffect, useState } from 'react';

function useUnreadCounts(accessToken, socket) {
    const [unreadCounts, setUnreadCounts] = useState({});
    //unreadCounts = { channelId: count }

    //fetch initial unread counts
    useEffect(() => {
        if (!accessToken) return;

        const fetchUnread = async () => {
            try {
                const res = await fetch('${import.meta.env.VITE_SERVER_URL}/api/reads/unread', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                const data = await res.json();
                setUnreadCounts(data.unread || {});
            } catch (err) {
                console.error(err);
            }
        };

        fetchUnread();
    }, [accessToken]);

    //when a new message arrives, increment unread count
    // for that channel (only if not currently viewing it)
    const incrementUnread = (channelId) => {
        setUnreadCounts(prev => ({
            ...prev,
            [channelId]: (prev[channelId] || 0) + 1
        }));
    };

    const clearUnread = (channelId) => {
        setUnreadCounts(prev => ({
            ...prev,
            [channelId]: 0
        }));
    };

    return { unreadCounts, incrementUnread, clearUnread };
}

export default useUnreadCounts;