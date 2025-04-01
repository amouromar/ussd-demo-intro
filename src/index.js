const express = require('express');
const app = express();

// Middleware to parse USSD POST data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// USSD endpoint
app.post('/ussd', (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  let response = '';

  if (text === '') {
    response = 'CON Welcome to My USSD App\n1. Check Balance\n2. Exit';
  } else if (text === '1') {
    response = 'END Your balance is $100'; // Placeholder for Supabase later
  } else if (text === '2') {
    response = 'END Goodbye';
  } else {
    response = 'END Invalid option';
  }

  res.set('Content-Type', 'text/plain');
  res.send(response);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});