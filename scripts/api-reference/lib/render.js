// Renders one MDX page per module from the descriptor model.
//
// Queries and transaction messages are deliberately presented differently.
// A Msg service is registered into the MsgServiceRouter (baseapp/msg_service_router.go)
// and is consulted only during transaction delivery, so its methods are not
// reachable on the gRPC query server. Rendering them beside queries with a
// grpcurl example would teach an interaction model the SDK does not implement.

// A type outside the cosmos namespace is protobuf machinery or a vendored
// dependency: google.protobuf, gogoproto, amino, cosmos_proto, tendermint. Those
// are named in field tables but not documented as types of their own.
//
// This is the same namespace boundary the module scan uses, expressed as a rule
// rather than a list, so a dependency vendored in a future SDK version is
// excluded without anyone adding it here.
function isOpaque(typeName) {
  return !typeName.startsWith('cosmos.');
}

function titleCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Mintlify slugs a heading by lowercasing it and turning `.` into `-`. Headings
// use the fully qualified name because short names collide inside a module:
// gov ships QueryProposalRequest in both v1 and v1beta1.
function anchorFor(fullName) {
  return `#${fullName.toLowerCase().replace(/\./g, '-')}`;
}

/**
 * Proto comments are plain text, but MDX reads `{` as the start of an
 * expression and `<` as the start of a tag, and a page containing either fails
 * to compile rather than rendering them literally. The pagination comments in
 * cosmos/base/query/v1beta1 embed a proto snippet and hit exactly this.
 *
 * Escaping is skipped inside backtick spans, where MDX already treats both
 * characters as literal and a backslash would show up in the output.
 */
function looksLikeCode(paragraph) {
  return /\{/.test(paragraph) && /\}/.test(paragraph) && /[;=]/.test(paragraph);
}

function mdxSafe(text) {
  return (text ?? '')
    .split('\n\n')
    .map((paragraph) => {
      // Proto comments sometimes embed a snippet, as PageRequest does with
      // `message SomeRequest { ... }`. Escaping the braces makes it compile but
      // renders code as prose; inline code renders correctly and needs no
      // escaping, since MDX treats braces literally inside a code span.
      if (looksLikeCode(paragraph) && !paragraph.includes('`')) {
        return `\`${paragraph.trim()}\``;
      }
      return paragraph
        .split(/(`[^`]*`)/g)
        .map((part) => (part.startsWith('`') ? part : part.replace(/([<{}])/g, '\\$1')))
        .join('');
    })
    .join('\n\n');
}

function escapeCell(text) {
  return mdxSafe(text).replace(/\|/g, '\\|').replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim();
}

function shortName(fullName) {
  return fullName.split('.').pop();
}

function typeLabel(typeName, documentedTypes) {
  return documentedTypes.has(typeName)
    ? `[\`${shortName(typeName)}\`](${anchorFor(typeName)})`
    : `\`${shortName(typeName)}\``;
}

function fieldTypeCell(field, documentedTypes, types) {
  if (field.type) {
    return field.repeated ? `\`${field.type}\`[]` : `\`${field.type}\``;
  }
  if (!field.typeName) return '`unknown`';

  // A map<k,v> field compiles to a repeated synthetic entry message. Rendering
  // it as `MapEntry[]` would describe the compiler's output rather than the API.
  const referenced = types.messages.get(field.typeName);
  if (referenced?.isMapEntry) {
    const key = referenced.fields.find((f) => f.name === 'key');
    const value = referenced.fields.find((f) => f.name === 'value');
    const keyLabel = key?.type ?? shortName(key?.typeName ?? 'unknown');
    const valueLabel = value?.type ?? shortName(value?.typeName ?? 'unknown');
    return `\`map<${keyLabel}, ${valueLabel}>\``;
  }

  const base = typeLabel(field.typeName, documentedTypes);
  return field.repeated ? `${base}[]` : base;
}

/**
 * A cosmos.Dec reaches the wire in three different shapes, and the annotation
 * alone does not say which. The descriptor does: a LegacyDec custom type is
 * marshalled as an integer scaled by 10^18, a plain string field holds an
 * already-formatted decimal, and a bytes field carries base64 of the scaled
 * digits. Stating one blanket rule was wrong for whole modules and produced
 * answers out by 10^18 with no error.
 */
function decEncoding(field) {
  const scaled = field.customType?.endsWith('LegacyDec');
  const grpcForm = field.type === 'bytes'
    ? (scaled ? 'base64 of an integer string scaled by 10^18' : 'base64')
    : (scaled ? 'an integer string scaled by 10^18' : 'a decimal string');
  // The REST gateway installs the SDK's own marshaler, which renders every
  // cosmos.Dec as a plain decimal string whatever form it takes on the gRPC
  // wire. Stating only the gRPC form tells a REST reader to divide a value that
  // is already divided, which is the 10^18 error in the other direction.
  if (grpcForm === 'a decimal string') return 'Encoded as cosmos.Dec, a decimal string.';
  return `Encoded as cosmos.Dec, read back as ${grpcForm} over gRPC.`;
}

function interfaceNote(field, types) {
  if (!field.acceptsInterface) return null;
  const options = types.implementations?.get(field.acceptsInterface) ?? [];
  if (!options.length) return `Accepts any message implementing ${field.acceptsInterface}.`;
  return `One of: ${options.map((name) => `\`/${name}\``).join(', ')}.`;
}

function fieldNotes(field, types) {
  const notes = [];
  if (field.enumValues) {
    notes.push(`One of the [\`${shortName(field.enumValues.fullName)}\`](${anchorFor(field.enumValues.fullName)}) values.`);
  }
  if (field.deprecated) notes.push('Deprecated.');
  const accepted = interfaceNote(field, types);
  if (accepted) notes.push(accepted);
  if (field.scalarHint === 'cosmos.Dec') notes.push(decEncoding(field));
  else if (field.scalarHint) notes.push(`Encoded as ${field.scalarHint}.`);
  return notes;
}

