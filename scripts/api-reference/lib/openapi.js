// Converts the upstream gRPC-gateway Swagger 2.0 spec to OpenAPI 3.0 and joins
// it to the descriptor.
//
// The join is keyed on (verb, normalized path) taken from each method's
// [google.api.http] annotation. Upstream's operationIds are display names that
// its merge step rewrites to avoid collisions in a single document (bank's
// Params becomes BankParams), so they identify a page, not a method. Using them
// as an identity mapping would attribute methods to names no node serves.

import { convertObj } from 'swagger2openapi';
import { moduleOf, normalizeHttpPath } from './descriptor.js';

export class JoinError extends Error {}

const HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete'];

// `cosmos.gov.v1beta1` yields `v1beta1`. Packages that carry no version segment
// fall back to their last segment, which is still stable per service.
function packageVersion(pkg) {
  const last = pkg.split('.').pop();
  return last ?? pkg;
}

function pathKey(verb, path) {
  return `${verb.toLowerCase()} ${normalizeHttpPath(path)}`;
}

// `/cosmos/bank/v1beta1/balances/{address}` belongs to bank. The path mirrors
// the proto package, so the module falls out of the second segment either way.
function moduleFromPath(path) {
  const segments = path.split('/').filter(Boolean);
  return segments.length > 1 ? segments[1] : segments[0] ?? 'other';
}

export async function convertToOpenApi3(swagger) {
  const { openapi } = await convertObj(swagger, {
    patch: true,
    warnOnly: true,
    refSiblings: 'preserve',
  });
  return openapi;
}

// Every descriptor method that upstream bound to an HTTP route, keyed for the
// join. A duplicate key means two methods claim one route, which would make the
// cross-links ambiguous in a way no downstream check would catch.
function indexAnnotatedMethods(modules) {
  const byRoute = new Map();
  const collisions = [];

  for (const module of modules) {
    for (const service of module.services) {
      for (const method of service.methods) {
        if (!method.http) continue;
        const key = pathKey(method.http.verb, method.http.path);
        if (byRoute.has(key)) {
          collisions.push({ key, methods: [byRoute.get(key).fullName, method.fullName] });
          continue;
        }
        byRoute.set(key, { ...method, module: module.name, service });
      }
    }
  }

  return { byRoute, collisions };
}

export function joinSpecToDescriptor(spec, modules, { grpcPagePath, headings }) {
  const { byRoute, collisions } = indexAnnotatedMethods(modules);
  const problems = [];
  const matched = new Set();
  const operationIds = new Map();
  const tags = new Set();

  for (const collision of collisions) {
    problems.push(
      `two methods bind the same route ${collision.key}: ${collision.methods.join(' and ')}`,
    );
  }

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const verb of HTTP_VERBS) {
      const operation = pathItem[verb];
      if (!operation) continue;

      const key = pathKey(verb, path);
      const method = byRoute.get(key);

      if (!method) {
        problems.push(`REST operation ${key} has no descriptor method bound to it`);
        continue;
      }

      matched.add(key);

      // Upstream's operationIds come from a merge step that renames methods to
      // avoid collisions, and it gets them wrong: gov v1 assigns GovV1Proposal
      // to both /proposals and /proposals/{proposalId}. Mintlify derives page
      // slugs from these, so a collision silently drops an endpoint. Deriving
      // them from the descriptor removes the dependency on that rename map.
      //
      // The package version is part of the id because gov ships v1 and v1beta1
      // side by side with identical method names. The uniqueness check below
      // still runs: this shape is readable rather than provably unique, so a
      // future collision fails the build instead of losing a page.
      operation.operationId = `${method.module}_${packageVersion(method.service.package)}_${method.name}`;
      if (operationIds.has(operation.operationId)) {
        problems.push(
          `duplicate operationId ${operation.operationId} on ${verb} ${path} and ${operationIds.get(operation.operationId)}`,
        );
      }
      operationIds.set(operation.operationId, `${verb} ${path}`);

      const module = moduleFromPath(path);
      tags.add(module);
      operation.tags = [module];

      // OpenAPI expects `summary` to be a short label and `description` to hold
      // the prose. Upstream puts the entire proto comment in `summary`, and
      // Mintlify builds each page's filename from it, which overruns the
      // filesystem name limit on long comments such as upgrade's
      // UpgradedConsensusState. Using the method name keeps page slugs short,
      // stable and meaningful, and the prose moves where it belongs.
      const heading = headings.get(`${method.service.fullName}/${method.name}`);

      const upstreamSummary = operation.summary?.trim();
      // The summary becomes the sidebar label and the page slug. gov lists two
      // identical sets of eight entries otherwise, differing only by a URL
      // suffix the reader never sees, while behaving differently.
      operation.summary = heading?.label ?? method.name;
      if (upstreamSummary) {
        operation.description = operation.description
          ? `${upstreamSummary}\n\n${operation.description}`
          : upstreamSummary;
      }

      const link = `${grpcPagePath}/${method.module}#${heading?.anchor ?? method.name.toLowerCase()}`;
      const prefix = `gRPC: \`${method.service.fullName}/${method.name}\` ([reference](${link}))`;
      operation.description = operation.description
        ? `${prefix}\n\n${operation.description}`
        : prefix;
      operation['x-grpc-method'] = `${method.service.fullName}/${method.name}`;
    }
  }

  // Upstream builds its spec by merging a fixed list of per-module files in
  // client/docs/config.json, which omits the reflection, autocli and app
  // services. Their HTTP annotations are real and the routes work on a node,
  // but no REST page can be generated for them, so the gRPC page shows the path
  // without a link. That is a property of upstream's build, not a disagreement,
  // so it is reported rather than fatal.
  const unrepresented = [];
  for (const [key, method] of byRoute) {
    if (!matched.has(key)) unrepresented.push(`${method.fullName} (${key})`);
  }

  spec.tags = [...tags].sort().map((name) => ({ name }));
  return { spec, problems, unrepresented, routesByMethod: byRoute };
}

