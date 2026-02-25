const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');

const app = express();

// --- 1. CONFIGURATION (REPLACE THESE) ---
const CLIENT_ID = '1472530106852577290';
const CLIENT_SECRET = '9XnQvDOg-J-zJLA8KfUiKvCbuG-Vvqxp';
const REDIRECT_URI = 'http://localhost:3000/callback';
const TARGET_GUILD_ID = '1460250019067072512';

// --- 2. MIDDLEWARE ---
// This keeps the user logged in as they move between pages
app.use(session({
    secret: 'super-secret-key-123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Serve files from the 'public' folder (HTML, CSS)
app.use(express.static(path.join(__dirname, 'Test')));

// --- 3. ROUTES ---

// Homepage: Sends the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Test', 'index.html'));
});

// LOGIN: Redirects to Discord's official login page
app.get('/login', (req, res) => {
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(discordUrl);
});

// CALLBACK: Discord sends the user back here with a code
app.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) return res.send("Error: Discord did not send a code.");

    try {
        // STEP A: Exchange "Code" for an "Access Token"
        const tokenParams = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        });

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', tokenParams);
        const accessToken = tokenResponse.data.access_token;

        // STEP B: Use the Token to get the user's list of Discord Servers
        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // STEP C: Check if they are in your specific server
        const isInServer = guildsResponse.data.some(guild => guild.id === TARGET_GUILD_ID);

        if (isInServer) {
            req.session.isMember = true; // Set a session variable to remember them
            res.redirect('/dashboard');
        } else {
            res.send("<h1>Access Denied</h1><p>You are not a member of the required Discord server.</p><a href='/'>Go back to login</a>");
        }

    } catch (error) {
        console.error("Auth Error:", error.response ? error.response.data : error.message);
        res.status(500).send("An error occurred during Discord authentication. Check your console!");
    }
});

// DASHBOARD: Protect this page
app.get('/dashboard', (req, res) => {
    if (req.session.isMember) {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } else {
        res.redirect('/'); // Not verified? Send them back to the start!
    }
});

// LOGOUT: Optional route to clear the session
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- 4. START SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
    console.log(`Ready to verify server ID: ${TARGET_GUILD_ID}`);
});