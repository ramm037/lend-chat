import { useEffect, useRef } from 'react';

function EmptyState() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Stars
        const stars = Array.from({ length: 150 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.3,
            speed: Math.random() * 0.5 + 0.1,
            opacity: Math.random()
        }));

        // Shooting stars
        const shootingStars = [];
        const addShootingStar = () => {
            shootingStars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.5,
                length: Math.random() * 80 + 40,
                speed: Math.random() * 6 + 4,
                opacity: 1,
                angle: Math.PI / 6
            });
        };

        // Spaceship position
        const ship = {
            x: canvas.width * 0.2,
            y: canvas.height * 0.5,
            targetX: canvas.width * 0.8,
            progress: 0,
            bobOffset: 0
        };

        let animFrame;
        let frameCount = 0;

        const drawSpaceship = (x, y, bobOffset) => {
            ctx.save();
            ctx.translate(x, y + Math.sin(bobOffset) * 8);

            // Engine glow
            const engineGlow = ctx.createRadialGradient(-28, 0, 0, -28, 0, 25);
            engineGlow.addColorStop(0, 'rgba(124,58,237,0.8)');
            engineGlow.addColorStop(0.4, 'rgba(124,58,237,0.3)');
            engineGlow.addColorStop(1, 'rgba(124,58,237,0)');
            ctx.fillStyle = engineGlow;
            ctx.beginPath();
            ctx.arc(-28, 0, 25, 0, Math.PI * 2);
            ctx.fill();

            // Engine flames — animated
            const flameLength = 20 + Math.sin(frameCount * 0.3) * 8;
            const flame = ctx.createLinearGradient(-20, 0, -20 - flameLength, 0);
            flame.addColorStop(0, 'rgba(159,103,255,0.9)');
            flame.addColorStop(0.5, 'rgba(239,68,68,0.6)');
            flame.addColorStop(1, 'rgba(251,146,60,0)');
            ctx.fillStyle = flame;
            ctx.beginPath();
            ctx.moveTo(-20, -6);
            ctx.lineTo(-20 - flameLength, 0);
            ctx.lineTo(-20, 6);
            ctx.closePath();
            ctx.fill();

            // Ship body
            const bodyGrad = ctx.createLinearGradient(-20, -12, 20, 12);
            bodyGrad.addColorStop(0, '#4c1d95');
            bodyGrad.addColorStop(0.5, '#7c3aed');
            bodyGrad.addColorStop(1, '#2d1060');
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.moveTo(30, 0);
            ctx.lineTo(-20, -12);
            ctx.lineTo(-28, 0);
            ctx.lineTo(-20, 12);
            ctx.closePath();
            ctx.fill();

            // Ship highlight
            ctx.fillStyle = 'rgba(159,103,255,0.3)';
            ctx.beginPath();
            ctx.moveTo(28, -2);
            ctx.lineTo(-15, -11);
            ctx.lineTo(-15, -4);
            ctx.lineTo(20, -2);
            ctx.closePath();
            ctx.fill();

            // Cockpit window
            const cockpitGrad = ctx.createRadialGradient(8, -3, 0, 8, -3, 8);
            cockpitGrad.addColorStop(0, 'rgba(147,197,253,0.9)');
            cockpitGrad.addColorStop(0.5, 'rgba(59,130,246,0.6)');
            cockpitGrad.addColorStop(1, 'rgba(29,78,216,0.3)');
            ctx.fillStyle = cockpitGrad;
            ctx.beginPath();
            ctx.ellipse(8, -2, 8, 6, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Window shine
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.ellipse(6, -4, 3, 2, -0.5, 0, Math.PI * 2);
            ctx.fill();

            // Wing
            const wingGrad = ctx.createLinearGradient(0, 0, 0, 22);
            wingGrad.addColorStop(0, '#5b21b6');
            wingGrad.addColorStop(1, '#2d1060');
            ctx.fillStyle = wingGrad;
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-10, 8);
            ctx.lineTo(-18, 22);
            ctx.lineTo(-5, 8);
            ctx.closePath();
            ctx.fill();

            // Wing accent
            ctx.strokeStyle = 'rgba(159,103,255,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, 2);
            ctx.lineTo(-14, 20);
            ctx.stroke();

            // Antenna
            ctx.strokeStyle = 'rgba(200,200,255,0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(20, -12);
            ctx.lineTo(24, -20);
            ctx.stroke();
            ctx.fillStyle = 'rgba(251,191,36,0.9)';
            ctx.beginPath();
            ctx.arc(24, -21, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Background
            const bgGrad = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, canvas.width * 0.8
            );
            bgGrad.addColorStop(0, 'rgba(19,19,45,0.4)');
            bgGrad.addColorStop(1, 'rgba(10,10,26,0)');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Nebula
            const nebulaGrad = ctx.createRadialGradient(
                canvas.width * 0.6, canvas.height * 0.4, 0,
                canvas.width * 0.6, canvas.height * 0.4, 150
            );
            nebulaGrad.addColorStop(0, 'rgba(124,58,237,0.08)');
            nebulaGrad.addColorStop(1, 'rgba(124,58,237,0)');
            ctx.fillStyle = nebulaGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Twinkling stars
            stars.forEach(star => {
                star.opacity += star.speed * 0.015;
                if (star.opacity > 1) star.speed = -Math.abs(star.speed);
                if (star.opacity < 0.1) star.speed = Math.abs(star.speed);

                ctx.beginPath();
                ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,200,255,${Math.abs(star.opacity)})`;
                ctx.fill();
            });

            // Shooting stars
            if (frameCount % 120 === 0) addShootingStar();

            for (let i = shootingStars.length - 1; i >= 0; i--) {
                const s = shootingStars[i];
                const grad = ctx.createLinearGradient(
                    s.x, s.y,
                    s.x - Math.cos(s.angle) * s.length,
                    s.y - Math.sin(s.angle) * s.length
                );
                grad.addColorStop(0, `rgba(255,255,255,${s.opacity})`);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(
                    s.x - Math.cos(s.angle) * s.length,
                    s.y - Math.sin(s.angle) * s.length
                );
                ctx.stroke();

                s.x += Math.cos(s.angle) * s.speed;
                s.y += Math.sin(s.angle) * s.speed;
                s.opacity -= 0.02;

                if (s.opacity <= 0 || s.x > canvas.width) {
                    shootingStars.splice(i, 1);
                }
            }

            // Ship trail
            ship.progress += 0.002;
            if (ship.progress > 1) ship.progress = 0;
            ship.bobOffset += 0.03;

            const shipX = canvas.width * 0.15 + (canvas.width * 0.7) * ship.progress;
            const shipY = canvas.height * 0.5 + Math.sin(ship.progress * Math.PI * 2) * 30;

            // Trail particles
            for (let i = 0; i < 3; i++) {
                const trailX = shipX - 30 - i * 15 - Math.random() * 10;
                const trailY = shipY + (Math.random() - 0.5) * 8;
                ctx.beginPath();
                ctx.arc(trailX, trailY, Math.random() * 2 + 0.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(124,58,237,${0.6 - i * 0.15})`;
                ctx.fill();
            }

            drawSpaceship(shipX, shipY, ship.bobOffset);

            frameCount++;
            animFrame = requestAnimationFrame(draw);
        };

        draw();

        return () => cancelAnimationFrame(animFrame);
    }, []);

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--bg)'
        }}>
            {/* Animated canvas */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%'
                }}
            />

            {/* Caption */}
            <div style={{
                position: 'absolute',
                bottom: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 2,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                animation: 'fadeInUp 1s ease'
            }}>
                <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    letterSpacing: 3,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase'
                }}>
                    You need some partners to be onboard
                </p>
                <p style={{
                    fontSize: 12,
                    color: 'var(--border-bright)',
                    marginTop: 8,
                    letterSpacing: 1
                }}>
                    Select a channel or start a DM to begin
                </p>
            </div>
        </div>
    );
}

export default EmptyState;