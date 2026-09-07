Feature: Secure candidate submission handling
  The platform must accept candidate enquiries and CV uploads while protecting
  personal data, keeping uploaded files private, and giving admins enough
  information to manage submissions safely.

  Background:
    Given the admin API is protected by Cognito JWT authorization
    And the API is deployed with a stable base64 PII encryption key
    And the CV bucket is private

  Scenario: Store candidate PII encrypted while preserving operational metadata
    When a candidate submits their name, email address, phone number, role, company, job title, and message
    Then the DynamoDB record contains encrypted values for those PII fields
    And the record contains plaintext operational fields such as id, status, timestamps, and CV metadata
    And the record contains an email lookup hash instead of relying on plaintext email for lookup

  Scenario: Show decrypted candidate details to an authenticated admin
    Given a stored candidate record contains encrypted PII fields
    When an admin signs in through Cognito
    And the admin lists candidate submissions
    Then the API returns the candidate details in readable form
    And the API does not return encryption keys or password hashes

  Scenario: Reject admin access when the Cognito token is missing or invalid
    When an admin request has no valid Cognito token
    And the admin lists candidate submissions
    Then the API rejects the request
    And the Lambda does not handle the protected admin route

  Scenario: Require encrypted S3 uploads for CV files
    When the API creates a presigned CV upload URL
    Then the upload request requires server-side encryption with AES256
    And the bucket policy denies incoming CV uploads that omit the encryption header

  Scenario: Block CV downloads until malware scanning has passed
    Given a candidate has uploaded a CV
    And the malware scan status is not passed
    When an admin requests a CV download URL
    Then the API rejects the download request

  Scenario: Allow CV downloads after malware scanning has passed
    Given a candidate has uploaded a CV
    And the malware scan status is passed
    When an authenticated admin requests a CV download URL
    Then the API returns a short-lived presigned download URL

  Scenario: Permanently delete only cancelled or accepted candidate records
    Given a candidate record has been cancelled or accepted by an authenticated admin
    When an authenticated admin confirms permanent deletion
    Then the API deletes the DynamoDB record
    And the API deletes all versions of the attached private CV object when one exists
    But the API rejects deletion for active candidate records

  Scenario: Move an accepted candidate back into the potential pool
    Given a candidate record has been accepted by an authenticated admin
    When an authenticated admin moves the candidate back to the pool
    Then the API marks the candidate as potential
    And the API clears the approval timestamp

  Scenario: Escape candidate-provided content in notification emails
    When a candidate submits text containing HTML characters
    Then the notification email renders the submitted content as text
    And the notification email does not execute candidate-provided markup

  Scenario: Preserve legacy plaintext records during migration
    Given a candidate record was created before application-level encryption existed
    When an authenticated admin lists candidate submissions
    Then the API still returns the legacy candidate details
    And newly written sensitive fields use encrypted storage
