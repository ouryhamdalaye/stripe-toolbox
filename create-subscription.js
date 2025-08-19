// create-subscription.js
// =============================================================================
// Script de création d'abonnement Stripe
// =============================================================================
// 
// Usage examples:
//   node create-subscription.js --product=prod_123 --price=price_ABC --confirm
//
// Notes:
// - Dry-run par défaut (affiche ce qui serait fait). Ajoute --confirm pour exécuter.

// =============================================================================
// IMPORTS ET CONFIGURATION
// =============================================================================

// Load environment variables from .env file
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

//vérifie la présence de la clé avant d'instancier Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquant (mets-le dans .env ou env var).');
  process.exit(1);
}

//instancie Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const args = process.argv.slice(2);
const confirm = args.includes('--confirm') || false;
const debug = args.includes('--debug') || false;

const priceId = (args.find(a => a.startsWith('--price=')) || '').split('=')[1]; // ID du prix Stripe pour l'abonnement
const customerId = (args.find(a => a.startsWith('--customer=')) || '').split('=')[1]; // ID du client Stripe existant
const customerEmail = (args.find(a => a.startsWith('--customer-email=')) || '').split('=')[1]; // Email du client (pour créer un nouveau client si nécessaire)

// resolve Customer
if(!customerId && !customerEmail){
    console.error('❌ A customer ID or email is required');
    process.exit(1);
}
let customer = null;
try {
    customer  = customerId ? await stripe.customers.retrieve(customerId) : customerEmail ? await stripe.customers.search({ query: `email:'${customerEmail}'` }) : await stripe.customers.create({ email: customerEmail });
} catch (error) {
    if(debug){
        console.error('❌ Error retrieving customer:', error);
        process.exit(1);
    } else {
        console.error('❌ Error retrieving customer');
        process.exit(1);
    }
}

// validate price
try {
    const price = await stripe.prices.retrieve(priceId);
    if(!price){
        console.error('❌ Price not found');
        process.exit(1);
    }

    if(price.active === false){
        console.error('❌ Price is not active');
        process.exit(1);
    }

    if(price.type !== 'recurring'){
        console.error('❌ Price is not a recurring price');
        process.exit(1);
    }
} catch (error) {
    if(debug){
        console.error('❌ Error retrieving price:', error);
        process.exit(1);
    } else {
        console.error('❌ Error retrieving price');
        process.exit(1);
    }
}


const paymentMethodId = (args.find(a => a.startsWith('--payment-method=')) || '').split('=')[1]; // ID de la méthode de paiement Stripe (carte, SEPA, etc.)
const trialDays = (args.find(a => a.startsWith('--trial-days=')) || '').split('=')[1]; // Nombre de jours d'essai gratuit
const trialEnd = (args.find(a => a.startsWith('--trial-end=')) || '').split('=')[1]; // Date de fin d'essai (timestamp Unix seconds)
const taxMode = (args.find(a => a.startsWith('--tax-mode=')) || '').split('=')[1] || 'off'; // Mode de calcul des taxes (off, exclusive, inclusive)

// Subscription Schedule parameters
const isSchedule = args.includes('--schedule') || false; // Date de fin de l'abonnement (timestamp Unix seconds)
const scheduleBehavior = (args.find(a => a.startsWith('--schedule-behavior=')) || '').split('=')[1] || 'cancel'; // Comportement à la fin (release, cancel, pause)

// Créer un Price journalier
const dailyPrice = await stripe.prices.create({
    unit_amount: 500, // en cents, ex: 5.00€
    currency: "eur",
    recurring: {
      interval: "day",        // <-- c’est ici
      interval_count: 1
    },
    product_data: {
      name: "Abonnement journalier-"+(Date.now()/1000)
    }
});
  

// validate Trial
if(trialDays && trialEnd){
    console.error('❌ Trial days and trial end cannot be used together');
    process.exit(1);
}

if(trialDays && trialDays < 0 || trialEnd && trialEnd < Math.floor(Date.now() / 1000)){
    console.error('❌ Trial days cannot be negative or trial end cannot be in the past');
    process.exit(1);
}

