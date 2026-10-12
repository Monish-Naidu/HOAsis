// The things that run: the web app, the self-hosted Supabase services and the
// five daily jobs. Deployed by scripts/azure/provision.sh after the platform
// exists and the first image is in the registry; redeployed by
// scripts/azure/deploy.sh with a new image tag.
//
// Every secret is a reference into Key Vault, read by the app identity at
// start; no secret value passes through this file or a parameter.

targetScope = 'resourceGroup'

param location string = resourceGroup().location
param baseName string = 'hoasis'

@description('Outputs of platform.bicep.')
param environmentName string
param keyVaultName string
param appIdentityName string
param acrLoginServer string
param storageAccountName string

@description('The web image, registry/repository:tag.')
param webImage string

@description('Run the Supabase services here (false while the database is still hosted by Supabase).')
param deploySupabaseStack bool = true

@description('"production" or "staging"; what the app and Sentry call this deployment.')
param appEnv string = 'staging'

// Public configuration of the web app. NEXT_PUBLIC_* values are also compiled
// into the browser bundle by deploy.sh, which reads them from this app.
// supabaseUrl is what the web app talks to: the hosted project until the data
// has moved, then stackUrl. stackUrl is the Supabase services app's own
// address, which its auth service needs to know regardless.
param supabaseUrl string
param stackUrl string = ''
param supabaseAnonKey string
param stripePublishableKey string = ''
param sentryDsn string = ''
param siteHost string = ''
param authCookieDomain string = ''
param emailFrom string = ''
param platformOwnerEmails string = ''
param testLogins string = ''

// The auth service, mirroring the hosted project's settings (docs/azure-migration-plan.md).
param gotrueSiteUrl string = 'https://yourhoasis.com'
param gotrueUriAllowList string = 'https://yourhoasis.com/**,https://www.yourhoasis.com/**,http://localhost:3000/**'
param smtpAdminEmail string = 'onboarding@resend.dev'
param smtpSenderName string = 'Your HOAsis'

var tags = { product: baseName, managedBy: 'bicep' }

resource env 'Microsoft.App/managedEnvironments@2024-03-01' existing = { name: environmentName }
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = { name: keyVaultName }
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: appIdentityName }
resource files 'Microsoft.Storage/storageAccounts@2023-05-01' existing = { name: storageAccountName }

var vault = kv.properties.vaultUri
var supabaseAppName = 'ca-${baseName}-supabase'
var webAppName = 'ca-${baseName}-web'

// A Key Vault reference for a Container Apps secret of the same name.
func kvSecret(vaultUri string, identityId string, name string) object => {
  name: name
  keyVaultUrl: '${vaultUri}secrets/${name}'
  identity: identityId
}

// ------------------------------------------------------------------- web

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: webAppName
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    managedEnvironmentId: env.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [ { server: acrLoginServer, identity: identity.id } ]
      secrets: [
        kvSecret(vault, identity.id, 'supabase-service-role-key')
        kvSecret(vault, identity.id, 'stripe-secret-key')
        kvSecret(vault, identity.id, 'stripe-webhook-secret')
        kvSecret(vault, identity.id, 'stripe-billing-webhook-secret')
        kvSecret(vault, identity.id, 'cron-secret')
        kvSecret(vault, identity.id, 'resend-api-key')
        kvSecret(vault, identity.id, 'email-token-secret')
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'APP_ENV', value: appEnv }
            { name: 'NEXT_PUBLIC_APP_ENV', value: appEnv }
            { name: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl }
            { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseAnonKey }
            { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', value: stripePublishableKey }
            { name: 'NEXT_PUBLIC_SENTRY_DSN', value: sentryDsn }
            { name: 'SENTRY_DSN', value: sentryDsn }
            { name: 'NEXT_PUBLIC_SITE_HOST', value: siteHost }
            { name: 'NEXT_PUBLIC_AUTH_COOKIE_DOMAIN', value: authCookieDomain }
            { name: 'NEXT_PUBLIC_TEST_LOGINS', value: testLogins }
            { name: 'EMAIL_FROM', value: emailFrom }
            { name: 'PLATFORM_OWNER_EMAILS', value: platformOwnerEmails }
            { name: 'SUPABASE_SERVICE_ROLE_KEY', secretRef: 'supabase-service-role-key' }
            { name: 'STRIPE_SECRET_KEY', secretRef: 'stripe-secret-key' }
            { name: 'STRIPE_WEBHOOK_SECRET', secretRef: 'stripe-webhook-secret' }
            { name: 'STRIPE_BILLING_WEBHOOK_SECRET', secretRef: 'stripe-billing-webhook-secret' }
            { name: 'CRON_SECRET', secretRef: 'cron-secret' }
            { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
            { name: 'EMAIL_TOKEN_SECRET', secretRef: 'email-token-secret' }
          ]
        }
      ]
      // One replica always on, so nobody waits on a cold start; idle replicas
      // bill at the reduced rate. Up to three under load.
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [ { name: 'http', http: { metadata: { concurrentRequests: '50' } } } ]
      }
    }
  }
}

