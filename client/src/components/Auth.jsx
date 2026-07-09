import { useState } from "react";

function Auth({ onAuth }) {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        setError('');
        const url = isLogin
            ? 'http://localhost:5000/api/auth/login'
            : 'http://localhost:5000/api/auth/register';

        const body = isLogin
            ? { email: form.email, password: form.password }
            : { username: form.username, email: form.email, password: form.password };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                //credentials: 'include' tells the browser to accept
                //and store the httpOnly cookie in the response
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error);
                return;
            }

            onAuth({ accessToken: data.accessToken, user: data.user });
        } catch (err) {
            setError('Something went wrong');
        }
    };
    return (
        <div>
            <h2>{isLogin ? 'Login' : 'Register'}</h2>

            {!isLogin && (
                <>
                    <input
                        name="username"
                        placeholder="Username"
                        value={form.username}
                        onChange={handleChange}
                    />
                    <br />
                </>
            )}

            <input
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
            />
            <br />

            <input
                name="password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
            />
            <br />

            <button onClick={handleSubmit}>
                {isLogin ? 'Login' : 'Register'}
            </button>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            <p>
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? 'Register' : 'Login'}
                </button>
            </p>


        </div>
    );
}

export default Auth;