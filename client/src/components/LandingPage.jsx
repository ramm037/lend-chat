import { useEffect, useState } from 'react';
import StarField from './StarField';

function LandingPage({ onEnter }) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing systems...');

  const loadingSteps = [
    { text: 'Initializing systems...', progress: 20 },
    { text: 'Connecting to deep space network...', progress: 45 },
    { text: 'Calibrating quantum channels...', progress: 65 },
    { text: 'Establishing secure orbit...', progress: 85 },
    { text: 'Systems online. Ready for launch.', progress: 100 },
  ];

  useEffect(() => {
    let step = 0;

    const interval = setInterval(() => {
      if (step < loadingSteps.length) {
        setProgress(loadingSteps[step].progress);
        setStatusText(loadingSteps[step].text);
        step++;
      } else {
        clearInterval(interval);
        setTimeout(() => setLoading(false), 500);
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <StarField />

      {/* Nebula glow effects */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1
      }} />
      <div style={{
        position: 'absolute',
        width: 300, height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
        top: '20%', right: '20%',
        zIndex: 1
      }} />

      {/* Main content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        textAlign: 'center',
        animation: 'fadeInUp 1s ease'
      }}>

        {/* Planet/Logo */}
        <div style={{
          position: 'relative',
          width: 120, height: 120,
          margin: '0 auto 32px',
          animation: 'float 4s ease-in-out infinite'
        }}>
          {/* Planet */}
          <div style={{
            width: 120, height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #9f67ff, #4c1d95, #1e0a40)',
            boxShadow: '0 0 40px rgba(124,58,237,0.6), inset -20px -10px 40px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            {/* Ring */}
            <div style={{
              position: 'absolute',
              width: 180, height: 40,
              border: '3px solid rgba(159,103,255,0.4)',
              borderRadius: '50%',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%) rotateX(75deg)',
              boxShadow: '0 0 20px rgba(124,58,237,0.3)'
            }} />
          </div>

          {/* Orbiting moon */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 16, height: 16,
            marginTop: -8, marginLeft: -8,
            animation: 'orbit 3s linear infinite'
          }}>
            <div style={{
              width: 16, height: 16,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #e8e8ff, #8888cc)',
              boxShadow: '0 0 8px rgba(200,200,255,0.6)'
            }} />
          </div>
        </div>

        {/* App name */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 48,
          fontWeight: 900,
          letterSpacing: 8,
          color: 'var(--text-h)',
          textShadow: '0 0 30px rgba(124,58,237,0.8)',
          marginBottom: 8
        }}>
          SPACE CHAT
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          letterSpacing: 4,
          color: 'var(--text-muted)',
          marginBottom: 48
        }}>
          COMMUNICATE ACROSS THE UNIVERSE
        </p>

        {/* Loading bar */}
        {loading ? (
          <div style={{ width: 320, margin: '0 auto' }}>
            <div style={{
              width: '100%',
              height: 2,
              backgroundColor: 'var(--border)',
              borderRadius: 2,
              marginBottom: 12,
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))',
                borderRadius: 2,
                transition: 'width 0.5s ease',
                boxShadow: '0 0 8px var(--accent)'
              }} />
            </div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              letterSpacing: 2,
              color: 'var(--text-muted)'
            }}>
              {statusText}
            </p>
          </div>
        ) : (
          <button
            onClick={onEnter}
            style={{
              padding: '14px 48px',
              borderRadius: 8,
              border: '1px solid var(--accent)',
              background: 'linear-gradient(135deg, var(--accent), #4c1d95)',
              color: 'white',
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              letterSpacing: 4,
              cursor: 'pointer',
              boxShadow: 'var(--glow)',
              transition: 'all 0.3s ease',
              animation: 'fadeInUp 0.5s ease, pulse-glow 2s ease infinite'
            }}
            onMouseEnter={e => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 0 40px rgba(124,58,237,0.8)';
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'var(--glow)';
            }}
          >
            LAUNCH 🚀
          </button>
        )}
      </div>
    </div>
  );
}

export default LandingPage;