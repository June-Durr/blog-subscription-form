// server.js - For local development only
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { handler } = require("./lambda/subscribeHandler");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API endpoint to handle form submissions
app.post("/api/subscribe", async (req, res) => {
  try {
    // Format the request as an API Gateway event
    const event = {
      body: JSON.stringify(req.body),
      headers: req.headers,
      httpMethod: "POST",
    };

    // Call the Lambda handler directly
    const result = await handler(event);

    // Send back the Lambda response
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error("Server error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
