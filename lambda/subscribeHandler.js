// Update your lambda/subscribeHandler.js file
const AWS = require("aws-sdk");

// Initialize AWS clients
const dynamoDb = new AWS.DynamoDB({ region: "us-east-1" });
const ses = new AWS.SES({ region: "us-east-1" });

// Email addresses - replace these with your real email addresses
const ADMIN_EMAIL = "alberto.camachojr01@gmail.com";
const FROM_EMAIL = "alberto.camachojr01@gmail.com";

// Rest of your handler code with CORS headers
exports.handler = async (event) => {
  // Set up CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Credentials": true,
  };

  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ message: "CORS preflight response" }),
    };
  }

  try {
    // Parse the incoming request body
    const body = JSON.parse(event.body);
    const { name, email, phone, package: selectedPackage } = body;

    console.log("Received form submission:", {
      name,
      email,
      phone,
      package: selectedPackage,
    });

    const timestamp = new Date().toISOString();

    // Store data in DynamoDB
    const dynamoParams = {
      TableName: "BlogSubscriptions",
      Item: {
        email: { S: email },
        name: { S: name },
        phone: { S: phone },
        package: { S: selectedPackage },
        subscriptionDate: { S: timestamp },
      },
    };

    console.log("Storing data in DynamoDB...");
    await dynamoDb.putItem(dynamoParams).promise();
    console.log("Data stored successfully");

    // Send confirmation email to the user
    const userEmailParams = {
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
              <html>
                <body>
                  <h1>Thank You for Subscribing!</h1>
                  <p>Hello ${name},</p>
                  <p>Thank you for subscribing to our blog. You've selected the ${selectedPackage} package.</p>
                  <p>We'll keep you updated with our latest content and news.</p>
                  <p>Best regards,<br>Your Blog Team</p>
                </body>
              </html>
            `,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Thanks for Subscribing to Our Blog!",
        },
      },
      Source: FROM_EMAIL,
    };

    console.log("Sending confirmation email to user...");
    await ses.sendEmail(userEmailParams).promise();
    console.log("User email sent successfully");

    // Send notification email to admin
    const adminEmailParams = {
      Destination: {
        ToAddresses: [ADMIN_EMAIL],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
              <html>
                <body>
                  <h1>New Blog Subscription</h1>
                  <p>A new user has subscribed to the blog:</p>
                  <ul>
                    <li><strong>Name:</strong> ${name}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Phone:</strong> ${phone}</li>
                    <li><strong>Package:</strong> ${selectedPackage}</li>
                    <li><strong>Date:</strong> ${timestamp}</li>
                  </ul>
                </body>
              </html>
            `,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "New Blog Subscription",
        },
      },
      Source: FROM_EMAIL,
    };

    console.log("Sending notification email to admin...");
    await ses.sendEmail(adminEmailParams).promise();
    console.log("Admin email sent successfully");

    // Return a success response
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        message: "Subscription successful",
        success: true,
      }),
    };
  } catch (error) {
    console.error("Error processing subscription:", error);

    // Return an error response
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        message: "Failed to process subscription",
        success: false,
        error: error.message,
      }),
    };
  }
};