// ------------------------------------------------------- supabase services

// One app, five containers sharing localhost: the gateway, auth (GoTrue),
// the data API (PostgREST), file storage and its S3-to-Blob proxy. They scale as one and there is
// one replica, which is what a hosted Supabase project gives too.
resource supabase 'Microsoft.App/containerApps@2024-03-01' = if (deploySupabaseStack) {
  name: supabaseAppName
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    managedEnvironmentId: env.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        { name: 'caddyfile', value: loadTextContent('supabase/Caddyfile') }
        kvSecret(vault, identity.id, 'jwt-secret')
        kvSecret(vault, identity.id, 'auth-db-url')
        kvSecret(vault, identity.id, 'rest-db-url')
        kvSecret(vault, identity.id, 'storage-db-url')
        kvSecret(vault, identity.id, 'resend-api-key')
        kvSecret(vault, identity.id, 'supabase-service-role-key')
        kvSecret(vault, identity.id, 's3proxy-secret')
        { name: 'blob-account-key', value: files.listKeys().keys[0].value }
      ]
    }
    template: {
      volumes: [
        { name: 'caddy-config', storageType: 'Secret', secrets: [ { secretRef: 'caddyfile', path: 'Caddyfile' } ] }
      ]
      containers: [
        {
          name: 'gateway'
          image: 'docker.io/library/caddy:2.10-alpine'
          resources: { cpu: json('0.1'), memory: '0.2Gi' }
          volumeMounts: [ { volumeName: 'caddy-config', mountPath: '/etc/caddy' } ]
        }
        {
          name: 'auth'
          image: 'docker.io/supabase/gotrue:v2.196.0'
          resources: { cpu: json('0.2'), memory: '0.4Gi' }
          env: [
            { name: 'GOTRUE_API_HOST', value: '0.0.0.0' }
            { name: 'GOTRUE_API_PORT', value: '9999' }
            { name: 'API_EXTERNAL_URL', value: '${stackUrl}/auth/v1' }
            { name: 'GOTRUE_DB_DRIVER', value: 'postgres' }
            { name: 'GOTRUE_DB_DATABASE_URL', secretRef: 'auth-db-url' }
            { name: 'GOTRUE_SITE_URL', value: gotrueSiteUrl }
            { name: 'GOTRUE_URI_ALLOW_LIST', value: gotrueUriAllowList }
            { name: 'GOTRUE_DISABLE_SIGNUP', value: 'false' }
            { name: 'GOTRUE_JWT_ADMIN_ROLES', value: 'service_role' }
            { name: 'GOTRUE_JWT_AUD', value: 'authenticated' }
            { name: 'GOTRUE_JWT_DEFAULT_GROUP_NAME', value: 'authenticated' }
            { name: 'GOTRUE_JWT_EXP', value: '3600' }
            { name: 'GOTRUE_JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'GOTRUE_JWT_ISSUER', value: '${stackUrl}/auth/v1' }
            { name: 'GOTRUE_EXTERNAL_EMAIL_ENABLED', value: 'true' }
            { name: 'GOTRUE_EXTERNAL_PHONE_ENABLED', value: 'false' }
            { name: 'GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED', value: 'false' }
            { name: 'GOTRUE_MAILER_AUTOCONFIRM', value: 'false' }
            { name: 'GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED', value: 'true' }
            { name: 'GOTRUE_MAILER_OTP_EXP', value: '86400' }
            { name: 'GOTRUE_MAILER_OTP_LENGTH', value: '8' }
            { name: 'GOTRUE_MAILER_URLPATHS_INVITE', value: '/auth/v1/verify' }
            { name: 'GOTRUE_MAILER_URLPATHS_CONFIRMATION', value: '/auth/v1/verify' }
            { name: 'GOTRUE_MAILER_URLPATHS_RECOVERY', value: '/auth/v1/verify' }
            { name: 'GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE', value: '/auth/v1/verify' }
            { name: 'GOTRUE_PASSWORD_MIN_LENGTH', value: '6' }
            { name: 'GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED', value: 'true' }
            { name: 'GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL', value: '10' }
            { name: 'GOTRUE_RATE_LIMIT_EMAIL_SENT', value: '100' }
            { name: 'GOTRUE_RATE_LIMIT_TOKEN_REFRESH', value: '150' }
            { name: 'GOTRUE_RATE_LIMIT_VERIFY', value: '30' }
            { name: 'GOTRUE_RATE_LIMIT_OTP', value: '30' }
            { name: 'GOTRUE_MFA_TOTP_ENROLL_ENABLED', value: 'true' }
            { name: 'GOTRUE_MFA_TOTP_VERIFY_ENABLED', value: 'true' }
            { name: 'GOTRUE_SMTP_HOST', value: 'smtp.resend.com' }
            { name: 'GOTRUE_SMTP_PORT', value: '465' }
            { name: 'GOTRUE_SMTP_USER', value: 'resend' }
            { name: 'GOTRUE_SMTP_PASS', secretRef: 'resend-api-key' }
            { name: 'GOTRUE_SMTP_ADMIN_EMAIL', value: smtpAdminEmail }
            { name: 'GOTRUE_SMTP_SENDER_NAME', value: smtpSenderName }
            { name: 'GOTRUE_SMTP_MAX_FREQUENCY', value: '60s' }
            { name: 'GOTRUE_DB_MAX_POOL_SIZE', value: '10' }
          ]
        }
        {
          name: 'rest'
          image: 'docker.io/postgrest/postgrest:v14.17'
          resources: { cpu: json('0.2'), memory: '0.4Gi' }
          env: [
            { name: 'PGRST_DB_URI', secretRef: 'rest-db-url' }
            { name: 'PGRST_DB_SCHEMAS', value: 'public' }
            { name: 'PGRST_DB_ANON_ROLE', value: 'anon' }
            { name: 'PGRST_DB_EXTRA_SEARCH_PATH', value: 'public,extensions' }
            { name: 'PGRST_DB_MAX_ROWS', value: '1000' }
            { name: 'PGRST_DB_POOL', value: '10' }
            { name: 'PGRST_DB_USE_LEGACY_GUCS', value: 'false' }
            { name: 'PGRST_JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'PGRST_APP_SETTINGS_JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'PGRST_APP_SETTINGS_JWT_EXP', value: '3600' }
            { name: 'PGRST_SERVER_PORT', value: '3000' }
          ]
        }
        {
          name: 'storage'
          image: 'docker.io/supabase/storage-api:v1.80.2'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'SERVER_PORT', value: '5000' }
            { name: 'ANON_KEY', value: supabaseAnonKey }
            { name: 'SERVICE_KEY', secretRef: 'supabase-service-role-key' }
            { name: 'AUTH_JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'AUTH_JWT_ALGORITHM', value: 'HS256' }
            { name: 'DATABASE_URL', secretRef: 'storage-db-url' }
            { name: 'DB_INSTALL_ROLES', value: 'false' }
            { name: 'POSTGREST_URL', value: 'http://localhost:3000' }
            { name: 'FILE_SIZE_LIMIT', value: '52428800' }
            // Files go to the blob container through the proxy on localhost.
            { name: 'STORAGE_BACKEND', value: 's3' }
            { name: 'GLOBAL_S3_BUCKET', value: 'supabase-storage' }
            { name: 'GLOBAL_S3_ENDPOINT', value: 'http://localhost:8080' }
            { name: 'GLOBAL_S3_PROTOCOL', value: 'http' }
            { name: 'GLOBAL_S3_FORCE_PATH_STYLE', value: 'true' }
            { name: 'AWS_ACCESS_KEY_ID', value: 'hoasis-storage' }
            { name: 'AWS_SECRET_ACCESS_KEY', secretRef: 's3proxy-secret' }
            { name: 'REGION', value: 'us-east-1' }
            { name: 'TENANT_ID', value: 'stub' }
            { name: 'ENABLE_IMAGE_TRANSFORMATION', value: 'false' }
            { name: 'REQUEST_ALLOW_X_FORWARDED_PATH', value: 'true' }
          ]
        }
        {
          // S3 in, Azure Blob out. The storage service speaks S3 or local
          // files and nothing else; this is the smallest honest bridge.
          name: 's3proxy'
          image: 'docker.io/andrewgaul/s3proxy:sha-f892634'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'S3PROXY_ENDPOINT', value: 'http://0.0.0.0:8080' }
            { name: 'S3PROXY_AUTHORIZATION', value: 'aws-v2-or-v4' }
            { name: 'S3PROXY_IDENTITY', value: 'hoasis-storage' }
            { name: 'S3PROXY_CREDENTIAL', secretRef: 's3proxy-secret' }
            { name: 'JCLOUDS_PROVIDER', value: 'azureblob' }
            { name: 'JCLOUDS_AZUREBLOB_AUTH', value: 'azureKey' }
            { name: 'JCLOUDS_IDENTITY', value: files.name }
            { name: 'JCLOUDS_CREDENTIAL', secretRef: 'blob-account-key' }
            { name: 'JCLOUDS_ENDPOINT', value: 'https://${files.name}.blob.${environment().suffixes.storage}' }
            { name: 'JCLOUDS_REGION', value: 'us-east-1' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}

// ------------------------------------------------------------------ jobs

// The same five calls vercel.json makes, at the same UTC minutes. A job is a
// curl with the cron secret; the route does the work and continues itself.
var crons = [
  { name: 'assessments', path: '/api/assessments/run', schedule: '0 13 * * *' }
  { name: 'bills', path: '/api/email/bills', schedule: '30 13 * * *' }
  { name: 'sweep', path: '/api/billing/sweep', schedule: '0 14 * * *' }
  { name: 'autopay', path: '/api/autopay/run', schedule: '30 14 * * *' }
  { name: 'digest', path: '/api/ops/digest', schedule: '0 15 * * *' }
]

resource jobs 'Microsoft.App/jobs@2024-03-01' = [
  for cron in crons: {
    name: 'caj-${baseName}-${cron.name}'
    location: location
    tags: tags
    identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
    properties: {
      environmentId: env.id
      workloadProfileName: 'Consumption'
      configuration: {
        triggerType: 'Schedule'
        scheduleTriggerConfig: { cronExpression: cron.schedule, parallelism: 1, replicaCompletionCount: 1 }
        replicaTimeout: 600
        replicaRetryLimit: 1
        secrets: [ kvSecret(vault, identity.id, 'cron-secret') ]
      }
      template: {
        containers: [
          {
            name: 'curl'
            image: 'docker.io/curlimages/curl:8.14.1'
            resources: { cpu: json('0.25'), memory: '0.5Gi' }
            command: [ '/bin/sh', '-c', 'curl -fsS --max-time 540 -H "Authorization: Bearer $CRON_SECRET" "$TARGET"' ]
            env: [
              { name: 'CRON_SECRET', secretRef: 'cron-secret' }
              { name: 'TARGET', value: 'https://${web.properties.configuration.ingress.fqdn}${cron.path}' }
            ]
          }
        ]
      }
    }
  }
]

output webFqdn string = web.properties.configuration.ingress.fqdn
output supabaseFqdn string = deploySupabaseStack ? supabase.properties.configuration.ingress.fqdn : ''