function renderFieldTable(message, documentedTypes, types) {
  if (!message) return 'Schema unavailable.\n';
  if (!message.fields.length) return 'This message has no fields.\n';

  const rows = message.fields.map((field) => {
    const notes = fieldNotes(field, types);
    const description = [escapeCell(field.comment), ...notes].filter(Boolean).join(' ');
    return `| \`${field.name}\` | ${fieldTypeCell(field, documentedTypes, types)} | ${description} |`;
  });

  return ['| Field | Type | Description |', '| --- | --- | --- |', ...rows].join('\n') + '\n';
}

// Every message reachable from this module's own methods, one hop at a time,
// so a reader can resolve a nested field without leaving the page.
function collectReferencedTypes(module, types) {
  const wanted = new Set();
  const queue = [];

  for (const service of module.services) {
    for (const method of service.methods) {
      queue.push(method.inputType, method.outputType);
    }
  }

  while (queue.length) {
    const name = queue.shift();
    if (!name || wanted.has(name) || isOpaque(name)) continue;

    // Enums are leaves, and they have to be documented: without the value list
    // a reader has no way to learn that a vote option is "VOTE_OPTION_YES".
    if (types.enums.has(name)) {
      wanted.add(name);
      continue;
    }

    const message = types.messages.get(name);
    if (!message || message.isMapEntry) continue;
    wanted.add(name);
    for (const field of message.fields) {
      if (field.typeName) queue.push(field.typeName);
    }
  }

  return wanted;
}

// The depth at which expansion stops and a nested message collapses to `{}`.
// Nothing in the SDK protos nests this far without recursing, and the guard
// below stops recursion regardless.
const MAX_EXPANSION_DEPTH = 4;

// Protobuf JSON encodes 64-bit integers as strings, because they exceed what a
// JSON number can hold exactly. Every such proto type ends in 64 and no
// floating-point type does, so this is a rule over the type name rather than a
// list that has to be kept in step with the scalar table in descriptor.js.
function isStringEncodedInt(type) {
  return /64$/.test(type);
}

