# Bulk Subscriptions Manager

Script Node.js pour gérer en masse les abonnements Stripe avec des filtres avancés et une validation robuste.

## Fonctionnalités

- **4 modes d'action** : Annulation (fin de période/immédiate), Pause, Reprise
- **Filtres flexibles** : Par produit, prix, et plage de dates
- **Validation robuste** : Dates complètes avec vérification de validité
- **Mode dry-run** : Simulation par défaut pour éviter les erreurs
- **Debug intégré** : Affichage détaillé des opérations
- **Gestion d'erreurs** : Messages clairs et arrêt gracieux

## Prérequis

- Node.js (version 14+)
- Compte Stripe avec clé API secrète
- Package `stripe` installé

## Installation

```bash
# Cloner le repository
git clone <votre-repo>
cd bulk-subscriptions-manager

# Installer les dépendances
npm install

# Configurer la clé Stripe
export STRIPE_SECRET_KEY="sk_test_..."
# ou créer un fichier .env avec STRIPE_SECRET_KEY=sk_test_...
```

## Utilisation

### Syntaxe générale
```bash
node bulk-subscriptions.js <mode> [options] [--confirm]
```

### Modes disponibles

| Mode | Description |
|------|-------------|
| `cancel-period-end` | Annule à la fin de la période de facturation |
| `cancel-now` | Annule immédiatement |
| `pause` | Met en pause (factures en draft) |
| `resume` | Reprend les abonnements en pause/annulés |

### Options de filtrage

| Option | Description | Exemple |
|--------|-------------|---------|
| `--product=ID` | Filtre par ID de produit | `--product=prod_123` |
| `--price=ID` | Filtre par ID de prix | `--price=price_ABC` |
| `--created-on=DATE` | Filtre par date de création | `--created-on=2024-12-25` |
| `--until=DATE` | Filtre jusqu'à une date | `--until=2024-12-31` |
| `--debug` | Active le mode debug | `--debug` |
| `--confirm` | Exécute réellement (sinon dry-run) | `--confirm` |

### Exemples d'utilisation

```bash
# Dry-run : voir ce qui serait fait
node bulk-subscriptions.js cancel-period-end

# Annuler tous les abonnements d'un produit spécifique
node bulk-subscriptions.js cancel-now --product=prod_123 --confirm

# Pause des abonnements créés le 25 décembre 2024
node bulk-subscriptions.js pause --created-on=2024-12-25 --confirm

# Reprendre les abonnements en pause avec debug
node bulk-subscriptions.js resume --debug --confirm

# Annuler les abonnements d'un prix spécifique dans une plage de dates
node bulk-subscriptions.js cancel-period-end \
  --price=price_ABC \
  --created-on=2024-01-01 \
  --until=2024-01-31 \
  --confirm
```

## Validation des dates

Le script valide rigoureusement les dates :
- **Format** : `YYYY-MM-DD` obligatoire
- **Plage d'années** : 1900-2100
- **Validation réelle** : Vérifie que la date existe (ex: pas 30 février)
- **Limites exclusives** : Inclut toute la journée spécifiée

### Exemples de validation
```bash
# ✅ Valide
--created-on=2024-12-25

# ❌ Invalide (format)
--created-on=25-12-2024

# ❌ Invalide (date inexistante)
--created-on=2024-02-30

# ❌ Invalide (année hors plage)
--created-on=1800-01-01
```

## Sécurité

- **Dry-run par défaut** : Aucune modification sans `--confirm`
- **Validation stricte** : Vérification de tous les paramètres
- **Gestion d'erreurs** : Arrêt gracieux en cas de problème
- **Logs détaillés** : Traçabilité complète des actions

## Sortie

### Mode normal
```
✔️  Annulation fin de période -> sub_1234567890
✔️  Annulation fin de période -> sub_0987654321

Résumé: 2 abonnement(s) ciblé(s). 2 modifié(s).
```

### Mode debug
```
Debug actif
   mode = cancel-period-end
   confirm = true
   productFilter = prod_123
   priceFilter = (none)
   createdFilter = (none)

→ Cible: sub_1234567890 | status=active | created=2024-12-25T10:30:00.000Z
   items.priceIds = ['price_ABC']
   items.productIds = ['prod_123']
   items.productNames = ['Mon Produit']

Annulation fin de période -> sub_1234567890
```

### Mode dry-run
```
[DRY-RUN] Annulation fin de période -> sub_1234567890 { cancel_at_period_end: true }

Résumé: 1 abonnement(s) ciblé(s). 0 modifié(s). (dry-run – aucune modif faite)
```

## ⚠️ Avertissements

- **Testez toujours en dry-run** avant d'exécuter
- **Vérifiez vos filtres** pour éviter les actions non désirées
- **Sauvegardez vos données** avant les opérations en masse
- **Utilisez un compte de test** pour les premiers essais

## Développement

### Structure du code
```
bulk-subscriptions.js
├── Imports et configuration
├── Parsing des arguments
├── Validation des dates
├── Validation du mode
├── Logique principale
    ├── Extraction des informations de debug
    ├── Application des filtres
    ├── Définition des actions
    ├── Exécution des actions
    └── Résumé final
```

### Ajout de nouveaux modes

1. Ajouter le mode dans la validation
2. Implémenter la logique dans la section "Définition des actions"
3. Tester avec `--debug` et dry-run

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Ajouter de nouveaux modes d'action
- Améliorer la documentation
