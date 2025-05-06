// deploy-lambda.js
const {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
} = require("@aws-sdk/client-lambda");
const {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
} = require("@aws-sdk/client-iam");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
require("dotenv").config();

const region = process.env.AWS_REGION || "us-east-1";
const lambdaClient = new LambdaClient({ region });
const iamClient = new IAMClient({ region });

const LAMBDA_FUNCTION_NAME = "blogSubscriptionHandler";
const LAMBDA_ROLE_NAME = "blog-subscription-lambda-role";
const LAMBDA_POLICY_DOCUMENT = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: {
        Service: "lambda.amazonaws.com",
      },
      Action: "sts:AssumeRole",
    },
  ],
});

// Required policies for our Lambda function
const REQUIRED_POLICIES = [
  "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
  "arn:aws:iam::aws:policy/AmazonSESFullAccess",
  "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
];

async function createZipFile() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(
      path.join(__dirname, "lambda-function.zip")
    );
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", () => {
      console.log(`Zip file created: ${archive.pointer()} total bytes`);
      resolve(fs.readFileSync(path.join(__dirname, "lambda-function.zip")));
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add the Lambda handler file
    const handlerPath = path.join(__dirname, "lambda", "subscribeHandler.js");

    if (fs.existsSync(handlerPath)) {
      console.log(`Using existing handler file at ${handlerPath}`);
      archive.file(handlerPath, { name: "subscribeHandler.js" });
    } else {
      console.log(`Creating basic handler file at ${handlerPath}`);
      // Make sure the directory exists
      if (!fs.existsSync(path.dirname(handlerPath))) {
        fs.mkdirSync(path.dirname(handlerPath), { recursive: true });
      }

      // Create a basic Lambda function with proper CORS headers
      const basicHandler = `
const AWS = require('aws-sdk');

// Initialize AWS clients
const dynamoDb = new AWS.DynamoDB({ region: "us-east-1" });
const ses = new AWS.SES({ region: "us-east-1" });

// Email addresses - replace with your real email addresses
const ADMIN_EMAIL = "alberto.camachor01@gmail.com";
const FROM_EMAIL = "alberto.camachor01@gmail.com";

exports.handler = async (event) => {
  // Set up CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "https://musical-salamander-b30b3a.netlify.app",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Credentials": true
  };

  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ message: 'CORS preflight response' })
    };
  }

  try {
    // Log the entire event for debugging
    console.log("Received event:", JSON.stringify(event, null, 2));
    
    // Check if event.body exists
    if (!event.body) {
      console.error("Event body is undefined or null");
      throw new Error("Event body is missing");
    }
    
    // Parse the incoming request body
    let body;
    try {
      body = JSON.parse(event.body);
      console.log("Parsed body:", JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error("Failed to parse event body:", event.body);
      throw new Error(\`Invalid JSON in request body: \${parseError.message}\`);
    }
    
    const { name, email, phone, package: selectedPackage } = body;

    // Validate required fields
    if (!name || !email || !phone || !selectedPackage) {
      console.error("Missing required fields in request body");
      throw new Error("Missing required fields: name, email, phone, and package are required");
    }

    console.log("Processing form submission:", { name, email, phone, package: selectedPackage });

    const timestamp = new Date().toISOString();

    // Store data in DynamoDB
    const dynamoParams = {
      TableName: "BlogSubscriptions",
      Item: {
        email: { S: email },
        name: { S: name },
        phone: { S: phone },
        package: { S: selectedPackage },
        subscriptionDate: { S: timestamp }
      }
    };

    console.log("Storing data in DynamoDB...");
    await dynamoDb.putItem(dynamoParams).promise();
    console.log("Data stored successfully");

    // Send confirmation email to the user
    const userEmailParams = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: \`
              <html>
                <body>
                  <h1>Thank You for Subscribing!</h1>
                  <p>Hello \${name},</p>
                  <p>Thank you for subscribing to our blog. You've selected the \${selectedPackage} package.</p>
                  <p>We'll keep you updated with our latest content and news.</p>
                  <p>Best regards,<br>Your Blog Team</p>
                </body>
              </html>
            \`
          }
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Thanks for Subscribing to Our Blog!"
        }
      },
      Source: FROM_EMAIL
    };

    console.log("Sending confirmation email to user...");
    await ses.sendEmail(userEmailParams).promise();
    console.log("User email sent successfully");

    // Send notification email to admin
    const adminEmailParams = {
      Destination: {
        ToAddresses: [ADMIN_EMAIL]
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: \`
              <html>
                <body>
                  <h1>New Blog Subscription</h1>
                  <p>A new user has subscribed to the blog:</p>
                  <ul>
                    <li><strong>Name:</strong> \${name}</li>
                    <li><strong>Email:</strong> \${email}</li>
                    <li><strong>Phone:</strong> \${phone}</li>
                    <li><strong>Package:</strong> \${selectedPackage}</li>
                    <li><strong>Date:</strong> \${timestamp}</li>
                  </ul>
                </body>
              </html>
            \`
          }
        },
        Subject: {
          Charset: "UTF-8",
          Data: "New Blog Subscription"
        }
      },
      Source: FROM_EMAIL
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
        success: true
      })
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
        error: error.message
      })
    };
  }
};
      `;

      fs.writeFileSync(handlerPath, basicHandler);
      archive.file(handlerPath, { name: "subscribeHandler.js" });
    }

    // Add the entire node_modules/aws-sdk directory
    const awsSdkPath = path.join(__dirname, "node_modules", "aws-sdk");
    if (fs.existsSync(awsSdkPath)) {
      archive.directory(awsSdkPath, "node_modules/aws-sdk");
    } else {
      console.warn("aws-sdk module not found in node_modules");
    }

    archive.finalize();
  });
}