/**
 * A value taken from the field's own description, when it names one.
 *
 * Several request fields are plain strings whose legal values exist only in
 * prose: gov's `params_type` takes "voting", "tallying" or "deposit", and the
 * generated example said `<string>`, so the documented command errored with
 * `unknown params type: <string>`. Where the comment quotes candidates, the
 * first is a value that actually works.
 */
function quotedCandidate(field) {
  if (field.type !== 'string' || !field.comment) return null;
  const quoted = field.comment.match(/"([a-z][a-z0-9_]{2,})"/i);
  return quoted ? quoted[1] : null;
}

function scalarPlaceholder(type, field) {
  // A bytes field carrying a cosmos.Dec is written as a decimal string, not as
  // base64: the transaction decoder parses it with the decimal type, and the
  // empty-bytes placeholder is rejected outright with "decimal string cannot be
  // empty". base64 is only how the field reads back over gRPC.
  if (type === 'bytes' && field?.scalarHint === 'cosmos.Dec') return '0.05';
  if (type === 'bool') return false;
  // bytes is base64 in protobuf JSON, so a `<bytes>` placeholder is not merely
  // unhelpful, it fails to decode: grpcurl rejects it with "illegal base64 data".
  if (type === 'bytes') return '';
  if (type === 'string') return '<string>';
  // proto3's zero is a legal value in the type system but is rejected by many
  // handlers: proposal_id 0 and height 0 both error. 1 is valid far more often.
  if (isStringEncodedInt(type)) return '1';
  return 0;
}

/**
 * Well-known types have their own JSON representations that bear no relation to
 * their proto fields. Expanding them structurally produces confidently wrong
 * examples: a Duration is "604800s" on the wire, never {"seconds":0,"nanos":0}.
 */
export const WELL_KNOWN_JSON = {
  'google.protobuf.Duration': '0s',
  'google.protobuf.Timestamp': '<RFC 3339 timestamp>',
  'google.protobuf.FieldMask': '',
  'google.protobuf.Empty': {},
  'google.protobuf.Struct': {},
  'google.protobuf.Value': null,
  'google.protobuf.ListValue': [],
  'google.protobuf.NullValue': null,
  'google.protobuf.StringValue': '<string>',
  'google.protobuf.BytesValue': '',
  'google.protobuf.BoolValue': false,
  'google.protobuf.DoubleValue': 0,
  'google.protobuf.FloatValue': 0,
  'google.protobuf.Int64Value': '0',
  'google.protobuf.UInt64Value': '0',
  'google.protobuf.Int32Value': 0,
  'google.protobuf.UInt32Value': 0,
};

/**
 * The protobuf types whose JSON form is defined by the specification rather than
 * by their fields. Any other google.protobuf type, DescriptorProto among them,
 * is an ordinary message and expands correctly on its own.
 *
 * Kept separate from the map above so the generator can assert the two agree:
 * dropping an entry from WELL_KNOWN_JSON would otherwise silently reintroduce
 * the bug where Duration rendered as {"seconds":0,"nanos":0}.
 */
export const SPECIAL_JSON_TYPES = new Set([
  'google.protobuf.Any',
  'google.protobuf.Duration',
  'google.protobuf.Timestamp',
  'google.protobuf.FieldMask',
  'google.protobuf.Empty',
  'google.protobuf.Struct',
  'google.protobuf.Value',
  'google.protobuf.ListValue',
  'google.protobuf.NullValue',
  'google.protobuf.StringValue',
  'google.protobuf.BytesValue',
  'google.protobuf.BoolValue',
  'google.protobuf.DoubleValue',
  'google.protobuf.FloatValue',
  'google.protobuf.Int64Value',
  'google.protobuf.UInt64Value',
  'google.protobuf.Int32Value',
  'google.protobuf.UInt32Value',
]);

/**
 * An Any is inlined in protobuf JSON: the packed message's own fields sit
 * alongside an `@type` discriminator. Its proto fields, `type_url` and `value`,
 * never appear in JSON at all. Rendering them sends readers down a path that
 * cannot decode, and it contradicts the transactions page, which describes
 * `@type` correctly.
 */
