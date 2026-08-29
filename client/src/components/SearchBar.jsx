import { useState, useRef, useEffect } from 'react';

function SearchBar({ accessToken, onSelectChannel, onSelectDM }) {
    const [query, setQuery] = useState('');
    const [userResults, setUserResults] = useState([]);
    const [messageResults, setMessageResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [activeTab, setActiveTab] = useState('messages');
    const searchRef = useRef(null);
    const debounceRef = useRef(null);

    const authHeaders = {
        Authorization: `Bearer ${accessToken}`
    };

    //close results when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const search = async (q) => {
        if (!q.trim() || q.trim().length < 2) {
            setUserResults([]);
            setMessageResults([]);
            setShowResults(false);
            return;
        }

        setLoading(true);
        setShowResults(true);

        try {
            //Run both searches simultaneously
            const [usersRes, messageRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_SERVER_URL}/api/search/users?q=${encodeURIComponent(q)}`, {
                    headers: authHeaders
                }),
                fetch(`${import.meta.env.VITE_SERVER_URL}/api/search/messages?q=${encodeURIComponent(q)}`, {
                    headers: authHeaders
                })
            ]);

            const usersData = await usersRes.json();
            const messagesData = await messageRes.json();

            setUserResults(usersData.users || []);
            setMessageResults(messagesData.messages || []);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const q = e.target.value;
        setQuery(q);

        // Debounce - wait 400 ms after user stops typing before searching
        // Prevents a search request on every single keystrokes
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            search(q);
        }, 400);
    };

    const handlUserClick = async (user) => {
        //Stat or open DM with this user
        try {
            const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/dms`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id })
            });
            const data = await res.json();
            if (res.ok) {
                onSelectDM({ id: data.dmId, other_username: user.username });
            }
        } catch (err) {
            console.error(err);
        }
        setShowResults(false);
        setQuery('');
    };

    const handlMessageClick = (message) => {
        //Navigate to the channel containing this message
        onSelectChannel({ id: message.channel_id, name: message.channel_name });
        setShowResults(false);
        setQuery('');
    };

    return (
        <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            {/*Search Input*/}
            <input
                value={query}
                onChange={handleChange}
                onFocus={() => query.length >= 2 && setShowResults(true)}
                placeholder="Search messages or users..."
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #ccc',
                    fontSize: 14,
                    boxSizing: 'border-box',
                }}
            />

            {/*Results Dropdown*/}
            {showResults && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    maxHeight: 400,
                    overflowY: 'auto'
                }}>

                    {/*Tabs*/}
                    <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                        {['messages', 'users'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    border: 'none',
                                    backgroundColor: activeTab === tab ? '#f0f0f0' : 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: activeTab === tab ? '600' : 'normal',
                                    borderBottom: activeTab === tab ? '2px solid #007bff' : 'none'
                                }}
                            >
                                {tab === 'messages'
                                    ? `Messages (${messageResults.length})`
                                    : `Users (${userResults.length})`
                                }
                            </button>
                        ))}
                    </div>

                    {loading && (
                        <p style={{ padding: 12, color: '#aaa', fontSize: 13, textAlign: 'center' }}>
                            Searching....
                        </p>
                    )}

                    {/* Message results */}

                    {!loading && activeTab === 'messages' && (
                        messageResults.length === 0 ? (
                            <p style={{ padding: 12, color: '#aaa', fontSize: 13, textAlign: 'center' }}>
                                No messages found
                            </p>
                        ) : (
                            messageResults.map(msg => (
                                <div
                                    key={msg.id}
                                    onClick={() => handlMessageClick(msg)}
                                    style={{
                                        padding: '10px 12px',
                                        borderBottom: '1px solid #f0f0f0',
                                        cursor: 'pointer',
                                        transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}

                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 'bold', fontSize: 13 }}>
                                            {msg.username}
                                        </span>
                                        <span style={{ fontSize: 11, color: '#aaa' }}>
                                            #{msg.channel_id}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 13, color: '#444' }}>
                                        {msg.content}
                                    </p>
                                    <span style={{ fontSize: 11, color: '#aaa' }}>
                                        {new Date(msg.created_at).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        )
                    )}

                    {/* User results */}
                    {!loading && activeTab === 'users' && (
                        <>
                            {userResults.length === 0 ? (
                                <p style={{ padding: 12, color: '#aaa', fontSize: 13 }}>No Users Found</p>
                            ) : (
                                userResults.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handlUserClick(user)}
                                        style={{
                                            padding: '10px 12px',
                                            borderBottom: '1px solid #f0f0f0',
                                            cursor: 'pointer',
                                            transition: 'background 0.1s',
                                            alignItems: 'centre',
                                            gap: 8
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{
                                            width: 32, height: 32,
                                            borderRadius: '50%',
                                            backgroundColor: '#007bff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: 14,
                                            fontWeight: 'bold'
                                        }}>
                                            {user.username[0].toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: 14 }}> @{user.username}</span>


                                    </div>
                                ))
                            )}
                        </>
                    )}

                </div>
            )}
        </div>
    );
}

export default SearchBar;

