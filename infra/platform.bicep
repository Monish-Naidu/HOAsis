// The platform: everything that holds state or identity and changes rarely.
// Deployed once by scripts/azure/provision.sh, into one resource group.
// Apps and jobs are in apps.bicep, deployed after the first image is built.
//
// Names follow the Azure naming abbreviations (rg-, cae-, ca-, caj-, cr, kv-,
// psql-, log-, id-, st). Globally unique names get a six character suffix
// derived from the resource group id, so a second provision of the same group
// finds the same resources.

targetScope = 'resourceGroup'

@description('Region. Visual Studio subscriptions are barred from Flexible Server in some regions (westus2 is one); provision.sh picks one that answers.')
param location string = resourceGroup().location

@description('Short product name used in every resource name.')
param baseName string = 'hoasis'

@secure()
@description('Password for the Postgres administrator, login name postgres.')
param postgresAdminPassword string

@description('Public IPv4 of the laptop running the migration, allowed through the Postgres firewall. Empty adds no rule.')
param clientIp string = ''

@description('Who gets the budget emails.')
param budgetEmail string

@description('Monthly spend, in dollars, at which the budget alerts fire in full. Under the $150 credit on purpose.')
param budgetAmount int = 120

@description('First day of the month the budget starts. Defaults to this month.')
param budgetStart string = '${utcNow('yyyy-MM')}-01T00:00:00Z'

@description('GitHub repository allowed to deploy, as owner/name.')
param githubRepo string = 'Monish-Naidu/HOAsis'

@description('Branch whose pushes may deploy.')
param githubBranch string = 'main'

var suffix = take(uniqueString(resourceGroup().id), 6)
var tags = { product: baseName, managedBy: 'bicep' }

// Built-in role ids.
var roleAcrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var roleAcrPush = '8311e382-0749-4cb8-b61a-304f252e45ec'
var roleKeyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var roleContributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

// ---------------------------------------------------------------- logging

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${baseName}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

// --------------------------------------------------------------- registry

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'cr${baseName}${suffix}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

// -------------------------------------------------------------- identities

// The identity the apps and jobs run as: pulls images, reads secrets.
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${baseName}-app'
  location: location
  tags: tags
}

// The identity GitHub Actions signs in as, with no stored secret: GitHub
// presents an OIDC token for the branch and Azure trusts it.
resource githubIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${baseName}-github'
  location: location
  tags: tags
}

resource githubFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: githubIdentity
  name: 'github-${githubBranch}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepo}:ref:refs/heads/${githubBranch}'
    audiences: [ 'api://AzureADTokenExchange' ]
  }
}

resource appAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, appIdentity.id, roleAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource githubAcrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, githubIdentity.id, roleAcrPush)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPush)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Contributor on the group lets the workflow update the Container App's image
// and run `az acr build`. It cannot grant roles or read secret values.
resource githubContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, githubIdentity.id, roleContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleContributor)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// -------------------------------------------------------------- key vault

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${baseName}-${suffix}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    // Off so a torn-down group can be provisioned again under the same name.
    enablePurgeProtection: null
    publicNetworkAccess: 'Enabled'
  }
}

resource appKvReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, appIdentity.id, roleKeyVaultSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsUser)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource pgAdminSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'pg-admin-password'
  properties: { value: postgresAdminPassword, contentType: 'login postgres' }
}

// --------------------------------------------------------------- postgres

// Burstable B1ms: one vCPU, 2 GiB, about $13 a month. The same Postgres 17
// the Supabase project runs. Public endpoint behind the firewall and TLS,
// which is how Supabase exposes it today; a private network is the next
// hardening step and is written up in docs/azure-migration-plan.md.
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'psql-${baseName}-${suffix}'
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '17'
    administratorLogin: 'postgres'
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: { passwordAuth: 'Enabled', activeDirectoryAuth: 'Disabled' }
  }
}

// 0.0.0.0 is Azure's "services inside Azure" rule; it is what lets the
// Container Apps reach the server without a static egress address.
resource pgAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: pg
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource pgAllowClient 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (clientIp != '') {
  parent: pg
  name: 'laptop'
  properties: { startIpAddress: clientIp, endIpAddress: clientIp }
}

// The allow list for CREATE EXTENSION. pgcrypto is the one the migrations use.
resource pgExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'azure.extensions'
  properties: { value: 'PGCRYPTO,UUID-OSSP,PG_STAT_STATEMENTS', source: 'user-override' }
  dependsOn: [ pgAllowAzure ]
}

// ---------------------------------------------------------- file storage

// Where the self-hosted storage service keeps uploaded files: a blob
// container, reached through an S3-compatible proxy beside the service
// (apps.bicep). Not an Azure Files share: the service's file backend keeps
// metadata in extended attributes, which SMB does not have.
resource files 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${baseName}${suffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: files
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 30 }
    containerDeleteRetentionPolicy: { enabled: true, days: 30 }
  }
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'supabase-storage'
  properties: { publicAccess: 'None' }
}

// ------------------------------------------------------- container apps env

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${baseName}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [ { name: 'Consumption', workloadProfileType: 'Consumption' } ]
    zoneRedundant: false
  }
}

// ----------------------------------------------------------------- budget

// The credit is $150 a month and the subscription stops everything when it
// is spent. Three emails on the way there.
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-${baseName}'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStart }
    notifications: {
      half: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [ budgetEmail ]
      }
      most: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [ budgetEmail ]
      }
      all: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [ budgetEmail ]
      }
    }
  }
}

// ---------------------------------------------------------------- outputs

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
output appIdentityName string = appIdentity.name
output githubClientId string = githubIdentity.properties.clientId
output postgresHost string = pg.properties.fullyQualifiedDomainName
output environmentName string = env.name
output environmentDomain string = env.properties.defaultDomain
output storageAccountName string = files.name
