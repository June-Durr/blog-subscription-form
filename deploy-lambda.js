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

// Create a zip file of the Lambda function
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
      archive.file(handlerPath, { name: "subscribeHandler.js" });
    } else {
      console.error(`Handler file not found at ${handlerPath}`);
      // Create directories if they don't exist
      if (!fs.existsSync(path.join(__dirname, "lambda"))) {
        fs.mkdirSync(path.join(__dirname, "lambda"), { recursive: true });
      }

      // Create a basic handler file
      const basicHandler = `
exports.handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Lambda!' }),
  };
};
      `;
      fs.writeFileSync(handlerPath, basicHandler);
      archive.file(handlerPath, { name: "subscribeHandler.js" });
    }

    // Add the required AWS SDK dependencies
    const nodePath = path.join(__dirname, "node_modules");
    if (fs.existsSync(nodePath)) {
      // Only add the necessary AWS SDK files for DynamoDB and SES
      const awsPaths = ["@aws-sdk/client-dynamodb", "@aws-sdk/client-ses"];

      awsPaths.forEach((awsPath) => {
        const fullPath = path.join(nodePath, awsPath);
        if (fs.existsSync(fullPath)) {
          archive.directory(fullPath, `node_modules/${awsPath}`);
        }
      });
    }

    archive.finalize();
  });
}

// Create IAM role for Lambda
async function createLambdaRole() {
  try {
    // Create the role
    console.log(`Creating IAM role: ${LAMBDA_ROLE_NAME}`);

    const createRoleParams = {
      RoleName: LAMBDA_ROLE_NAME,
      AssumeRolePolicyDocument: LAMBDA_POLICY_DOCUMENT,
    };

    // Try to create the role
    try {
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
    } catch (error) {
      // If role already exists, try to get it
      if (error.name === "EntityAlreadyExistsException") {
        console.log("Role already exists, retrieving it...");
        const getRoleParams = { RoleName: LAMBDA_ROLE_NAME };
        const roleData = await iamClient.send(
          new GetRoleCommand(getRoleParams)
        );
        console.log("Retrieved existing role:", roleData.Role.Arn);
        return roleData.Role.Arn;
      } else {
        throw error;
      }
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
