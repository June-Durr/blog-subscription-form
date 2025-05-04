provider "aws" {
  region = var.aws_region
}

# Lambda function
resource "aws_lambda_function" "subscription_lambda" {
  function_name    = "blogSubscriptionHandler"
  filename         = var.lambda_zip_file
  source_code_hash = filebase64sha256(var.lambda_zip_file)
  role             = aws_iam_role.lambda_role.arn
  handler          = "subscribeHandler.handler"
  runtime          = "nodejs16.x"
  timeout          = 10
  memory_size      = 128
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "blog-subscription-lambda-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Attach policies to IAM role
resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_ses" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSESFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB table
resource "aws_dynamodb_table" "subscription_table" {
  name           = "BlogSubscriptions"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "email"
  
  attribute {
    name = "email"
    type = "S"
  }
}

# API Gateway
resource "aws_api_gateway_rest_api" "subscription_api" {
  name        = "BlogSubscriptionAPI"
  description = "API for handling blog subscription form submissions"
}

resource "aws_api_gateway_resource" "subscription_resource" {
  rest_api_id = aws_api_gateway_rest_api.subscription_api.id
  parent_id   = aws_api_gateway_rest_api.subscription_api.root_resource_id
  path_part   = "subscribe"
}

resource "aws_api_gateway_method" "subscription_method" {
  rest_api_id   = aws_api_gateway_rest_api.subscription_api.id
  resource_id   = aws_api_gateway_resource.subscription_resource.id
  http_method   = "POST"
  authorization_type = "NONE"
}

resource "aws_api_gateway_integration" "subscription_integration" {
  rest_api_id             = aws_api_gateway_rest_api.subscription_api.id
  resource_id             = aws_api_gateway_resource.subscription_resource.id
  http_method             = aws_api_gateway_method.subscription_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.subscription_lambda.invoke_arn
}

# Allow API Gateway to invoke Lambda
resource "aws_lambda_permission" "api_gateway_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.subscription_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.subscription_api.execution_arn}/*/*"
}

# Enable CORS for API Gateway
resource "aws_api_gateway_method" "options_method" {
  rest_api_id   = aws_api_gateway_rest_api.subscription_api.id
  resource_id   = aws_api_gateway_resource.subscription_resource.id
  http_method   = "OPTIONS"
  authorization_type = "NONE"
}

resource "aws_api_gateway_method_response" "options_200" {
  rest_api_id   = aws_api_gateway_rest_api.subscription_api.id
  resource_id   = aws_api_gateway_resource.subscription_resource.id
  http_method   = aws_api_gateway_method.options_method.http_method
  status_code   = "200"
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id   = aws_api_gateway_rest_api.subscription_api.id
  resource_id   = aws_api_gateway_resource.subscription_resource.id
  http_method   = aws_api_gateway_method.options_method.http_method
  type          = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration_response" "options_integration_response" {
  rest_api_id   = aws_api_gateway_rest_api.subscription_api.id
  resource_id   = aws_api_gateway_resource.subscription_resource.id
  http_method   = aws_api_gateway_method.options_method.http_method
  status_code   = aws_api_gateway_method_response.options_200.status_code
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Deployment
resource "aws_api_gateway_deployment" "subscription_deployment" {
  depends_on = [
    aws_api_gateway_integration.subscription_integration,
    aws_api_gateway_integration.options_integration
  ]
  
  rest_api_id = aws_api_gateway_rest_api.subscription_api.id
  stage_name  = "prod"
}

# Output the API URL
output "api_url" {
  value = "${aws_api_gateway_deployment.subscription_deployment.invoke_url}/subscribe"
}