/**
 * OpenAPI considers two paths identical when they differ only in the names of
 * their template variables, and forbids both from appearing in one document.
 * Upstream's generated spec violates this: auth binds
 * `bech32/{address_bytes}` and `bech32/{address_string}`, which collapse to the
 * same template.
 *
 * Keeping both produces a spec that fails validation and that Mintlify resolves
 * by silently dropping one page. Dropping them here instead, and reporting
 * exactly what was dropped, keeps the loss visible. The methods themselves stay
 * documented on the module's gRPC page, and the routes still work on a node.
 */
export function dropIdenticalPathTemplates(spec) {
  const byShape = new Map();
  for (const routePath of Object.keys(spec.paths)) {
    const shape = routePath.replace(/\{[^}]+\}/g, '{}');
    if (!byShape.has(shape)) byShape.set(shape, []);
    byShape.get(shape).push(routePath);
  }

  const dropped = [];
  for (const paths of byShape.values()) {
    if (paths.length < 2) continue;
    // Sorted so the survivor does not depend on object key order.
    const [, ...rest] = [...paths].sort();
    for (const routePath of rest) {
      dropped.push(routePath);
      delete spec.paths[routePath];
    }
  }

  return { spec, dropped };
}

/**
 * Rewrites schema property names from protobuf JSON names to proto field names.
 *
 * Upstream generates the spec with json_names_for_fields on, so it documents
 * `nextKey`, `operatorAddress`, `delegatorShares`. The SDK's gateway marshals
 * with the original names, so every real response uses `next_key`,
 * `operator_address`, `delegator_shares`. A client written against the spec
 * reads undefined from every field.
 *
 * The mapping is taken from the descriptor rather than by converting case, so
 * a field whose proto name genuinely is camelCase is left alone. jsonName is a
 * deterministic function of the proto name, so the inverse is unambiguous.
 */
export function useProtoFieldNames(spec, types) {
  const protoName = new Map();
  for (const message of types.messages.values()) {
    for (const field of message.fields) {
      if (field.jsonName && field.jsonName !== field.name) {
        protoName.set(field.jsonName, field.name);
      }
    }
  }

  let renamed = 0;
  const rename = (key) =>
    key
      .split('.')
      .map((part) => protoName.get(part) ?? part)
      .join('.');

  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;

    if (node.properties && typeof node.properties === 'object') {
      const next = {};
      for (const [key, value] of Object.entries(node.properties)) {
        const to = rename(key);
        if (to !== key) renamed += 1;
        next[to] = value;
      }
      node.properties = next;
    }
    if (Array.isArray(node.required)) node.required = node.required.map(rename);

    for (const value of Object.values(node)) walk(value);
  };

  // Schemas only. Parameter names are left alone: a path parameter has to keep
  // matching its path template, and grpc-gateway accepts either spelling for a
  // query parameter, so renaming those would risk breaking working requests to
  // fix nothing a reader can see.
  walk(spec.components ?? {});
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== 'object') continue;
      walk(operation.responses ?? {});
      walk(operation.requestBody ?? {});
    }
  }

  return { spec, renamed };
}

