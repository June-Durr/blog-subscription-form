# Blog Subscription Form

A React application that collects user subscriptions through a form and processes them using AWS services (Lambda, DynamoDB, and SES).

## Features

- React-based form with validation
- AWS Lambda for serverless backend processing
- DynamoDB for storing subscription data
- AWS SES for sending confirmation emails
- Terraform for infrastructure management
- Netlify for frontend deployment

## Prerequisites

- Node.js (v14 or higher)
- AWS account with access credentials
- AWS CLI configured locally
- Terraform (optional, for infrastructure deployment)
- Netlify account (for deployment)

## Getting Started

### 1. Clone the repository

```bash
git clone [your-repo-url]
cd blog-subscription-form
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Update the `.env` file with your AWS credentials and settings:

```
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Email Configuration
ADMIN_EMAIL=admin@yourdomain.com
FROM_EMAIL=noreply@yourdomain.com

# API Configuration
REACT_APP_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod/subscribe
```

### 4. Run the application locally

```bash
npm run dev
```

This command will start both the React application and the Express server for local development.

## AWS Setup

### 1. Set up AWS resources

```bash
npm run setup-aws
```

This script will:
- Create a DynamoDB table for storing subscription data
- Set up SES for sending emails (requires verification)

⚠️ **Important**: After running this command, check your email inbox for SES verification emails and confirm them.

### 2. Deploy the Lambda function

```bash
npm run deploy-lambda
```

This will package and deploy the Lambda function to AWS.

### 3. Set up API Gateway (option 1: using Terraform)

If you're using Terraform:

```bash
cd terraform
terraform init
terraform apply
```

Note the API URL in the output and update your `.env` file.

### 4. Set up API Gateway (option 2: manually)

If you prefer to set up API Gateway manually:

1. Go to the AWS Management Console
2. Navigate to API Gateway
3. Create a new REST API
4. Create a resource with path `/subscribe`
5. Add a POST method that integrates with your Lambda function
6. Set up CORS
7. Deploy the API to a new stage (e.g., 'prod')
8. Update the `REACT_APP_API_URL` in your `.env` file

## Deployment to Netlify

### 1. Install Netlify CLI (if not already installed)

```bash
npm install -g netlify-cli
```

### 2. Build and deploy

```bash
npm run deploy
```

This will build the React application and deploy it to Netlify.

### 3. Alternative manual deployment

1. Build the project: `npm run build`
2. Drag and drop the `build` folder to Netlify
3. Configure environment variables in Netlify's dashboard

## Project Structure

```
blog-subscription-form/
├── public/                  # Public assets
├── src/
│   ├── components/          # React components
│   │   └── SubscriptionForm.js  # Form component
│   ├── App.js               # Main application component
│   └── index.js             # Entry point
├── lambda/                  # AWS Lambda function code
│   └── subscribeHandler.js  # Lambda handler
├── terraform/               # Terraform configuration
│   ├── main.tf              # Main Terraform configuration
│   └── variables.tf         # Terraform variables
├── .env                     # Environment variables
├── server.js                # Local development server
├── aws-setup.js             # AWS setup script
├── deploy-lambda.js         # Lambda deployment script
└── netlify.toml             # Netlify configuration
```

## Customization

- **Form Fields**: Edit `SubscriptionForm.js` to modify the form fields and validation.
- **Email Templates**: Update the HTML templates in `subscribeHandler.js` to customize the email content.
- **Styling**: Modify `App.css` to change the appearance of the form.

## License

[MIT](LICENSE)