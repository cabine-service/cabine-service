// ==================== VÉRIFICATION DE CONNEXION ====================
const token = localStorage.getItem('token');
const shopData = JSON.parse(localStorage.getItem('shop'));

if (!token || !shopData) {
    window.location.href = 'login.html';
}

// ==================== AFFICHAGE DES INFOS MAGASIN ====================
document.getElementById('shopName').textContent = shopData.nom;
document.getElementById('profileName').textContent = shopData.nom;
document.getElementById('profileEmail').textContent = shopData.email;
document.getElementById('profilePhone').textContent = shopData.telephone || 'Non renseigné';
document.getElementById('profileCabines').textContent = shopData.cabines || 3;

const statusBadge = document.getElementById('statusBadge');
if (shopData.abonnement_actif) {
    statusBadge.textContent = '🟢 Actif';
    statusBadge.className = 'status-badge active';
} else {
    statusBadge.textContent = '🔴 Inactif (abonnement requis)';
    statusBadge.className = 'status-badge inactive';
}

// ==================== WEBSOCKET ====================
console.log('🔄 Connexion WebSocket...');

const socket = io('https://cabine-service.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnection: true
});

socket.on('connect', () => {
    console.log('✅ WebSocket connecté');
    if (shopData && shopData.email) {
        socket.emit('join-shop', shopData.email);
        console.log('🔌 Salon rejoint:', shopData.email);
    }
});

socket.on('connect_error', (error) => {
    console.error('❌ Erreur WebSocket:', error);
});

socket.on('disconnect', () => {
    console.log('🔌 WebSocket déconnecté');
});

// ==================== NOTIFICATIONS EN TEMPS RÉEL ====================
socket.on('new-request', (data) => {
    console.log('📩 Nouvelle notification reçue:', data);
    
    const list = document.getElementById('liveNotificationList');
    if (!list) return;
    
    // Supprimer le message "En attente..."
    const placeholder = list.querySelector('p');
    if (placeholder && placeholder.style.color === '#999') {
        placeholder.remove();
    }
    
    // Créer la notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        padding: 12px;
        margin-bottom: 8px;
        background: white;
        border-radius: 8px;
        border-left: 4px solid #667eea;
        box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        animation: slideIn 0.5s ease;
        display: flex;
        align-items: center;
        gap: 15px;
    `;
    
    let photoHtml = data.photo 
        ? `<img src="${data.photo}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;">`
        : `<span style="font-size: 30px;">📸</span>`;
    
    notification.innerHTML = `
        ${photoHtml}
        <div style="flex: 1;">
            <strong>Cabine ${data.cabine}</strong> - Taille <strong>${data.taille}</strong>
            <span style="font-size: 12px; color: #888; margin-left: 10px;">${data.date}</span>
        </div>
    `;
    
    list.insertBefore(notification, list.firstChild);
    
    // Limiter à 20 notifications
    while (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
    
    // Son
    const sound = document.getElementById('notificationSound');
    if (sound) {
        sound.play().catch(() => console.log('🔇 Son bloqué'));
    }
});

// ==================== QR CODES ====================
function generateQRCodes() {
    const cabines = parseInt(shopData.cabines) || 3;
    const grid = document.getElementById('qrGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    for (let i = 1; i <= cabines; i++) {
        const url = `https://cabine-service.onrender.com/home.html?magasin=${encodeURIComponent(shopData.email)}&cabine=${i}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
        const item = document.createElement('div');
        item.className = 'qr-item';
        item.innerHTML = `
            <img src="${qrUrl}" alt="QR Code Cabine ${i}">
            <p>Cabine n°${i}</p>
            <p style="font-size:11px; color:#999;">Scanner pour demander</p>
        `;
        grid.appendChild(item);
    }
}
generateQRCodes();

// ==================== DÉCONNEXION ====================
document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('token');
    localStorage.removeItem('shop');
    window.location.href = 'login.html';
});

// ==================== HISTORIQUE ====================
async function loadHistory() {
    try {
        const response = await fetch('https://cabine-service.onrender.com/api/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            updateStats(data);
            updateHistoryTable(data);
        }
    } catch (error) {
        console.error('Erreur historique:', error);
    }
}

function updateStats(history) {
    const today = new Date().toDateString();
    const todayCount = history.filter(h => new Date(h.date).toDateString() === today).length;
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('totalCount').textContent = history.length;
}

function updateHistoryTable(history) {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">Aucune demande</td></tr>`;
        return;
    }
    history.slice(0, 10).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Cabine ${item.cabine}</td>
            <td>${item.taille}</td>
            <td>${new Date(item.date).toLocaleString()}</td>
            <td>${item.photo ? '📸' : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}
loadHistory();

// ==================== GESTION TELEGRAM ====================
function checkTelegramStatus() {
    const shop = JSON.parse(localStorage.getItem('shop'));
    const statusDiv = document.getElementById('telegramStatus');
    if (!statusDiv) return;
    if (!shop.telegram_token || shop.telegram_token === '❌ Non configuré') {
        statusDiv.innerHTML = `<div style="padding:12px;background:#fff3cd;border-radius:8px;border-left:4px solid #ffc107;">
            <strong>⚠️ Token non configuré</strong>
            <p style="margin:5px 0 0 0;font-size:14px;color:#856404;">Configurez votre bot Telegram ci-dessous.</p>
        </div>`;
    } else {
        statusDiv.innerHTML = `<div style="padding:12px;background:#d4edda;border-radius:8px;border-left:4px solid #28a745;">
            <strong>✅ Bot configuré</strong>
            <p style="margin:5px 0 0 0;font-size:14px;color:#155724;">Notifications Telegram actives.</p>
        </div>`;
    }
}
checkTelegramStatus();

// ==================== ANIMATION ====================
const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }`;
document.head.appendChild(style);

console.log('✅ Dashboard chargé avec succès');
