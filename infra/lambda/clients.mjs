import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { SESClient } from '@aws-sdk/client-ses'

export const ddb = new DynamoDBClient({})
export const s3 = new S3Client({})
export const ses = new SESClient({})