/**
 * Types whose useful example is narrower than their full field set.
 *
 * A PageRequest expanded field-by-field sets `key` and `offset` together, which
 * the SDK rejects as soon as `key` is non-empty, and an `offset` of 1 silently
 * skips the first result. Only `limit` belongs in a starting template; the rest
 * of the fields stay documented in the type's own table.
 */
const CANONICAL_EXAMPLES = {
  'cosmos.base.query.v1beta1.PageRequest': { limit: '1' },
};

const ANY_EXAMPLE = {
  '@type': '/cosmos.example.v1.MsgExample',
  '...': 'the fields of that message, inline',
};

// The first value of a proto enum is required to be the zero value, which by
// SDK convention is *_UNSPECIFIED and is rejected by handlers. Showing it as
// the example would document a value that always fails.
function enumExample(enumType) {
  const values = enumType.values ?? [];
  // Skip the UNSPECIFIED zero value, which handlers reject, and skip deprecated
  // values: tx's BroadcastMode lists BROADCAST_MODE_BLOCK first among non-zero
  // values and it has been removed from the SDK, so it was the one value the
  // example could never work with.
  const usable = values.find((v) => !v.name.endsWith('_UNSPECIFIED') && !v.deprecated);
  return (usable ?? values.find((v) => !v.name.endsWith('_UNSPECIFIED')) ?? values[0])?.name
    ?? '<enum>';
}

/**
 * A fillable value for one field, expanding nested messages rather than
 * collapsing them to `{}`. This is what makes the example pasteable: a reader
 * building a MsgMultiSend needs to see that an Input holds an address and a
 * list of coins, without resolving two links first.
 *
 * `seen` breaks type cycles. Several SDK messages are indirectly recursive, and
 * without it Any-bearing types would expand forever.
 */
function exampleValue(field, types, depth, seen) {
  const single = () => {
    if (field.type === 'string') {
      if (field.enumValues) return enumExample(field.enumValues);
      const candidate = quotedCandidate(field);
      if (candidate) return candidate;
    }
    if (field.type) return scalarPlaceholder(field.type, field);
    if (!field.typeName) return null;

    if (field.typeName === 'google.protobuf.Any') return ANY_EXAMPLE;
    if (field.typeName in CANONICAL_EXAMPLES) return CANONICAL_EXAMPLES[field.typeName];
    if (field.typeName in WELL_KNOWN_JSON) return WELL_KNOWN_JSON[field.typeName];

    const enumType = types.enums.get(field.typeName);
    if (enumType) return enumExample(enumType);

    const message = types.messages.get(field.typeName);
    if (!message) return {};

    if (message.isMapEntry) {
      const value = message.fields.find((f) => f.name === 'value');
      return { '<key>': value ? exampleValue(value, types, depth + 1, seen) : {} };
    }

    if (depth >= MAX_EXPANSION_DEPTH || seen.has(field.typeName)) return {};

    const next = new Set(seen).add(field.typeName);
    return exampleBody(message, types, depth + 1, next);
  };

  const value = single();
  return field.repeated ? [value] : value;
}

// Keys use the proto field name rather than the camelCase JSON name. Both are
// accepted on input, but every field table, signer row and response on the
// chain uses snake_case, and showing two spellings for one field leaves a
// reader unable to tell which is real.
function exampleBody(message, types, depth = 0, seen = new Set()) {
  const body = {};
  // A oneof permits exactly one member. Setting several produces a message the
  // parser rejects with "should not have multiple oneof fields", so only the
  // first member of each oneof appears in an example.
  const usedOneofs = new Set();

  for (const field of message.fields ?? []) {
    if (field.oneofIndex !== null && field.oneofIndex !== undefined) {
      if (usedOneofs.has(field.oneofIndex)) continue;
      usedOneofs.add(field.oneofIndex);
    }
    // A deprecated field alongside its replacement leaves a reader unable to
    // tell which one is read: auth's AccountAddressByID sets both `id` and
    // `account_id`. The table still documents it; the runnable example omits it.
    if (field.deprecated) continue;
    body[field.name] = exampleValue(field, types, depth, seen);
  }
  return body;
}

