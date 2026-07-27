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

// Statut de l'abonnement
const statusBadge = document.getElementById('statusBadge');
if (shopData.abonnement_actif) {
    statusBadge.textContent = '🟢 Actif';
    statusBadge.className = 'status-badge active';
} else {
    statusBadge.textContent = '🔴 Inactif (abonnement requis)';
    statusBadge.className = 'status-badge inactive';
}

// ==================== WEBSOCKET - NOTIFICATIONS EN DIRECT ====================
console.log('🔄 Initialisation WebSocket...');

const socket = io('https://cabine-service.onrender.com', {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// Connexion réussie
socket.on('connect', () => {
    console.log('✅ WebSocket connecté avec succès');
    // Rejoindre le salon automatiquement
    if (shopData && shopData.email) {
        socket.emit('join-shop', shopData.email);
        console.log('🔌 Salon rejoint:', shopData.email);
    }
});

// Erreur de connexion
socket.on('connect_error', (error) => {
    console.error('❌ Erreur de connexion WebSocket:', error);
});

// Déconnexion
socket.on('disconnect', (reason) => {
    console.log('🔌 WebSocket déconnecté:', reason);
    if (reason === 'io server disconnect') {
        socket.connect();
    }
});

// Reconnexion réussie
socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 WebSocket reconnecté après', attemptNumber, 'tentatives');
    if (shopData && shopData.email) {
        socket.emit('join-shop', shopData.email);
        console.log('🔌 Salon rejoint après reconnexion:', shopData.email);
    }
});

console.log('📧 Email du magasin:', shopData ? shopData.email : 'Aucun magasin');

// Joindre le salon au chargement
if (shopData && shopData.email) {
    socket.emit('join-shop', shopData.email);
    console.log('🔌 Rejoint le salon du magasin:', shopData.email);
}

// ==================== RÉCEPTION DES NOTIFICATIONS ====================
socket.on('new-request', (data) => {
    console.log('🔥🔥🔥 NOUVELLE NOTIFICATION REÇUE !!! 🔥🔥🔥');
    console.log('📩 Données reçues:', data);
    
    const list = document.getElementById('liveNotificationList');
    if (!list) {
        console.error('❌ Élément liveNotificationList non trouvé');
        return;
    }
    
    // Supprimer le message "En attente..."
    const placeholder = list.querySelector('p');
    if (placeholder && placeholder.style.color === '#999') {
        placeholder.remove();
    }
    
    // Créer la notification AVEC la photo
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
    
    // Afficher la photo si elle existe
    let photoHtml = '';
    if (data.photo) {
        photoHtml = `<img src="${data.photo}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;">`;
    } else {
        photoHtml = `<span style="font-size: 30px;">📸</span>`;
    }
    
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
    
    // Jouer le son
    const sound = document.getElementById('notificationSound');
    if (sound) {
        sound.play().catch(() => console.log('🔇 Son bloqué par le navigateur'));
    }
    
    // Notification push (si autorisée)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Cabine Service', {
            body: `Cabine ${data.cabine} - Taille ${data.taille}`,
            icon: '/icon.png',
            silent: false
        });
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
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateStats(data);
            updateHistoryTable(data);
        }
    } catch (error) {
        console.error('Erreur chargement historique:', error);
    }
}

function updateStats(history) {
    const today = new Date().toDateString();
    const todayCount = history.filter(h => new Date(h.date).toDateString() === today).length;
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('weekCount').textContent = history.length;
    document.getElementById('monthCount').textContent = history.length;
    document.getElementById('totalCount').textContent = history.length;
}

