// lambda/subscribeHandler.js
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

// Initialize AWS clients
const dynamoDb = new DynamoDBClient({ region: "us-east-1" });
const ses = new SESClient({ region: "us-east-1" });

// Email addresses
const ADMIN_EMAIL = "admin@yourdomain.com"; // Replace with your email
const FROM_EMAIL = "noreply@yourdomain.com"; // Replace with a verified SES email

exports.handler = async (event) => {
  try {
    // Parse the incoming request body
    const body = JSON.parse(event.body);
    const { name, email, phone, package: selectedPackage } = body;

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

    await dynamoDb.send(new PutItemCommand(dynamoParams));

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

    await ses.send(new SendEmailCommand(userEmailParams));

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

    await ses.send(new SendEmailCommand(adminEmailParams));

    // Return a success response
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Failed to process subscription",
        success: false,
        error: error.message,
      }),
    };
  }
};
