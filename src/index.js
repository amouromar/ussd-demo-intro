require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const app = express();

// Supabase setup
console.log("Supabase URL:", process.env.SUPABASE_URL);
console.log("Supabase Key:", process.env.SUPABASE_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// In-memory storage for survey responses per session
const sessionMemory = {};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/ussd", async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  console.log("Session ID:", sessionId);
  console.log("Phone Number:", phoneNumber);
  console.log("Text Input:", text);
  let response = "";

  const inputs = text.split("*");
  const step = inputs.length;

  // Initialize session memory if not present
  if (!sessionMemory[sessionId]) {
    sessionMemory[sessionId] = {
      phone: null,
      country: null,
      city: null,
      president: null,
      currency: null,
      gender: null,
      attempts: 0,
      stage: "phone",
    };
  }

  const memory = sessionMemory[sessionId];

  // Stage 1: Ask for phone number and verify
  if (memory.stage === "phone") {
    if (text === "") {
      response =
        "CON Welcome to My USSD App\nPlease enter your phone number (e.g., +254712345678):";
    } else {
      memory.phone = inputs[0];
      const { data, error } = await supabase
        .from("survey")
        .select("phone")
        .eq("phone", memory.phone)
        .maybeSingle();

      if (error) {
        console.log("Supabase Error:", error.message);
        response = "END Error checking user";
      } else if (data) {
        memory.stage = "survey";
        response =
          "CON User found! Starting survey...\nWhich country are you living in?";
      } else {
        delete sessionMemory[sessionId];
        response = "END User not registered. Please register first.";
      }
    }
  }
  // Stage 2: Conduct survey
  else if (memory.stage === "survey") {
    if (step === 1) {
      response = "CON Which country are you living in?";
    } else if (step === 2) {
      memory.country = inputs[1];
      response = "CON Which city/town are you living in?";
    } else if (step === 3) {
      memory.city = inputs[2];
      response = "CON What is the name of your president?";
    } else if (step === 4) {
      memory.president = inputs[3];
      response = "CON What is the official currency of your country?";
    } else if (step === 5) {
      memory.currency = inputs[4];
      response = "CON What is your gender?";
    } else if (step === 6) {
      memory.gender = inputs[5];
      memory.stage = "confirm";
      response = `CON Your Info:\nCountry: ${memory.country}\nCity: ${memory.city}\nPresident: ${memory.president}\nCurrency: ${memory.currency}\nGender: ${memory.gender}\n1. Confirm\n2. Change Answers`;
    }
  }
  // Stage 3: Confirmation
  else if (memory.stage === "confirm") {
    if (inputs[inputs.length - 1] === "1") {
      console.log("Saving Data:", {
        phone: memory.phone,
        country: memory.country,
        city: memory.city,
        president: memory.president,
        currency: memory.currency,
        gender: memory.gender,
      });
      const { error } = await supabase.from("survey").upsert(
        {
          phone: memory.phone,
          country: memory.country,
          city: memory.city,
          president: memory.president,
          currency: memory.currency,
          gender: memory.gender,
        },
        { onConflict: "phone" }
      );

      if (error) {
        console.log("Save Error:", error);
        response = "END Error saving data";
      } else {
        delete sessionMemory[sessionId];
        response = "END Data saved successfully. Goodbye!";
      }
    } else if (inputs[inputs.length - 1] === "2") {
      if (memory.attempts < 3) {
        memory.stage = "change";
        memory.attempts += 1;
        response = `CON Edit Answers (Attempt ${memory.attempts}/3):\n1. Country: ${memory.country}\n2. City: ${memory.city}\n3. President: ${memory.president}\n4. Currency: ${memory.currency}\n5. Gender: ${memory.gender}\nEnter number to change (or 0 to finish):`;
      } else {
        delete sessionMemory[sessionId];
        response = "END Max attempts reached. Data not saved.";
      }
    } else {
      response =
        "CON Invalid option. Please select:\n1. Confirm\n2. Change Answers";
    }
  }
  // Stage 4: Change Answers
  else if (memory.stage === "change") {
    const lastInput = inputs[inputs.length - 1];
    if (lastInput === "0") {
      memory.stage = "confirm";
      response = `CON Your Updated Info:\nCountry: ${memory.country}\nCity: ${memory.city}\nPresident: ${memory.president}\nCurrency: ${memory.currency}\nGender: ${memory.gender}\n1. Confirm\n2. Change Answers`;
    } else if (lastInput === "1") {
      response = "CON Enter new country:";
      memory.stage = "change-country";
    } else if (lastInput === "2") {
      response = "CON Enter new city/town:";
      memory.stage = "change-city";
    } else if (lastInput === "3") {
      response = "CON Enter new president:";
      memory.stage = "change-president";
    } else if (lastInput === "4") {
      response = "CON Enter new currency:";
      memory.stage = "change-currency";
    } else if (lastInput === "5") {
      response = "CON Enter new gender:";
      memory.stage = "change-gender";
    } else {
      response = `CON Invalid option. Select:\n1. Country: ${memory.country}\n2. City: ${memory.city}\n3. President: ${memory.president}\n4. Currency: ${memory.currency}\n5. Gender: ${memory.gender}\n0 to finish`;
    }
  }
  // Handle individual changes
  else if (memory.stage.startsWith("change-")) {
    const newValue = inputs[inputs.length - 1];
    if (memory.stage === "change-country") memory.country = newValue;
    if (memory.stage === "change-city") memory.city = newValue;
    if (memory.stage === "change-president") memory.president = newValue;
    if (memory.stage === "change-currency") memory.currency = newValue;
    if (memory.stage === "change-gender") memory.gender = newValue;
    memory.stage = "change";
    response = `CON Updated! Select another to change:\n1. Country: ${memory.country}\n2. City: ${memory.city}\n3. President: ${memory.president}\n4. Currency: ${memory.currency}\n5. Gender: ${memory.gender}\n0 to finish`;
  }

  res.set("Content-Type", "text/plain");
  res.send(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
