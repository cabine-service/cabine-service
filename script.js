// Récupérer le numéro de cabine depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const cabine = urlParams.get('cabine') || '1';
document.getElementById('cabine-number').textContent = cabine;

// 🔥 Récupérer l'email du magasin
let magasinEmail = urlParams.get('magasin');
if (!magasinEmail) {
    try {
        const shop = JSON.parse(localStorage.getItem('shop'));
        if (shop && shop.email) {
            magasinEmail = shop.email;
        }
    } catch (e) {}
}
if (!magasinEmail) magasinEmail = 'demo';
console.log('📧 Magasin utilisé:', magasinEmail);

// Variables
let photoData = null;
const takePhotoBtn = document.getElementById('takePhotoBtn');
const sendBtn = document.getElementById('sendBtn');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const statusMessage = document.getElementById('statusMessage');
const sizeSelect = document.getElementById('size');

// 1. Prendre la photo
takePhotoBtn.addEventListener('click', function() {
    console.log('🟢 Bouton "Prendre une photo" cliqué !');
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            photoData = event.target.result;
            previewImage.src = photoData;
            previewContainer.style.display = 'block';
            sendBtn.disabled = false;
            statusMessage.textContent = '✅ Photo prise, vous pouvez envoyer !';
            statusMessage.style.color = '#28a745';
        };
        reader.readAsDataURL(file);
    };

    input.click();
});

// 2. Envoyer la demande
sendBtn.addEventListener('click', async function() {
    if (!photoData) {
        alert('Veuillez prendre une photo d\'abord !');
        return;
    }

    const taille = sizeSelect.value;
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ Envoi en cours...';
    statusMessage.textContent = '';

    try {
        const response = await fetch('https://cabine-service.onrender.com/api/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cabine: cabine,
                taille: taille,
                photo: photoData,
                magasin: magasinEmail
            })
        });

        const data = await response.json();

        if (response.ok) {
            statusMessage.textContent = '✅ Demande envoyée ! Un vendeur arrive dans 2 min.';
            statusMessage.style.color = '#28a745';
            sendBtn.textContent = '📤 Envoyer une autre demande';
            sendBtn.disabled = false;
        } else {
            statusMessage.textContent = '❌ ' + (data.error || 'Erreur');
            statusMessage.style.color = 'red';
            sendBtn.disabled = false;
            sendBtn.textContent = '📤 Envoyer la demande';
        }
    } catch (error) {
        console.error('❌ Erreur:', error);
        statusMessage.textContent = '❌ Erreur de connexion au serveur.';
        statusMessage.style.color = 'red';
        sendBtn.disabled = false;
        sendBtn.textContent = '📤 Envoyer la demande';
    }
});

console.log('✅ Script client chargé');