function grpcurlExample(method, service, request, types) {
  const target = `localhost:9090 ${service.fullName}/${method.name}`;
  if (!request?.fields.length) return `grpcurl -plaintext ${target}`;

  const body = JSON.stringify(exampleBody(request, types));
  return `grpcurl -plaintext -d '${body}' \\\n  ${target}`;
}

/**
 * The message as it appears inside a transaction's `body.messages`, including
 * the `@type` discriminator. The page shows the type URL as a fact; this shows
 * where that URL actually goes.
 */
function transactionMessageExample(method, types) {
  const message = types.messages.get(method.inputType);
  const body = { '@type': `/${method.inputType}`, ...exampleBody(message ?? { fields: [] }, types) };
  return JSON.stringify(body, null, 2);
}

/**
 * Method headings, and the anchors REST pages link to.
 *
 * gov ships v1 and v1beta1 in one module, so a bare method name produces four
 * competing `### Deposit` headings on one page. The link still resolves, to
 * whichever came first, which is worse than breaking: a v1beta1 REST page
 * silently lands the reader on the v1 method. Where a module holds more than
 * one package version, the version goes in the heading.
 */
export function buildMethodHeadings(modules) {
  const headings = new Map();

  for (const module of modules) {
    // Qualify only as far as it takes to make every label on the page unique.
    // gov needs the version because it ships v1 and v1beta1, and then needs the
    // service too, because Deposit exists on both Query and Msg within v1.
    const candidates = [];
    for (const service of module.services) {
      for (const method of service.methods) {
        candidates.push({ service, method, key: `${service.fullName}/${method.name}` });
      }
    }

    const count = (labelOf) => {
      const seen = new Map();
      for (const entry of candidates) {
        const label = labelOf(entry);
        seen.set(label, (seen.get(label) ?? 0) + 1);
      }
      return seen;
    };

    const bare = ({ method }) => method.name;
    const withVersion = ({ service, method }) =>
      `${method.name} (${packageVersionOf(service.package)})`;
    const withService = ({ service, method }) =>
      `${method.name} (${service.name}, ${packageVersionOf(service.package)})`;

    const bareCounts = count(bare);
    const versionCounts = count(withVersion);

    for (const entry of candidates) {
      let label = bare(entry);
      if (bareCounts.get(label) > 1) {
        label = versionCounts.get(withVersion(entry)) > 1 ? withService(entry) : withVersion(entry);
      }
      headings.set(entry.key, {
        label,
        anchor: label
          .toLowerCase()
          .replace(/[(),]/g, '')
          .trim()
          .replace(/\s+/g, '-'),
        module: module.name,
      });
    }
  }

  return headings;
}

function packageVersionOf(pkg) {
  return pkg.split('.').pop();
}

function renderQueryMethod(method, service, types, documentedTypes, headings) {
  const heading = headings.get(`${service.fullName}/${method.name}`);
  const lines = [`### ${heading?.label ?? method.name}`, ''];

  if (method.deprecated) {
    lines.push('<Warning>This method is deprecated.</Warning>', '');
  }
  if (method.comment) lines.push(mdxSafe(method.comment), "");

  const facts = [
    '| | |',
    '| --- | --- |',
    `| gRPC | \`${service.fullName}/${method.name}\` |`,
  ];
  if (method.http) {
    facts.push(`| REST | \`${method.http.verb.toUpperCase()} ${method.http.path}\` |`);
  }
  lines.push(...facts, '');

  const request = types.messages.get(method.inputType);
  const response = types.messages.get(method.outputType);
  lines.push(`Request \`${shortName(method.inputType)}\`:`, '');
  lines.push(renderFieldTable(request, documentedTypes, types), '');
  lines.push(`Response \`${shortName(method.outputType)}\`:`, '');
  lines.push(renderFieldTable(response, documentedTypes, types), '');

  lines.push('```bash', grpcurlExample(method, service, request, types), '```', '');
  return lines.join('\n');
}