/**
 * Marks properties the gateway can return as null.
 *
 * proto3 has no null, but the REST gateway emits `null` for an unset
 * message-typed field and for empty `bytes`: an absent `pagination.next_key`
 * comes back as null, not "". A schema declaring `type: string` therefore
 * disagrees with real responses, and a generated client typed from it breaks on
 * the first empty page.
 *
 * Derived per field from the descriptor rather than applied blanket, so scalars
 * that genuinely never arrive as null keep their stricter type.
 */
/**
 * Applies the two schema corrections to an operation's inlined response.
 *
 * Upstream inlines response schemas per operation rather than referencing
 * components, so corrections applied to components/schemas never reach the
 * document a validator actually checks against. Pairing the inline schema with
 * the method's output message lets both corrections land where they matter.
 */
function correctInlineSchema(raw, message, types, counts, seen = new Set(), spec = null) {
  const schema = spec ? resolveRef(raw, spec) : raw;
  if (!schema || !message || typeof schema !== 'object') return;
  if (schema.type === 'array') {
    return correctInlineSchema(schema.items, message, types, counts, seen, spec);
  }
  if (!schema.properties) return;

  const key = `${message.fullName}`;
  if (seen.has(key)) return;
  const next = new Set(seen).add(key);

  let carriesAny = false;
  for (const field of message.fields) {
    const property = schema.properties[field.name];
    if (field.typeName === 'google.protobuf.Any') carriesAny = true;
    if (!property) continue;

    if ((field.type === 'bytes' || (!field.type && field.typeName)) && property.nullable !== true) {
      property.nullable = true;
      counts.marked += 1;
    }

    const nested = field.typeName ? types.messages.get(field.typeName) : null;
    if (nested) correctInlineSchema(property, nested, types, counts, next, spec);
  }

  if (!carriesAny && schema.additionalProperties === undefined) {
    schema.additionalProperties = false;
    counts.strict += 1;
  }
}

/**
 * Reports response fields the protos define and upstream's spec omits.
 *
 * The swagger is generated separately from the protos and lags them, so a new
 * SDK version can add a field the chain returns and the spec never mentions.
 * v0.55 added `key_rotation_fee` to staking params exactly this way, and only a
 * live conformance run against a node surfaced it.
 *
 * Comparing the inline schema against its own message finds the same gap at
 * generation time, with no chain and no network. It warns rather than fails:
 * upstream lagging is normal and should not block a docs build.
 */
// Four of the 108 operations reference a component instead of inlining their
// response. A correction that only walks inline schemas silently skips those.
function resolveRef(schema, spec) {
  if (!schema?.$ref) return schema;
  const name = schema.$ref.replace('#/components/schemas/', '');
  return spec.components?.schemas?.[name] ?? schema;
}

export function findSchemaDrift(spec, types, methodsByOperation) {
  const drift = [];

  const walk = (raw, message, path, seen) => {
    const schema = resolveRef(raw, spec);
    if (!schema?.properties || !message || seen.has(message.fullName)) return;
    // An Any is inlined with @type in JSON, so its type_url and value fields
    // are correctly absent from the schema and are not drift.
    if (message.fullName === 'google.protobuf.Any') return;
    const next = new Set(seen).add(message.fullName);

    for (const field of message.fields) {
      if (!(field.name in schema.properties)) {
        drift.push(`${path}.${field.name}`);
        continue;
      }
      const nested = field.typeName ? types.messages.get(field.typeName) : null;
      const property = schema.properties[field.name];
      const resolved = resolveRef(property, spec);
      const target = resolved?.type === 'array' ? resolved.items : resolved;
      if (nested) walk(target, nested, `${path}.${field.name}`, next);
    }
  };

  for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== 'object') continue;
      const outputType = methodsByOperation.get(operation['x-grpc-method']);
      const message = outputType ? types.messages.get(outputType) : null;
      const schema = Object.values(operation.responses?.['200']?.content ?? {})[0]?.schema;
      if (message && schema) walk(schema, message, routePath, new Set());
    }
  }

  return drift;
}

