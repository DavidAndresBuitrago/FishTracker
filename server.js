const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 1212;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key', // Replace with a secure key
    resave: false,
    saveUninitialized: false
}));

// SQLite Database
const db = new sqlite3.Database('fish.db');
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)`);

// Routes for Authentication
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, 
        [username, hashedPassword], (err) => {
            if (err) return res.status(400).json({ error: 'Username taken' });
            res.json({ message: 'User created' });
        });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        res.json({ message: 'Logged in', redirect: '/index.html' });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out', redirect: '/sign-in.html' });
});

app.get('/api/user', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    res.json({ loggedIn: true });
});

app.post('/api/change-password', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { oldPassword, newPassword } = req.body;
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.userId], async (err, user) => {
        if (err || !(await bcrypt.compare(oldPassword, user.password))) {
            return res.status(401).json({ error: 'Incorrect old password' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Password updated' });
        });
    });
});

// Start Server
app.listen(port, () => console.log(`Server running on port ${port}`));