function renderMsgMethod(method, service, types, documentedTypes, headings, context) {
  const heading = headings.get(`${service.fullName}/${method.name}`);
  const lines = [`### ${heading?.label ?? method.name}`, ''];

  if (method.deprecated) {
    lines.push('<Warning>This message is deprecated.</Warning>', '');
  }
  if (method.comment) lines.push(mdxSafe(method.comment), "");

  const message = types.messages.get(method.inputType);
  const response = types.messages.get(method.outputType);

  const facts = [
    '| | |',
    '| --- | --- |',
    `| Type URL | \`/${method.inputType}\` |`,
    `| Handler | \`${service.fullName}/${method.name}\` |`,
  ];

  const signers = message?.signers ?? [];
  if (signers.length) {
    facts.push(`| Signer | ${signers.map((f) => `\`${f}\``).join(', ')} |`);
  }

  // Shown for every message rather than only where it deviates from
  // cosmos-sdk/<MsgName>. That convention holds for barely half of them, because
  // governance-gated messages follow cosmos-sdk/x/<module>/<MsgName> instead, so
  // any single default would be wrong about half the surface and the output
  // would flip between versions on one upstream rename.
  if (message) {
    facts.push(
      `| Amino name | ${message.aminoName ? `\`${message.aminoName}\`` : 'none registered'} |`,
    );
  }
  lines.push(...facts, '');

  if (signers.includes('authority')) {
    lines.push(
      '<Note>The signer is the governance module account, which no user holds a key for. This message executes only through a passed governance proposal, not as a transaction you submit directly.</Note>',
      '',
    );
  }

  lines.push(renderFieldTable(message, documentedTypes, types), '');
  lines.push('In a transaction:', '');
  lines.push('```json', transactionMessageExample(method, types), '```', '');
  lines.push(`Response \`${shortName(method.outputType)}\`:`, '');
  lines.push(renderFieldTable(response, documentedTypes, types), '');
  return lines.join('\n');
}

