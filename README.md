# Stripe Toolbox

Une collection d'outils Node.js pour gérer les abonnements Stripe via ligne de commande.

## 🌿 Branches disponibles

Ce repository contient plusieurs branches spécialisées pour différents cas d'usage :

### 📋 `subscription-management` 
**Gestion en masse des abonnements existants**
- Annulation (fin de période/immédiate)
- Pause et reprise
- Filtres avancés (produit, prix, dates)
- Validation robuste des dates
- Mode dry-run par défaut

```bash
# Exemple : Annuler tous les abonnements d'un produit
node bulk-subscriptions.js cancel-now --product=prod_123 --confirm
```

### ➕ `subscription-creation`
**Création d'abonnements et subscription schedules**
- Création d'abonnements classiques
- Création de subscription schedules (avec fin automatique)
- Support des essais gratuits
- Gestion des méthodes de paiement

```bash
# Exemple : Créer un abonnement avec essai
node create-subscription.js --price=price_123 --customer=cus_456 --payment-method=pm_789 --trial-days=7 --confirm
```

## 🚀 Installation

```bash
# Cloner le repository
git clone <votre-repo>
cd stripe-toolbox

# Installer les dépendances
npm install

# Configurer la clé Stripe
export STRIPE_SECRET_KEY="sk_test_..."
# ou créer un fichier .env avec STRIPE_SECRET_KEY=sk_test_...
```

## 📖 Utilisation

### Changer de branche
```bash
# Pour la gestion en masse
git checkout subscription-management

# Pour la création d'abonnements
git checkout subscription-creation
```

### Configuration requise
- Node.js (version 14+)
- Compte Stripe avec clé API secrète
- Package `stripe` installé

## 🔧 Fonctionnalités communes

- **Mode dry-run** : Simulation par défaut pour éviter les erreurs
- **Debug intégré** : Affichage détaillé des opérations
- **Gestion d'erreurs** : Messages clairs et arrêt gracieux
- **Validation stricte** : Vérification de tous les paramètres
- **Idempotence** : Clés d'idempotence pour éviter les doublons

## 📋 Exemples rapides

### Gestion en masse (subscription-management)
```bash
# Voir ce qui serait fait
node bulk-subscriptions.js cancel-period-end

# Annuler immédiatement avec confirmation
node bulk-subscriptions.js cancel-now --product=prod_123 --confirm

# Pause avec debug
node bulk-subscriptions.js pause --created-on=2024-12-25 --debug --confirm
```

### Création (subscription-creation)
```bash
# Créer un abonnement classique
node create-subscription.js --price=price_123 --customer=cus_456 --payment-method=pm_789 --confirm

# Créer un subscription schedule
node create-subscription.js --schedule --price=price_123 --customer=cus_456 --payment-method=pm_789 --confirm
```

## 🛠️ Dépendances

- `stripe` : SDK officiel Stripe
- `dotenv` : Gestion des variables d'environnement

## ⚠️ Sécurité

- **Testez toujours en dry-run** avant d'exécuter
- **Vérifiez vos filtres** pour éviter les actions non désirées
- **Sauvegardez vos données** avant les opérations en masse
- **Utilisez un compte de test** pour les premiers essais

## 📚 Documentation détaillée

Chaque branche contient sa propre documentation complète dans le README :
- `subscription-management` : Gestion en masse avec filtres avancés
- `subscription-creation` : Création d'abonnements et schedules

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Ajouter de nouvelles fonctionnalités
- Améliorer la documentation

## 📄 Licence

This is a sandbox/demo project. No support provided.
Licensed under the MIT License – see LICENSE for details.