export function correctResponseSchemas(spec, types, methodsByOperation) {
  const counts = { marked: 0, strict: 0 };

  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== 'object') continue;
      const outputType = methodsByOperation.get(operation['x-grpc-method']);
      const message = outputType ? types.messages.get(outputType) : null;
      // Upstream declares the response under `*/*`, not application/json, so
      // take whichever media type is present rather than assuming one.
      const content = operation.responses?.['200']?.content ?? {};
      const schema = Object.values(content)[0]?.schema;
      if (message && schema) correctInlineSchema(schema, message, types, counts, new Set(), spec);
    }
  }

  return { spec, ...counts };
}

export function allowGatewayNulls(spec, types) {
  let marked = 0;

  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    const message = types.messages.get(name);
    if (!message || !schema?.properties) continue;

    for (const field of message.fields) {
      const property = schema.properties[field.name];
      if (!property) continue;
      const nullable = field.type === 'bytes' || (!field.type && field.typeName);
      if (nullable && property.nullable !== true) {
        property.nullable = true;
        marked += 1;
      }
    }
  }

  return { spec, marked };
}

export function applyServers(spec) {
  // No public chain runs the SDK version these pages document, and no live call
  // is made at generation time: a build-time request to a third party would
  // make the output nondeterministic and break the regeneration check.
  spec.servers = [
    {
      url: 'https://cosmos-rest.publicnode.com',
      description:
        'Community-run public endpoint serving Cosmos Hub. Not operated by the Cosmos SDK team, and running a different SDK version than these pages document. Endpoints for modules the chain does not include return 501.',
    },
    {
      url: 'http://localhost:1317',
      description: 'Your own node. Requires api.enable in app.toml.',
    },
  ];
  return spec;
}

export function applyInfo(spec, context) {
  spec.info = {
    ...spec.info,
    title: 'Cosmos SDK REST API',
    description: [
      `HTTP bindings for the gRPC query services of the standard Cosmos SDK modules, documenting Cosmos SDK ${context.displayVersion}.`,
      '',
      `Generated from ${context.repository} at commit ${context.sha} on ref \`${context.ref}\`.`,
      '',
      'A chain exposes only the modules its application registers, so it may serve a subset of these routes alongside routes of its own.',
    ].join('\n'),
    version: context.displayVersion,
  };
  return spec;
}

export { moduleFromPath, pathKey };

/**
 * Declares that documented schemas list every field a response can contain.
 *
 * Without this, a response validator has almost nothing to check: proto3 omits
 * defaults so nothing can be marked `required`, and JSON Schema allows unknown
 * properties by default. A response whose field names differ entirely from the
 * schema still validates. That is exactly how the camelCase defect would have
 * survived contract testing.
 *
 * Setting additionalProperties false makes an undeclared field an error, which
 * is the one direction we can assert: the gateway returning `next_key` where the
 * schema declares `nextKey` becomes a failure rather than a silent pass.
 *
 * Schemas reachable from a google.protobuf.Any are exempt, because an Any
 * legitimately inlines the fields of whatever concrete message it carries, and
 * no schema can enumerate those in advance.
 */
export function requireDeclaredFields(spec, types) {
  const carriesAny = new Set();

  const visit = (typeName, seen = new Set()) => {
    if (!typeName || seen.has(typeName)) return false;
    if (typeName === 'google.protobuf.Any') return true;
    const message = types.messages.get(typeName);
    if (!message) return false;

    const next = new Set(seen).add(typeName);
    const found = message.fields.some((f) => visit(f.typeName, next));
    if (found) carriesAny.add(typeName);
    return found;
  };
  for (const name of types.messages.keys()) visit(name);

  let strict = 0;
  let exempt = 0;
  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    if (!schema || schema.type === 'array' || !schema.properties) continue;
    if (name === 'google.protobuf.Any' || carriesAny.has(name)) {
      exempt += 1;
      continue;
    }
    schema.additionalProperties = false;
    strict += 1;
  }

  return { spec, strict, exempt };
}
