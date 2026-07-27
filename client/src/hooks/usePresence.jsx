import { useEffect, useState } from 'recat';

function usePresence(accessToken, socket) {
    const [onlineUsers, setOnlineUsers] = useState({});

    // onlineUsers = { userId: true/false}

    //fetch iniial presence on mount 
    useEffect(() => {
        if (!accessToken) return;

        const fetchPresence = async () => {
            const res = await fetch('http://localhost:5000/api/presence', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
            );

            const data = await res.json();

            //convert array into object for 0(1) lookup
            // {1:true, 2:false, 3: true}

            const presenceMap = {};
            data.users.forEach(user => {
                presenceMap[user.id] = user.isOnline;
            });
            setOnlineUsers(presenceMap);
        };

        fetchPresence();
    }, [accessToken]);

    //Listen for real time presence updates
    useEffect(() => {
        if (!socket) return;

        socket.on('user_online', ({ userId }) => {
            setOnlineUsers(prev => ({ ...prev, [userId]: true }));
        });

        socket.on('user_offline', ({ userId }) => {
            setOnlineUsers(prev => ({ ...prev, [userId]: false }));
        });

        return () => {
            socket.off('user_online');
            socket.off('user_offline')
        };

    }, [socket]);

    return onlineUsers;
}

export default usePresence;