// bulk-subscriptions.js
// =============================================================================
// Script de gestion en masse des abonnements Stripe
// =============================================================================
// 
// Usage examples:
//   node bulk-subscriptions.js cancel-period-end --confirm
//   node bulk-subscriptions.js cancel-now --product=prod_123 --confirm
//   node bulk-subscriptions.js pause --price=price_ABC
//   node bulk-subscriptions.js resume --confirm
//
// Notes:
// - Dry-run par défaut (affiche ce qui serait fait). Ajoute --confirm pour exécuter.
// - Filtres par product ou price (facultatifs). Sans filtre = tous les abonnements du compte.
// - Statuts traités: active + trialing.

// =============================================================================
// IMPORTS ET CONFIGURATION
// =============================================================================

// Load environment variables from .env file
require('dotenv').config();

const Stripe = require('stripe');

// Vérifie la présence de la clé avant d'instancier Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquant (mets-le dans .env ou env var).');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

// =============================================================================
// PARSING DES ARGUMENTS
// =============================================================================

const args = process.argv.slice(2);
const mode = args[0]; // cancel-period-end | cancel-now | pause | resume
const confirm = args.includes('--confirm');
const debug = args.includes('--debug');

const productFilter = (args.find(a => a.startsWith('--product=')) || '').split('=')[1];
const priceFilter   = (args.find(a => a.startsWith('--price='))   || '').split('=')[1];
const createdOnArg  = (args.find(a => a.startsWith('--created-on=')) || '').split('=')[1];
const untilArg      = (args.find(a => a.startsWith('--until='))      || '').split('=')[1];

// =============================================================================
// VALIDATION DES DATES
// =============================================================================

let createdFilter = null;
if (createdOnArg || untilArg) {
  let fromTs = null;
  let toTs = null;

  if (createdOnArg) {
    const parts = createdOnArg.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
      console.error('❌ Paramètre --created-on invalide. Format attendu: YYYY-MM-DD');
      process.exit(1);
    }
    const [y, m, d] = parts;
    
    // Validation complète de la date
    if (y < 1900 || y > 2100) {
      console.error('❌ Paramètre --created-on invalide. L\'année doit être entre 1900 et 2100');
      process.exit(1);
    }
    if (m < 1 || m > 12) {
      console.error('❌ Paramètre --created-on invalide. Le mois doit être entre 1 et 12');
      process.exit(1);
    }
    if (d < 1 || d > 31) {
      console.error('❌ Paramètre --created-on invalide. Le jour doit être entre 1 et 31');
      process.exit(1);
    }
    
    // Validation que c'est une date valide (ex: pas 30 février)
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      console.error('❌ Paramètre --created-on invalide. Date invalide (ex: 30 février)');
      process.exit(1);
    }
    
    fromTs = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
    // Limite exclusive: début du jour suivant pour inclure toute la journée indiquée
    toTs = Math.floor(Date.UTC(y, m - 1, d + 1, 0, 0, 0) / 1000);
  }

  if (untilArg) {
    const parts = untilArg.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
      console.error('❌ Paramètre --until invalide. Format attendu: YYYY-MM-DD');
      process.exit(1);
    }
    const [y, m, d] = parts;
    
    // Validation complète de la date
    if (y < 1900 || y > 2100) {
      console.error('❌ Paramètre --until invalide. L\'année doit être entre 1900 et 2100');
      process.exit(1);
    }
    if (m < 1 || m > 12) {
      console.error('❌ Paramètre --until invalide. Le mois doit être entre 1 et 12');
      process.exit(1);
    }
    if (d < 1 || d > 31) {
      console.error('❌ Paramètre --until invalide. Le jour doit être entre 1 et 31');
      process.exit(1);
    }
    
    // Validation que c'est une date valide (ex: pas 30 février)
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      console.error('❌ Paramètre --until invalide. Date invalide (ex: 30 février)');
      process.exit(1);
    }
    
    // Limite exclusive: début du jour suivant pour inclure toute la journée indiquée
    const untilExclusive = Math.floor(Date.UTC(y, m - 1, d + 1, 0, 0, 0) / 1000);
    toTs = untilExclusive;
  }

  // Si seulement --until est fourni, on filtre tout ce qui est strictement avant ce jour+1
  // Si seulement --created-on est fourni, on a déjà from/to sur la même journée
  // Si les deux sont fournis, on garde from de created-on et to de until
  createdFilter = {};
  if (fromTs != null) createdFilter.gte = fromTs;
  if (toTs != null) createdFilter.lt = toTs;

  if (createdFilter.gte != null && createdFilter.lt != null && createdFilter.gte >= createdFilter.lt) {
    console.error('❌ Incohérence des dates: --created-on doit être ≤ --until');
    process.exit(1);
  }
}

// =============================================================================
// VALIDATION DU MODE
// =============================================================================

if (!['cancel-period-end', 'cancel-now', 'pause', 'resume'].includes(mode)) {
  console.log('Mode invalide.\nModes: cancel-period-end | cancel-now | pause | resume');
  process.exit(1);
}

// =============================================================================
// LOGIQUE PRINCIPALE
// =============================================================================

