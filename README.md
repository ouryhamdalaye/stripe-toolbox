# Stripe Subscription Creation Tool

Un outil Node.js pour créer des abonnements Stripe via ligne de commande, avec support pour les subscription schedules.

## 🚀 Installation

```bash
npm install
```

## ⚙️ Configuration

Créez un fichier `.env` à la racine du projet :

```env
STRIPE_SECRET_KEY=sk_test_votre_cle_secrete_ici
```

## 📖 Utilisation

### Subscription classique

```bash
node create-subscription.js --price=price_123 --customer=cus_456 --payment-method=pm_789 --confirm
```

### Subscription Schedule (avec fin automatique)

```bash
node create-subscription.js --schedule --price=price_123 --customer=cus_456 --payment-method=pm_789 --confirm
```

## 🔧 Paramètres

### Paramètres requis
- `--price=` : ID du prix Stripe
- `--customer=` : ID du client Stripe OU `--customer-email=` : email du client
- `--payment-method=` : ID de la méthode de paiement

### Paramètres optionnels
- `--trial-days=7` : Nombre de jours d'essai gratuit
- `--trial-end=1234567890` : Date de fin d'essai (timestamp Unix)
- `--schedule-behavior=cancel` : Comportement à la fin du schedule (release, cancel, pause)
- `--debug` : Affiche les détails d'erreur
- `--confirm` : Exécute réellement (sans ça = dry-run)

### Flags
- `--schedule` : Crée une subscription schedule au lieu d'une subscription classique

## 📋 Exemples

### Dry-run (affiche ce qui serait fait)
```bash
node create-subscription.js --price=price_123 --customer-email=user@example.com --payment-method=pm_456
```

### Subscription avec essai gratuit
```bash
node create-subscription.js --price=price_123 --customer=cus_789 --payment-method=pm_456 --trial-days=7 --confirm
```

### Subscription schedule avec debug
```bash
node create-subscription.js --schedule --price=price_123 --customer-email=user@example.com --payment-method=pm_456 --debug --confirm
```

## 🔄 Types d'abonnements

### Subscription classique
- Abonnement standard Stripe
- Se renouvelle automatiquement
- Géré par Stripe

### Subscription Schedule
- Abonnement avec fin automatique
- 3 itérations par défaut (journalier)
- Comportement configurable à la fin (cancel, release, pause)

## 🛠️ Dépendances

- `stripe` : SDK officiel Stripe
- `dotenv` : Gestion des variables d'environnement

## 📝 Notes

- **Dry-run par défaut** : Ajoutez `--confirm` pour exécuter réellement
- **Mode backoffice** : Le script assume un contexte serveur (pas d'UI)
- **Méthode de paiement** : Doit être attachée au client avant utilisation
- **Idempotence** : Utilise une clé d'idempotence pour éviter les doublons
