// ==================== VÉRIFICATION ADMIN ====================
const token = localStorage.getItem('token');
const shop = JSON.parse(localStorage.getItem('shop'));

if (!token || !shop || shop.email !== 'admin@cabineservice.com') {
    window.location.href = 'login.html';
}

document.getElementById('adminEmail').textContent = shop.email;

// ==================== DÉCONNEXION ====================
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
});

// ==================== CHARGER LES STATISTIQUES ====================
async function loadStats() {
    try {
        const response = await fetch('https://cabine-service.onrender.com/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('totalMagasins').textContent = data.magasins || 0;
            document.getElementById('totalDemandes').textContent = data.demandes || 0;
            document.getElementById('totalActifs').textContent = data.actifs || 0;
        }
    } catch (error) {
        console.error('Erreur stats:', error);
    }
}

// ==================== CHARGER LES MAGASINS ====================
async function loadMagasins() {
    const tbody = document.getElementById('magasinsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#b0c4de;">Chargement...</td></tr>';

    try {
        const response = await fetch('https://cabine-service.onrender.com/api/admin/magasins', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ff6b6b;">Erreur de chargement</td></tr>';
            return;
        }

        const magasins = await response.json();

        if (magasins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#b0c4de;">Aucun magasin inscrit</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        magasins.forEach(shop => {
            const tr = document.createElement('tr');
            const isActive = shop.abonnement_actif;

            tr.innerHTML = `
                <td>${shop.id}</td>
                <td><strong>${shop.nom}</strong></td>
                <td>${shop.email}</td>
                <td>${shop.telephone || '-'}</td>
                <td>${shop.cabines}</td>
                <td>
                    <span class="status-badge ${isActive ? 'active' : 'inactive'}">
                        ${isActive ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <button class="btn-toggle ${isActive ? 'deactivate' : 'activate'}"
                            data-id="${shop.id}"
                            data-active="${isActive}">
                        ${isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button class="btn-delete" data-id="${shop.id}" title="Supprimer">🗑️</button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // ==================== ÉVÉNEMENTS ====================
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const currentActive = btn.dataset.active === 'true';
                const newActive = !currentActive;

                try {
                    const response = await fetch(`https://cabine-service.onrender.com/api/admin/magasins/${id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ abonnement_actif: newActive })
                    });

                    if (response.ok) {
                        loadMagasins();
                        loadStats();
                    } else {
                        alert('Erreur lors de la mise à jour');
                    }
                } catch (error) {
                    console.error('Erreur:', error);
                    alert('Erreur réseau');
                }
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Supprimer définitivement ce magasin ?')) return;

                try {
                    const response = await fetch(`https://cabine-service.onrender.com/api/admin/magasins/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        loadMagasins();
                        loadStats();
                    } else {
                        alert('Erreur lors de la suppression');
                    }
                } catch (error) {
                    console.error('Erreur:', error);
                    alert('Erreur réseau');
                }
            });
        });

    } catch (error) {
        console.error('Erreur:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ff6b6b;">Erreur de connexion</td></tr>';
    }
}

// ==================== INIT ====================
loadStats();
loadMagasins();
