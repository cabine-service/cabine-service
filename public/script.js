// Script pour la page d'inscription
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const statusMessage = document.getElementById('statusMessage');

    if (!form) {
        console.error('Formulaire non trouvé !');
        return;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Récupérer les valeurs
        const shopName = document.getElementById('shopName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const cabines = document.getElementById('cabines').value;
        const telegramToken = document.getElementById('telegramToken').value.trim();
        const telegramChatId = document.getElementById('telegramChatId').value.trim();

        // Vérifications de base
        if (!shopName || !email || !phone || !password || !confirmPassword) {
            statusMessage.innerHTML = '❌ Tous les champs sont obligatoires';
            statusMessage.style.color = 'red';
            return;
        }

        if (password.length < 6) {
            statusMessage.innerHTML = '❌ Le mot de passe doit faire au moins 6 caractères';
            statusMessage.style.color = 'red';
            return;
        }

        if (password !== confirmPassword) {
            statusMessage.innerHTML = '❌ Les mots de passe ne correspondent pas';
            statusMessage.style.color = 'red';
            return;
        }

        if (!telegramToken || !telegramChatId) {
            statusMessage.innerHTML = '❌ Veuillez configurer votre bot Telegram (Token et ID)';
            statusMessage.style.color = 'red';
            return;
        }

        // Afficher un message de chargement
        statusMessage.innerHTML = '⏳ Création du compte en cours...';
        statusMessage.style.color = 'blue';

        try {
            // Envoyer la requête au serveur
            const response = await fetch('https://cabine-service.onrender.com/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    shopName: shopName,
                    email: email,
                    phone: phone,
                    password: password,
                    cabines: cabines,
                    telegramToken: telegramToken,
                    telegramChatId: telegramChatId
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                statusMessage.innerHTML = '✅ ' + data.message + ' Redirection en cours...';
                statusMessage.style.color = 'green';

                // Stocker le token et les infos
                localStorage.setItem('token', data.token);
                localStorage.setItem('shop', JSON.stringify(data.shop));

                // Rediriger vers le dashboard après 2 secondes
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 2000);
            } else {
                statusMessage.innerHTML = '❌ ' + (data.error || 'Erreur lors de l\'inscription');
                statusMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur:', error);
            statusMessage.innerHTML = '❌ Erreur de connexion au serveur. Vérifie que le serveur est démarré.';
            statusMessage.style.color = 'red';
        }
    });
});

// ==================== CONNEXION ====================

// Gérer la soumission du formulaire de connexion
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('statusMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            loginStatus.innerHTML = '❌ Email et mot de passe requis';
            loginStatus.style.color = 'red';
            return;
        }

        loginStatus.innerHTML = '⏳ Connexion en cours...';
        loginStatus.style.color = 'blue';

        try {
            const response = await fetch('https://cabine-service.onrender.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('shop', JSON.stringify(data.shop));

                loginStatus.innerHTML = '✅ Connexion réussie ! Redirection...';
                loginStatus.style.color = 'green';

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                loginStatus.innerHTML = '❌ ' + (data.error || 'Erreur de connexion');
                loginStatus.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur:', error);
            loginStatus.innerHTML = '❌ Erreur de connexion au serveur. Vérifie que le serveur est démarré.';
            loginStatus.style.color = 'red';
        }
    });
}
