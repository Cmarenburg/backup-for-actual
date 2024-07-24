# Download for Actual

### A web endpoint to ping to backup your Actual budget

This is a simple server, with exactly one get endpoint (`/`). When a request is received, a backup will be downloaded if the request passes authorization


Important env variables are 

|Item	|Desc   |Default|
|---	|---	|---	|
|AUTH_TOKEN   	|  API auth 	|   your_auth_token	|
|ACTUAL_INSTANCE_URL	|  instance url 	|   null	|
|  ACTUAL_INSTANCE_PASSWORD	|  instance pass 	|  null 	|
| ACTUAL_BUDGET_ID | Instance budget id | null |
| S3_REGION| S3 region | |
|S3_ACCESS_KEY_ID| S3 Access key  id| |
|S3_ECRET_ACCESS_KEY| Access key for S3 | |
|S3_BUCKET_NAME| S3 bucket name | |
|S3_ENDPOINT| S3 endpoint url  | |