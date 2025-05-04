variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "lambda_zip_file" {
  description = "Path to the zip file containing the Lambda function code"
  type        = string
  default     = "../lambda-function.zip"
}