function updateHistoryTable(history) {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color:#999;">
                    Aucune demande pour l'instant
                </td>
            </tr>
        `;
        return;
    }

    const recent = history.slice(0, 10);
    recent.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Cabine ${item.cabine}</td>
            <td>${item.taille}</td>
            <td>${new Date(item.date).toLocaleString()}</td>
            <td>
                ${item.photo ? `<img src="${item.photo}" alt="Photo" width="50" style="object-fit:cover; border-radius:4px;">` : 'Pas de photo'}
            </td>
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
        statusDiv.innerHTML = `
            <div style="padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                <strong>⚠️ Token non configuré</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #856404;">
                    Veuillez configurer votre bot Telegram ci-dessous pour recevoir les notifications.
                </p>
            </div>
        `;
    } else {
        statusDiv.innerHTML = `
            <div style="padding: 12px; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;">
                <strong>✅ Bot configuré</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #155724;">
                    Les notifications seront envoyées sur votre Telegram.
                </p>
            </div>
        `;
    }
}

const updateForm = document.getElementById('updateTelegramForm');
if (updateForm) {
    updateForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const token = localStorage.getItem('token');
        const newToken = document.getElementById('newTelegramToken').value.trim();
        const newChatId = document.getElementById('newTelegramChatId').value.trim();
        const statusDiv = document.getElementById('updateTelegramStatus');
        
        if (!newToken || !newChatId) {
            statusDiv.innerHTML = '❌ Veuillez remplir tous les champs';
            statusDiv.style.color = 'red';
            return;
        }
        
        statusDiv.innerHTML = '⏳ Mise à jour en cours...';
        statusDiv.style.color = 'blue';
        
        try {
            const response = await fetch('https://cabine-service.onrender.com/api/update-telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    telegramToken: newToken,
                    telegramChatId: newChatId
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                statusDiv.innerHTML = '✅ ' + data.message;
                statusDiv.style.color = 'green';
                
                const shop = JSON.parse(localStorage.getItem('shop'));
                shop.telegram_token = '✅ Configuré';
                localStorage.setItem('shop', JSON.stringify(shop));
                
                setTimeout(() => {
                    checkTelegramStatus();
                }, 1000);
                
                document.getElementById('newTelegramToken').value = '';
                document.getElementById('newTelegramChatId').value = '';
            } else {
                statusDiv.innerHTML = '❌ ' + (data.error || 'Erreur lors de la mise à jour');
                statusDiv.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur:', error);
            statusDiv.innerHTML = '❌ Erreur de connexion au serveur. Vérifie qu\'il est démarré.';
            statusDiv.style.color = 'red';
        }
    });
}

// ==================== TÉLÉCHARGER LES QR CODES ====================
document.getElementById('downloadQrBtn').addEventListener('click', async function() {
    const btn = this;
    const originalText = btn.textContent;
    btn.textContent = '⏳ Génération en cours...';
    btn.disabled = true;

    try {
        const qrGrid = document.getElementById('qrGrid');
        const qrItems = qrGrid.querySelectorAll('.qr-item');
        
        if (qrItems.length === 0) {
            alert('Aucun QR Code à télécharger.');
            btn.textContent = originalText;
            btn.disabled = false;
            return;
        }

        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: 800px;
            padding: 40px;
            background: white;
            font-family: Arial, sans-serif;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
        `;
        header.innerHTML = `
            <h1 style="font-size: 28px; color: #333; margin: 0;">📱 QR Codes - ${shopData.nom}</h1>
            <p style="font-size: 16px; color: #666; margin: 5px 0 0 0;">
                Cabines d'essayage - Scannez pour demander une autre taille
            </p>
            <p style="font-size: 14px; color: #999; margin: 5px 0 0 0;">
                Généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}
            </p>
        `;
        container.appendChild(header);

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 30px;
            margin-top: 20px;
        `;

        qrItems.forEach(item => {
            const img = item.querySelector('img');
            const label = item.querySelector('p');
            
            const card = document.createElement('div');
            card.style.cssText = `
                text-align: center;
                padding: 15px;
                border: 1px solid #e9ecef;
                border-radius: 12px;
                background: #f8f9fa;
            `;
            
            const imgClone = img.cloneNode(true);
            imgClone.style.cssText = `
                width: 150px;
                height: 150px;
                margin-bottom: 10px;
            `;
            
            const labelClone = document.createElement('p');
            labelClone.style.cssText = `
                font-size: 16px;
                font-weight: bold;
                color: #333;
                margin: 5px 0;
            `;
            labelClone.textContent = label.textContent;
            
            const subLabel = document.createElement('p');
            subLabel.style.cssText = `
                font-size: 12px;
                color: #888;
                margin: 0;
            `;
            subLabel.textContent = 'Scanner pour demander une autre taille';
            
            card.appendChild(imgClone);
            card.appendChild(labelClone);
            card.appendChild(subLabel);
            grid.appendChild(card);
        });

        container.appendChild(grid);

        const footer = document.createElement('div');
        footer.style.cssText = `
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            font-size: 12px;
            color: #999;
        `;
        footer.innerHTML = `
            Cabine Service - © ${new Date().getFullYear()} - Tous droits réservés
        `;
        container.appendChild(footer);

        document.body.appendChild(container);

        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        document.body.removeChild(container);

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`QR_Codes_${shopData.nom}_${new Date().toISOString().slice(0,10)}.pdf`);

        btn.textContent = '✅ Téléchargé avec succès !';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('❌ Erreur:', error);
        alert('Erreur lors de la génération du PDF.');
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// ==================== ANIMATION CSS ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;
document.head.appendChild(style);

// ==================== INITIALISATION ====================
checkTelegramStatus();
console.log('✅ Dashboard chargé avec succès');
