// aws-setup.js
const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  SESClient,
  VerifyEmailIdentityCommand,
} = require("@aws-sdk/client-ses");
require("dotenv").config();

const region = process.env.AWS_REGION || "us-east-1";
const adminEmail = process.env.ADMIN_EMAIL || "admin@yourdomain.com";
const fromEmail = process.env.FROM_EMAIL || "noreply@yourdomain.com";

// Initialize AWS clients
const dynamoDb = new DynamoDBClient({ region });
const ses = new SESClient({ region });

async function createDynamoDBTable() {
  const params = {
    TableName: "BlogSubscriptions",
    KeySchema: [
      { AttributeName: "email", KeyType: "HASH" }, // Partition key
    ],
    AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    const data = await dynamoDb.send(new CreateTableCommand(params));
    console.log("DynamoDB table created successfully:", data);
    return data;
  } catch (error) {
    if (error.name === "ResourceInUseException") {
      console.log("Table already exists");
    } else {
      console.error("Error creating DynamoDB table:", error);
      throw error;
    }
  }
}

async function verifySESEmail(email) {
  const params = {
    EmailAddress: email,
  };

  try {
    const data = await ses.send(new VerifyEmailIdentityCommand(params));
    console.log(`Verification email sent to ${email}:`, data);
    return data;
  } catch (error) {
    console.error(`Error verifying email ${email}:`, error);
    throw error;
  }
}

async function setupAWS() {
  try {
    console.log("Setting up AWS resources...");

    // Create DynamoDB table
    await createDynamoDBTable();

    // Verify SES email identities
    await verifySESEmail(adminEmail);
    await verifySESEmail(fromEmail);

    console.log("AWS setup completed successfully!");
    console.log(
      "IMPORTANT: Check your email inbox and confirm the SES email verification requests."
    );
  } catch (error) {
    console.error("AWS setup failed:", error);
  }
}

setupAWS();