function renderTypeSection(fullName, types, documentedTypes) {
  const lines = [`### ${fullName}`, ''];

  const enumType = types.enums.get(fullName);
  if (enumType) {
    lines.push('Written as a quoted string in JSON.', '');
    lines.push('| Value | |', '| --- | --- |');
    for (const value of enumType.values) {
      const notes = [];
      if (value.name.endsWith('_UNSPECIFIED')) notes.push('Zero value. Handlers reject it.');
      if (value.deprecated) notes.push('Deprecated.');
      lines.push(`| \`${value.name}\` | ${notes.join(' ')} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  const message = types.messages.get(fullName);
  if (message?.comment) lines.push(mdxSafe(message.comment), "");
  lines.push(renderFieldTable(message, documentedTypes, types), '');
  return lines.join('\n');
}

export function renderModulePage(module, types, context, headings) {
  // Every message a method takes or returns is rendered under that method, so
  // repeating it in Types would be a second copy of what the reader just read.
  // Types carries what is referenced but never shown: nested and shared types
  // such as Coin, PageRequest and BaseAccount, which field tables link to.
  const reachable = collectReferencedTypes(module, types);
  const inlined = new Set();
  for (const service of module.services) {
    for (const method of service.methods) {
      inlined.add(method.inputType);
      inlined.add(method.outputType);
    }
  }
  const documentedTypes = new Set([...reachable].filter((name) => !inlined.has(name)));

  const queries = module.services.filter((s) => s.kind === 'query');
  const msgs = module.services.filter((s) => s.kind === 'msg');

  const queryCount = queries.reduce((n, s) => n + s.methods.length, 0);
  const msgCount = msgs.reduce((n, s) => n + s.methods.length, 0);

  const out = [];
  out.push('---');
  out.push(`title: "${titleCase(module.name)}"`);
  out.push(
    `description: "gRPC queries and transaction messages defined by the ${module.name} module in Cosmos SDK ${context.displayVersion}."`,
  );
  out.push('---');
  out.push('');
  out.push(
    `{/* Generated by scripts/api-reference/sync-sdk-api-reference.js. Do not edit by hand. */}`,
  );
  out.push('');
  // Provenance only. What a node actually serves is stated once, beside the
  // reflection command that answers it, rather than twice on every page.
  out.push('<Info>');
  out.push(
    `  Generated from [\`${context.repository}@${context.sha.slice(0, 12)}\`](https://github.com/${context.repository}/tree/${context.sha}/proto) on ref \`${context.ref}\`.`,
  );
  out.push('</Info>');
  out.push('');

  if (queryCount) {
    out.push('## Queries');
    out.push('');
    out.push(
      'A node exposes only the services its application registers:',
    );
    out.push('');
    out.push('- gRPC on port 9090');
    out.push('- REST on port 1317, if the method has an HTTP binding');
    out.push('');
    out.push(
      'Run `grpcurl -plaintext localhost:9090 list` to see what a node serves.',
    );
    out.push('');
    // Search engines land readers directly on a module page, so the examples
    // have to say what they assume. Without this, a reader points a -plaintext
    // localhost example at a public endpoint and gets a TLS handshake failure
    // with no route to the page that explains it.
    //
    // No blanket statement about cosmos.Dec here. The same value is written and
    // read in different forms depending on the surface, so a single sentence is
    // wrong in one direction whichever form it names. An earlier version of this
    // paragraph asserted the scaled integer string, which is the read form, and
    // shipped that to readers writing requests on 42 pages. The field table
    // states the form per field, which is the only place it can be right.
    out.push(
      `Replace \`<string>\` placeholders with real values and omit unused filters. Payloads use protobuf JSON, and some \`string\` fields accept enum constants listed under Types. Field tables give the encoding each value takes.`,
    );
    out.push('');
    out.push(
      `Examples assume a local node. For TLS endpoints, use port 443 and omit \`-plaintext\`. See [gRPC services](/sdk/${context.version}/api-reference/grpc/index) for reflection, address formats, and decimal encoding.`,
    );
    out.push('');
    for (const service of queries) {
      if (queries.length > 1) {
        out.push(`## ${service.fullName}`, '');
        if (service.comment) out.push(mdxSafe(service.comment), "");
      }
      for (const method of service.methods) {
        out.push(renderQueryMethod(method, service, types, documentedTypes, headings));
      }
    }
  }

  if (msgCount) {
    out.push('## Transaction messages');
    out.push('');
    out.push(
      `These messages are included in signed transactions, not called as endpoints. See [Sending transactions](/sdk/${context.version}/api-reference/transactions).`,
    );
    out.push('');
    // The Dec sentence is the most expensive prose in this reference: the
    // encoding was wrong four times and each attempt read plausibly. The bytes
    // clause is the case that shipped wrong, where the form a reader writes and
    // the form it reads back in differ. pagefill.py refuses to fill a Dec field
    // unless the page states the form, matching on the value rather than on
    // this wording, so the sentence can be rewritten but the value has to stay.
    out.push(
      `Examples use CLI transaction JSON. Decimal fields use values such as \`"0.05"\`, even when their proto type is \`bytes\`. The gRPC \`TxEncode\` method instead requires the scaled value \`"50000000000000000"\`. See [scalar encodings](/sdk/${context.version}/api-reference/grpc/index#scalar-encodings).`,
    );
    out.push('');
    out.push('- Handler: Generated client method');
    out.push('- Signer: Account that must sign');
    out.push('- Amino name: Legacy identifier used by hardware wallets and other Amino signers');
    out.push('');
    for (const service of msgs) {
      for (const method of service.methods) {
        out.push(renderMsgMethod(method, service, types, documentedTypes, headings, context));
      }
    }
  }

  const typeNames = [...documentedTypes].sort();
  if (typeNames.length) {
    out.push('## Types');
    out.push('');
    out.push(
      'Messages referenced by the fields above. Protocol buffers version 3 has no required fields, so every field is optional on the wire, and a `[]` suffix marks a repeated field.',
    );
    out.push('');
    for (const name of typeNames) {
      out.push(renderTypeSection(name, types, documentedTypes));
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export { anchorFor, collectReferencedTypes };
