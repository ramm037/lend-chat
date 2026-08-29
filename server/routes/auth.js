const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { generateAccessToken, generateRefreshToken } = require('../utils/token');
const router = express.Router();
const validate = require('../middleware/validate');

const isProduction = process.env.NODE_ENV === 'production';
const refreshCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

// register

router.post('/register', validate('register'), async (req, res) => {
    // all validation already done by the middlware
    // req.body us guaranted to be valid here
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }

    //basic email format check
    if (!email.includes('@')) {
        return res.status(400).json({ error: 'Invalid mail' })
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be atleast 8 characters' });
    }

    try {
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email or username already in use' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users ( username, email, password_hash) VALUES (?,?,?)',
            [username, email, password_hash]
        )

        const user = { id: result.insertId, username };

        // generate both tokens on register so user is immedietly logged in
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        //store refresh token in db so we can invalidate it on logout
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)',
            [user.id, refreshToken]
        );

        //send refresh token as httpOnly cookie-
        //httpOnly means javascript cannot read this cookie at all
        //only the browser sends it automatically on requests
        //this protects against XSS attacks stealing your refresh token
        res.cookie('refreshToken', refreshToken, refreshCookieOptions);

        //access token goes in the response body
        //aclient stores it in memory (react state), not local storage
        res.status(201).json({
            message: 'User registered',
            accessToken,
            user: { id: user.id, username, email }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// ─── LOGIN ──────────────────────────────────────────────────

//login with validation
router.post('/login', validate('login'),async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }

    try {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            //dont say "email not found" -- that tell attackers which emails exist
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentails' });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        //store a new refresh token in DB
        await db.query(
            'INSERT INTO refresh_tokens (user_id,token) VALUES (?,?)',
            [user.id, refreshToken]
        );

        res.cookie('refreshToken', refreshToken, refreshCookieOptions);

        res.json({
            message: 'Login Successfull',
            accessToken,
            user: { id: user.id, username: user.username, email: user.email }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---- REFRESH ----------------------------------------

router.post('/refresh', async (req, res) => {
    //Browser automatically sends the httpOnly cookie here
    const token = req.cookies.refreshToken;

    if (!token) {
        return res.status(401).json({ error: 'No refresh token' });
    }

    try {
        //verify the refresh token using REFRESH secret
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)

        //check token actually exists in DB 
        // if user logged out, this row was deleted, so it fails here
        const [rows] = await db.query(
            'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?',
            [token, decoded.id]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: 'Refresh token revoked' });
        }

        //issue a new access token
        const accessToken = generateAccessToken({
            id: decoded.id,
            username: decoded.username
        });

        res.json({ accessToken });

    } catch (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
    }
});

// ---- LOG OUT -------------------------------------------------------

router.post('/logout', async (req, res) => {
    const token = req.cookies.refreshToken;


    if (token) {
        //DELETE from DB this is what actaully invalidates the session
        //even if someone has the refresh token string it won,t work any more
        await db.query('DELETE FROM refresh_tokens WHERE token = ?',
            [token]
        );
    }

    //clear the cookie from the browser
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax'
    });
    res.json({ message: 'Logged out' });

});

module.exports = router;