if(trialDays > 730){
    console.error('❌ Trial days cannot be more than 730');
    process.exit(1);
}

const mode = 'backoffice'; // this is a script, no UI, so we assume backoffice directly

if(!paymentMethodId){
    console.error('❌ A payment method is required for backoffice mode');
    process.exit(1);
}

// WARNING: Assume that cb is already attached to the customer
// check if cb is attached to the customer using id or email
try {
    const cb = await stripe.paymentMethods.retrieve(paymentMethodId);
    if(customer.id){
        if(cb.customer !== customer.id){
            console.error('❌ Payment method is not attached to the customer');
            process.exit(1);
        }
    }
} catch (error) {
    if(debug){
        console.error('❌ Error retrieving payment method:', error);
        process.exit(1);
    } else {
        console.error('❌ Error retrieving payment method');
        process.exit(1);
    }
}

const strategy = isSchedule ? "subscription_schedule" : "subscription";

const payLoad = {
    customer: customer.data[0].id,
    items: [{ price: priceId, quantity: 1 }],
    collection_method: 'charge_automatically',
    trial_period_days: trialDays,
    trial_end: trialEnd,
    default_payment_method: paymentMethodId,
    metadata: {
        mode: mode,
        strategy: strategy,
    }
}

// If schedule end is provided, create subscription schedule payload
const schedulePayload = isSchedule ? {
    customer: customer.data[0].id,
    start_date: "now",
    end_behavior: scheduleBehavior,
    default_settings: {
        collection_method: 'charge_automatically',
        default_payment_method: paymentMethodId,
    },
    
    metadata: {
        mode: mode,
        strategy: strategy,
    },
    phases: [
        {
            items: [{ price: dailyPrice.id, quantity: 1 }],
            iterations: 3,
        }
    ]
} : null;

//idempotency key
const idempotencyKey = `${customer.data[0].id}-${priceId}-${paymentMethodId}`;

if(!confirm){
    if(isSchedule) {
        console.log('Schedule Payload:', schedulePayload);
    } else {
        console.log('Payload:', payLoad);
    }
    console.log('Idempotency key:', idempotencyKey);
    process.exit(0);
}
try {
    let result;
    if(isSchedule) {
        result = await stripe.subscriptionSchedules.create(schedulePayload, { idempotencyKey });
        console.log('Subscription Schedule created:', result);
        console.log('Schedule id:', result.id);
        console.log('Schedule status:', result.status);
        console.log('Schedule created at:', result.created);
        console.log('Schedule end date:', result.end_date);
        console.log('Schedule end behavior:', result.end_behavior);
        if(result.subscription) {
            console.log('Subscription id:', result.subscription);
        }
    } else {
        result = await stripe.subscriptions.create(payLoad, { idempotencyKey });
        console.log('Subscription created:', result);
        console.log('Subscription id:', result.id);
        console.log('Subscription status:', result.status);
        console.log('Subscription created at:', result.created);
        console.log('Subscription current period start:', result.current_period_start);
        console.log('Subscription current period end:', result.current_period_end);
        console.log('Subscription trial start:', result.trial_start);
        console.log('Subscription trial end:', result.trial_end);
        if(result.status === 'incomplete'){
            console.log('Subscription is incomplete, waiting for payment', result.latest_invoice.payment_intent.status);
            process.exit(0);
        }
    }
} catch (error) {
    if(debug){
        console.error(`❌ Error creating ${isSchedule ? 'subscription schedule' : 'subscription'}:`, error);
        process.exit(1);
    } else {
        console.error(`❌ Error creating ${isSchedule ? 'subscription schedule' : 'subscription'}`);
    }
}


// TODO: prevent duplicates
/*
preventDuplicate():
  existingSubs = listCustomerActiveSubs(customer)
  IF any sub contains priceId (or productId, depending on your rule)
     fail("Already subscribed to this plan")

// validate Tax Mode
if(taxMode !== 'off' && taxMode !== 'exclusive' && taxMode !== 'inclusive' && taxMode !== 'auto'){
    console.error('❌ Tax mode must be off, exclusive, inclusive or auto');
    process.exit(1);
}
*/