// Create IAM role for Lambda
async function createLambdaRole() {
  try {
    // Check if the role already exists
    try {
      const getRoleParams = { RoleName: LAMBDA_ROLE_NAME };
      const roleData = await iamClient.send(new GetRoleCommand(getRoleParams));
      console.log("Retrieved existing role:", roleData.Role.Arn);
      return roleData.Role.Arn;
    } catch (error) {
      if (error.name !== "NoSuchEntity") {
        throw error;
      }

      // Role doesn't exist, create it
      console.log(`Creating IAM role: ${LAMBDA_ROLE_NAME}`);
      const createRoleParams = {
        RoleName: LAMBDA_ROLE_NAME,
        AssumeRolePolicyDocument: LAMBDA_POLICY_DOCUMENT,
      };

      const roleData = await iamClient.send(
        new CreateRoleCommand(createRoleParams)
      );
      console.log("Lambda role created:", roleData.Role.Arn);

      // Attach policies to the role
      for (const policyArn of REQUIRED_POLICIES) {
        const attachPolicyParams = {
          RoleName: LAMBDA_ROLE_NAME,
          PolicyArn: policyArn,
        };

        await iamClient.send(new AttachRolePolicyCommand(attachPolicyParams));
        console.log(`Policy ${policyArn} attached to role`);
      }

      // Wait for role propagation
      console.log("Waiting for role propagation (15 seconds)...");
      await new Promise((resolve) => setTimeout(resolve, 15000));

      return roleData.Role.Arn;
    }
  } catch (error) {
    console.error("Error with IAM role:", error);
    throw error;
  }
}

// Deploy Lambda function
async function deployLambda() {
  try {
    console.log("Starting Lambda deployment...");

    // Create IAM role
    const roleArn = await createLambdaRole();

    // Create ZIP file
    const zipFile = await createZipFile();

    // Try to get existing function
    try {
      // Function exists, update it
      console.log(`Updating existing Lambda function: ${LAMBDA_FUNCTION_NAME}`);
      const updateParams = {
        FunctionName: LAMBDA_FUNCTION_NAME,
        ZipFile: zipFile,
      };

      const updateResult = await lambdaClient.send(
        new UpdateFunctionCodeCommand(updateParams)
      );
      console.log("Lambda function updated:", updateResult.FunctionArn);
    } catch (error) {
      if (error.name !== "ResourceNotFoundException") {
        throw error;
      }

      // Function doesn't exist, create it
      console.log(`Creating new Lambda function: ${LAMBDA_FUNCTION_NAME}`);
      const createParams = {
        FunctionName: LAMBDA_FUNCTION_NAME,
        Runtime: "nodejs16.x",
        Role: roleArn,
        Handler: "subscribeHandler.handler",
        Code: {
          ZipFile: zipFile,
        },
        Description: "Handles blog subscription form submissions",
        Timeout: 10,
        MemorySize: 128,
      };

      const createResult = await lambdaClient.send(
        new CreateFunctionCommand(createParams)
      );
      console.log("Lambda function created:", createResult.FunctionArn);
    }

    console.log("Lambda deployment completed successfully!");
  } catch (error) {
    console.error("Lambda deployment failed:", error);
  }
}

deployLambda();
