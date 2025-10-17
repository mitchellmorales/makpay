// Load environment variables from .env file
require('dotenv').config();

// Import required dependencies
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = 4242;

// ============================================
// Middleware Configuration
// ============================================

// Parse incoming JSON request bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// ============================================
// API Routes
// ============================================

/**
 * Get Stripe Publishable Key
 * GET /config
 *
 * Provides the Stripe publishable key to the frontend.
 */
app.get('/config', (req, res) => {
    res.send({ publishableKey: process.env.STRIPE_PUBLIC_KEY });
});

/**
 * Create Payment Intent
 * POST /create-payment-intent
 *
 * Creates a Stripe Payment Intent for processing card payments
 * Request body: { amount: number }
 * Response: { clientSecret: string, amount: number }
 */
app.post('/create-payment-intent', async (req, res) => {
    const { amount } = req.body;

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Validate amount (minimum $0.50)
    if (isNaN(amountInCents) || amountInCents <= 50) {
        return res.status(400).send({ error: 'Invalid or insufficient amount' });
    }

    try {
        // Create a new Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            payment_method_types: ['card'],
            description: 'Personal fund transfer via web app',
        });

        // Return client secret for frontend payment confirmation
        res.send({
            clientSecret: paymentIntent.client_secret,
            amount: amountInCents / 100
        });

    } catch (error) {
        console.error('Stripe Error:', error);
        res.status(500).send({ error: error.message });
    }
});

// ============================================
// Server Initialization
// ============================================

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log('Stripe Payouts will be sent to your linked USD bank account.');
});
