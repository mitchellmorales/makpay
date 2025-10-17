const form = document.getElementById('payment-form');
const submitButton = document.getElementById('submit-button');
const resultMessage = document.getElementById('result-message');
const cardErrors = document.getElementById('card-errors');
const spinner = document.getElementById('spinner');
const processingMessage = document.getElementById('processing-message');

let stripe;
let card;

// Fetch the publishable key from the server
fetch('/config')
    .then((response) => response.json())
    .then((data) => {
        if (!data.publishableKey) {
            throw new Error('Publishable key not found in /config response');
        }

        // Initialize Stripe.js with the publishable key
        stripe = Stripe(data.publishableKey);

        // Create and mount the card element
        const elements = stripe.elements();

        const elementStyles = {
            base: {
                color: '#ffffff', // Corresponds to --text-primary
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
                fontSize: '16px',
                fontSmoothing: 'antialiased',
                '::placeholder': {
                    color: '#8a8a8a', // Corresponds to --text-secondary
                },
            },
            invalid: {
                iconColor: '#f56565', // Corresponds to --error
                color: '#f56565',
            },
        };

        card = elements.create('card', {
            style: elementStyles,
        });

        card.mount('#card-element');

        // Listen for errors from the card element
        card.on('change', function (event) {
            cardErrors.textContent = event.error ? event.error.message : '';
        });

        // Enable the submit button once Stripe.js has loaded
        submitButton.disabled = false;
    })
    .catch((error) => {
        console.error('Error fetching Stripe config:', error);
        cardErrors.textContent = 'Failed to load payment form. Please try again later.';
    });

// Handle form submission
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    spinner.classList.remove('hidden');
    processingMessage.classList.remove('hidden');
    cardErrors.textContent = '';

    const amountInput = document.getElementById('amount');
    const amount = amountInput.value;

    // Step 1: Call our backend to create a PaymentIntent
    try {
        const response = await fetch('/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount }),
        });

        if (!response.ok) {
            const { error = 'An unknown error occurred.' } = await response.json();
            throw new Error(error);
        }

        const { clientSecret, error: backendError } = await response.json();

        if (backendError) {
            throw new Error(backendError);
        }

        // Step 2: Use the client secret to confirm the card payment
        const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: card },
        });

        if (stripeError) {
            // This will catch card errors and other validation errors
            throw stripeError;
        }

        if (paymentIntent.status === 'succeeded') {
            resultMessage.textContent = `Payment Succeeded! $${(paymentIntent.amount / 100).toFixed(2)} is now processing to your bank account.`;
            resultMessage.classList.remove('hidden');
            form.classList.add('hidden');
        } else {
            // Handle other statuses like 'requires_action' or unexpected states
            cardErrors.textContent = `Payment status: ${paymentIntent.status}. Please try again.`;
            submitButton.disabled = false;
        }
    } catch (error) {
        cardErrors.textContent = error.message;
        submitButton.disabled = false;
    } finally {
        // Hide the spinner and processing message
        spinner.classList.add('hidden');
        processingMessage.classList.add('hidden');
    }
});