(async () => {
  let count = 0, acted = 0;
  const productCache = new Map();
  
  // Affichage des paramètres en mode debug
  if (debug) {
    console.log('Debug actif');
    console.log('   mode =', mode);
    console.log('   confirm =', confirm);
    console.log('   productFilter =', productFilter || '(none)');
    console.log('   priceFilter =', priceFilter || '(none)');
    console.log('   createdFilter =', createdFilter || '(none)');
  }

  // On traite active + trialing
  const statuses = ['active', 'trialing'];
  for (const status of statuses) {
    const list = stripe.subscriptions.list({
      status,
      limit: 100,
      // Expansion nécessaire pour accéder aux détails des prix et produits
      expand: ['data.items.data.price'],
      ...(createdFilter ? { created: createdFilter } : {})
    });

    for await (const sub of list) {
      // Filtrage par product/price si demandé
      const items = sub.items?.data || [];

      // =============================================================================
      // EXTRACTION DES INFORMATIONS DE DEBUG
      // =============================================================================
      
      const priceIds = [];
      const productIds = [];
      const productNames = [];
      for (const it of items) {
        const price = it.price;
        if (price?.id) priceIds.push(price.id);
        let name = '';
        if (price?.product && typeof price.product === 'object') {
          if (price.product?.id) productIds.push(price.product.id);
          name = price.product?.name || '';
        } else if (typeof price?.product === 'string') {
          productIds.push(price.product);
          let product = productCache.get(price.product);
          if (!product) {
            try {
              product = await stripe.products.retrieve(price.product);
              productCache.set(price.product, product);
            } catch (e) {
              if (debug) console.log(`   ⚠️  Impossible de récupérer le produit ${price.product}: ${e.message}`);
            }
          }
          name = product?.name || '';
        } else {
          name = price?.nickname || '';
        }
        if (name) productNames.push(name);
      }

      debug && console.log('priceIds', priceIds);
      debug && console.log('productIds', productIds);
      debug && console.log('productNames', productNames);
      
      // =============================================================================
      // APPLICATION DES FILTRES
      // =============================================================================

      const matchesProduct = productFilter
        ? productNames.some(name => name.toLowerCase() === productFilter.toLowerCase())
        : true;

      const matchesPrice = priceFilter
        ? priceIds.some(id => id === priceFilter)
        : true;

      if (!matchesProduct || !matchesPrice) continue;

      // Affichage des détails en mode debug
      if (debug) {
        const createdAt = new Date((sub.created || 0) * 1000).toISOString();
        console.log(`→ Cible: ${sub.id} | status=${sub.status} | created=${createdAt}`);
        console.log('   items.priceIds =', priceIds);
        console.log('   items.productIds =', productIds);
        console.log('   items.productNames =', productNames);
      }

      count++;

      // =============================================================================
      // DÉFINITION DES ACTIONS
      // =============================================================================
      
      let actionDesc = '';
      let updatePayload = null;

      if (mode === 'cancel-period-end') {
        if (sub.cancel_at_period_end) continue; // déjà prévu
        actionDesc = `Annulation fin de période`;
        updatePayload = { cancel_at_period_end: true };
      }

      if (mode === 'cancel-now') {
        // Annulation immédiate (équivalent delete sans attendre la période)
        actionDesc = `Annulation immédiate`;
        // On utilise la méthode .cancel() pour stop direct
        if (confirm) {
          try {
            await stripe.subscriptions.cancel(sub.id);
            acted++;
            console.log(` ${actionDesc} -> ${sub.id}`);
          } catch (e) {
            console.error(`❌ ${sub.id}: ${e.message}`);
          }
        } else {
          console.log(`[DRY-RUN] ${actionDesc} -> ${sub.id}`);
        }
        continue; // on saute le update() générique
      }

      if (mode === 'pause') {
        if (sub.pause_collection) continue; // déjà en pause
        actionDesc = `Pause (pause_collection=keep_as_draft)`;
        // keep_as_draft: les factures créées pendant la pause restent en draft (rien n'est tenté)
        updatePayload = { pause_collection: { behavior: 'keep_as_draft' } };
      }

      if (mode === 'resume') {
        if (!sub.pause_collection && !sub.cancel_at_period_end) continue; // rien à reprendre
        actionDesc = `Reprise (enlève pause et cancel_at_period_end)`;
        updatePayload = {
          pause_collection: '', // null/'' enlève la pause
          cancel_at_period_end: false,
        };
      }

      // =============================================================================
      // EXÉCUTION DES ACTIONS
      // =============================================================================
      
      if (updatePayload) {
        if (confirm) {
          try {
            await stripe.subscriptions.update(sub.id, updatePayload);
            acted++;
            console.log(`${actionDesc} -> ${sub.id}`);
          } catch (e) {
            console.error(`❌ ${sub.id}: ${e.message}`);
          }
        } else {
          console.log(`[DRY-RUN] ${actionDesc} -> ${sub.id}`, updatePayload);
        }
      }
    }
  }

  // =============================================================================
  // RÉSUMÉ FINAL
  // =============================================================================
  
  console.log(`\nRésumé: ${count} abonnement(s) ciblé(s). ${confirm ? acted : 0} modifié(s). ${confirm ? '' : '(dry-run – aucune modif faite)'}`);
})().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
