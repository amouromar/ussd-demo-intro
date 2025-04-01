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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/ussd", async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  console.log("Phone Number:", phoneNumber); // Log to check format
  let response = "";

  if (text === "") {
    response = "CON Welcome to My USSD App\n1. Check Balance\n2. Exit";
  } else if (text === "1") {
    const { data, error } = await supabase
      .from("users")
      .select("balance")
      .eq("phone", phoneNumber)
      .maybeSingle();

    if (error) {
      console.log("Supabase Error:", error.message);
      response = "END Error fetching balance";
    } else if (!data) {
      response = "END User not registered";
    } else {
      response = `END Your balance is $${data.balance}`;
    }
  } else if (text === "2") {
    response = "END Goodbye";
  } else {
    response = "END Invalid option";
  }

  res.set("Content-Type", "text/plain");
  res.send(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
