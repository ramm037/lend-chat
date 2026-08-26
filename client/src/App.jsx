import { useState } from "react";
import LandingPage from './components/LandingPage';
import Auth from './components/Auth'
import Chat from './components/Chat'

function App() {
  //acccess token lives in STATE only - not localstorage
  //if user refreshes the page, we call /auth/refresh to get a new one
  // using the httpOnly cookie the browser automatically sends
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [launched, setLaunched] = useState(false);

  const handleAuth = (data) => {
    //data = { accessToken , user }
    setAccessToken(data.accessToken);
    setUser(data.user);
    
  };

  const handleLogout = async () => {
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include' // sends teh httpOnly cookie
    });
    setAccessToken(null);
    setUser(null);
    setLaunched(false); // back to landing on logout
  };

  // Show landing page first
  if (!launched) {
    return <LandingPage onEnter={() => setLaunched(true)} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'var(--bg)' }}>
      {accessToken ? (
        <Chat accessToken={accessToken} user={user} onLogout={handleLogout} />
      ) : (<Auth onAuth={handleAuth} />
      )}
    </div>
  );
}

export default App;