import type { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import type { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb'
import type {
  ArrayField,
  BaseDatabaseAdapter,
  BlocksField,
  CheckboxField,
  CodeField,
  CollapsibleField,
  CollectionSlug,
  DateField,
  EmailField,
  Field,
  GlobalSlug,
  GroupField,
  JoinField,
  JSONField,
  NumberField,
  PointField,
  RadioField,
  RelationshipField,
  RichTextField,
  RowField,
  SanitizedConfig,
  SelectField,
  TabsField,
  TextareaField,
  TextField,
  UploadField,
} from 'payload'

/**
 * User-facing options for the `dynamoAdapter` factory.
 */
export type Args = {
  /**
   * Configuration passed straight through to `new DynamoDBClient(...)`.
   * Use this for region, credentials, endpoint (e.g. DynamoDB Local), retry
   * strategy, etc.
   */
  clientConfig?: DynamoDBClientConfig
  /**
   * Optional pre-built DynamoDB client. If supplied, `clientConfig` is ignored
   * and the adapter will not call `.destroy()` on shutdown — the caller owns
   * the client lifecycle.
   */
  client?: DynamoDBClient
  /**
   * Marshalling/unmarshalling options forwarded to
   * `DynamoDBDocumentClient.from(client, translateConfig)`.
   *
   * Defaults applied when omitted:
   *  - `removeUndefinedValues: true`
   *  - `convertClassInstanceToMap: true`
   */
  translateConfig?: TranslateConfig
  /**
   * Prefix prepended to every table name. Useful for multi-tenant or
   * multi-environment deployments (e.g. `staging_`, `prod_`).
   *
   * @default ''
   */
  tablePrefix?: string
  /**
   * Explicit table-name overrides per collection or global slug. When a slug
   * is not found here, the adapter falls back to `${tablePrefix}${slug}`.
   */
  tableNames?: Record<string, string>
  /**
   * Path to read and write migration files from.
   * @default 'migrations'
   */
  migrationDir?: string
  /**
   * If true, methods that mutate the schema (table creation, GSI updates) may
   * be invoked at init time. Disable this in production where infra is managed
   * out-of-band (CDK, Terraform, CloudFormation).
   *
   * @default false
   */
  ensureTables?: boolean
}

/**
 * The fully-resolved adapter instance, accessible as `payload.db` at runtime.
 *
 * Method implementations should be defined as `function` declarations (not
 * arrows) and may use `this: DynamoAdapter` to reach the live client and
 * resolved table-name map.
 */
export interface DynamoAdapter extends BaseDatabaseAdapter {
  /** Underlying low-level DynamoDB client. Populated by `connect`. */
  client: DynamoDBClient | undefined
  /** Document client wrapper around `client`. Populated by `connect`. */
  docClient: DynamoDBDocumentClient | undefined
  /** Original options passed to the factory. */
  clientConfig: DynamoDBClientConfig
  translateConfig: TranslateConfig
  /** True when the adapter constructed `client` itself and owns its lifecycle. */
  ownsClient: boolean
  tablePrefix: string
  tableNames: Record<string, string>
  ensureTables: boolean
  /** Resolve a collection or global slug to its physical table name. */
  resolveTableName: (slug: CollectionSlug | GlobalSlug | string) => string
  /**
   * Resolve a slug to its versions sibling table — `${baseTable}_versions`.
   * Always derived from `resolveTableName`, so explicit overrides set in
   * `tableNames` propagate (e.g. `auth_users` → `auth_users_versions`).
   */
  resolveVersionsTableName: (slug: CollectionSlug | GlobalSlug | string) => string
}

export type BuildSchemaOptions = {
  allowIDField?: boolean
  disableUnique?: boolean
  draftsEnabled?: boolean
  indexSortableFields?: boolean
}

export type FieldGenerator<TSchema, TField> = {
  config: SanitizedConfig
  field: TField
  options: BuildSchemaOptions
  schema: TSchema
}

export type FieldGeneratorFunction<TSchema, TField extends Field> = (
  args: FieldGenerator<TSchema, TField>,
) => void

export type FieldToSchemaMap<TSchema> = {
  array: FieldGeneratorFunction<TSchema, ArrayField>
  blocks: FieldGeneratorFunction<TSchema, BlocksField>
  checkbox: FieldGeneratorFunction<TSchema, CheckboxField>
  code: FieldGeneratorFunction<TSchema, CodeField>
  collapsible: FieldGeneratorFunction<TSchema, CollapsibleField>
  date: FieldGeneratorFunction<TSchema, DateField>
  email: FieldGeneratorFunction<TSchema, EmailField>
  group: FieldGeneratorFunction<TSchema, GroupField>
  join: FieldGeneratorFunction<TSchema, JoinField>
  json: FieldGeneratorFunction<TSchema, JSONField>
  number: FieldGeneratorFunction<TSchema, NumberField>
  point: FieldGeneratorFunction<TSchema, PointField>
  radio: FieldGeneratorFunction<TSchema, RadioField>
  relationship: FieldGeneratorFunction<TSchema, RelationshipField>
  richText: FieldGeneratorFunction<TSchema, RichTextField>
  row: FieldGeneratorFunction<TSchema, RowField>
  select: FieldGeneratorFunction<TSchema, SelectField>
  tabs: FieldGeneratorFunction<TSchema, TabsField>
  text: FieldGeneratorFunction<TSchema, TextField>
  textarea: FieldGeneratorFunction<TSchema, TextareaField>
  upload: FieldGeneratorFunction<TSchema, UploadField>
}
