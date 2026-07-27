const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
    console.error('❌ ERREUR NON CAPTURÉE:', err);
});

// Connexion Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'unsupermotdepasse';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==================== SERVEUR HTTP + WEBSOCKET ====================
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

// ==================== WEBSOCKET ====================
io.on('connection', (socket) => {
    console.log('🔌 Nouveau client connecté');

    socket.on('join-shop', (email) => {
        socket.join(email);
        console.log(`📦 Magasin ${email} rejoint le salon`);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client déconnecté');
    });
});

// ==================== FONCTIONS ====================

// Fonction pour envoyer une photo à Telegram
async function sendTelegramPhoto(chatId, base64Image, caption, token) {
    try {
        let cleanBase64 = base64Image;
        if (cleanBase64 && cleanBase64.includes(',')) {
            cleanBase64 = cleanBase64.split(',')[1];
        }

        if (!cleanBase64) {
            throw new Error('Image invalide');
        }

        const imageBuffer = Buffer.from(cleanBase64, 'base64');
        const FormData = require('form-data');
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('photo', imageBuffer, {
            filename: 'photo.jpg',
            contentType: 'image/jpeg'
        });
        form.append('caption', caption);

        const response = await axios.post(
            `https://api.telegram.org/bot${token}/sendPhoto`,
            form,
            {
                headers: { ...form.getHeaders() },
                timeout: 30000
            }
        );
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Telegram ${error.response.status}: ${error.response.data.description || 'Erreur'}`);
        } else if (error.request) {
            throw new Error('Réseau : Aucune réponse de Telegram');
        } else {
            throw error;
        }
    }
}

// ==================== ROUTES ====================

// Route de test
app.get('/', (req, res) => {
    res.send('✅ Serveur de cabine en ligne !');
});

// 1. Inscription du magasin
app.post('/api/register', async (req, res) => {
    try {
        const { shopName, email, phone, password, cabines, telegramToken, telegramChatId } = req.body;

        if (!shopName || !email || !password || !phone) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tous les champs sont obligatoires' 
            });
        }

        const { data: existing } = await supabase
            .from('magasins')
            .select('email')
            .eq('email', email)
            .single();

        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cet email est déjà utilisé' 
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: newShop, error: insertError } = await supabase
            .from('magasins')
            .insert([{
                nom: shopName,
                email: email,
                telephone: phone,
                mot_de_passe: hashedPassword,
                cabines: parseInt(cabines) || 3,
                abonnement_actif: false,
                telegram_token: telegramToken || null,
                telegram_chat_id: telegramChatId || null
            }])
            .select()
            .single();

        if (insertError) {
            console.error('❌ Erreur insertion:', insertError);
            return res.status(500).json({ 
                success: false, 
                error: 'Erreur lors de la création du compte' 
            });
        }

        const token = jwt.sign(
            { id: newShop.id, email: newShop.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Compte créé avec succès !',
            token: token,
            shop: {
                id: newShop.id,
                nom: newShop.nom,
                email: newShop.email,
                cabines: newShop.cabines,
                abonnement_actif: newShop.abonnement_actif
            }
        });

    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur interne du serveur' 
        });
    }
});

// 2. Connexion du magasin
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email et mot de passe requis' 
            });
        }

        const { data: shop, error: findError } = await supabase
            .from('magasins')
            .select('*')
            .eq('email', email)
            .single();

        if (findError || !shop) {
            return res.status(401).json({ 
                success: false, 
                error: 'Email ou mot de passe incorrect' 
            });
        }

        const isValidPassword = await bcrypt.compare(password, shop.mot_de_passe);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'Email ou mot de passe incorrect' 
            });
        }

        const token = jwt.sign(
            { id: shop.id, email: shop.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Connexion réussie !',
            token: token,
            shop: {
                id: shop.id,
                nom: shop.nom,
                email: shop.email,
                cabines: shop.cabines,
                abonnement_actif: shop.abonnement_actif,
                telegram_token: shop.telegram_token ? '✅ Configuré' : '❌ Non configuré'
            }
        });

    } catch (error) {
        console.error('❌ Erreur connexion:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur interne du serveur' 
        });
    }
});

// 3. Récupérer l'historique des demandes
app.get('/api/history', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                error: 'Token manquant' 
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const email = decoded.email;

        const { data, error } = await supabase
            .from('demandes')
            .select('*')
            .eq('magasin_email', email)
            .order('date', { ascending: false });

        if (error) {
            console.error('❌ Erreur récupération historique:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Erreur lors de la récupération' 
            });
        }

        res.json(data || []);

    } catch (error) {
        console.error('❌ Erreur token:', error);
        res.status(401).json({ 
            success: false, 
            error: 'Token invalide ou expiré' 
        });
    }
});

// 4. Route pour les demandes des cabines
app.post('/api/request', async (req, res) => {
    const { cabine, taille, photo, magasin } = req.body;

    console.log('📩 Nouvelle demande reçue :');
    console.log(`   Cabine : ${cabine}`);
    console.log(`   Taille : ${taille}`);
    console.log(`   Magasin : ${magasin || 'demo'}`);

    try {
        // 1. Récupérer les infos du magasin (token + chat_id)
        const { data: shop, error: shopError } = await supabase
            .from('magasins')
            .select('telegram_token, telegram_chat_id, nom')
            .eq('email', magasin)
            .single();

        let token = process.env.TELEGRAM_TOKEN;
        let chatId = process.env.CHAT_ID;
        let shopName = magasin || 'demo';

        if (shop && !shopError) {
            if (shop.telegram_token) token = shop.telegram_token;
            if (shop.telegram_chat_id) chatId = shop.telegram_chat_id;
            if (shop.nom) shopName = shop.nom;
        }

        // 2. Sauvegarder la demande
        const { error: saveError } = await supabase
            .from('demandes')
            .insert([{
                magasin_email: magasin || 'demo',
                cabine: parseInt(cabine) || 1,
                taille: taille,
                photo: photo || null
            }]);

        if (saveError) {
            console.error('❌ Erreur sauvegarde:', saveError);
        } else {
            console.log('✅ Demande sauvegardée');
        }

        // 3. Envoyer Telegram (si token configuré)
        if (token && token !== 'null' && token !== 'undefined' && token.length > 10) {
            try {
                const caption = `🔔 Nouvelle demande d'essayage
Cabine : ${cabine}
Taille demandée : ${taille}
Magasin : ${shopName}
Heure : ${new Date().toLocaleString()}`;

                await sendTelegramPhoto(chatId, photo, caption, token);
                console.log('✅ Notification envoyée sur Telegram');
            } catch (telegramError) {
                console.error('❌ Erreur Telegram:', telegramError.message);
                if (telegramError.message.includes('401')) {
                    await supabase
                        .from('magasins')
                        .update({ telegram_token_invalide: true })
                        .eq('email', magasin);
                }
            }
        } else {
            console.log('⚠️ Token Telegram non configuré, notification ignorée');
        }

        // 4. 🔥 ENVOYER LA NOTIFICATION EN TEMPS RÉEL AVEC PHOTO
        console.log(`📡 Envoi de la notification temps réel à ${magasin}`);
        io.to(magasin).emit('new-request', {
            cabine: cabine,
            taille: taille,
            photo: photo || null,
            date: new Date().toLocaleString(),
            message: `🔔 Nouvelle demande - Cabine ${cabine} - Taille ${taille}`
        });
        console.log('✅ Notification temps réel envoyée avec photo');

        res.json({
            success: true,
            message: 'Demande envoyée avec succès !'
        });

    } catch (error) {
        console.error('❌ Erreur :', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5. Mettre à jour la configuration Telegram
app.post('/api/update-telegram', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Token manquant' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const email = decoded.email;

        const { telegramToken, telegramChatId } = req.body;

        if (!telegramToken || !telegramChatId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Token et ID requis' 
            });
        }

        const { error } = await supabase
            .from('magasins')
            .update({
                telegram_token: telegramToken,
                telegram_chat_id: telegramChatId,
                telegram_token_invalide: false
            })
            .eq('email', email);

        if (error) {
            console.error('❌ Erreur mise à jour:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Erreur lors de la mise à jour' 
            });
        }

        res.json({ 
            success: true, 
            message: '✅ Configuration Telegram mise à jour avec succès !' 
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur interne du serveur' 
        });
    }
});

// ==================== DÉMARRER LE SERVEUR ====================
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🔌 WebSocket activé`);
});
