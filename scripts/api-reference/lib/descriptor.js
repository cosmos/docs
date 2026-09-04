// Turns a buf-generated FileDescriptorSet into the model the renderer consumes.
//
// Nothing here is hand-maintained: the module list, the service list, and the
// ordering all fall out of the descriptor. A module that appears upstream shows
// up in the output on the next run without anyone editing this file.

const SOURCE_PATH_SERVICE = 6;
const SOURCE_PATH_MESSAGE = 4;
const SOURCE_PATH_METHOD = 2;
const SOURCE_PATH_FIELD = 2;

const HTTP_OPTION = '[google.api.http]';
const ADDED_IN_METHOD = '[cosmos_proto.method_added_in]';
const ADDED_IN_FIELD = '[cosmos_proto.field_added_in]';
const SCALAR_OPTION = '[cosmos_proto.scalar]';
const SIGNER_OPTION = '[cosmos.msg.v1.signer]';
const AMINO_NAME_OPTION = '[amino.name]';
const CUSTOM_TYPE_OPTION = '[gogoproto.customtype]';
const ACCEPTS_INTERFACE = '[cosmos_proto.accepts_interface]';
const IMPLEMENTS_INTERFACE = '[cosmos_proto.implements_interface]';

const HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete'];

// Scalar proto types render as-is; TYPE_MESSAGE and TYPE_ENUM carry a typeName.
const SCALAR_TYPES = {
  TYPE_DOUBLE: 'double',
  TYPE_FLOAT: 'float',
  TYPE_INT64: 'int64',
  TYPE_UINT64: 'uint64',
  TYPE_INT32: 'int32',
  TYPE_FIXED64: 'fixed64',
  TYPE_FIXED32: 'fixed32',
  TYPE_BOOL: 'bool',
  TYPE_STRING: 'string',
  TYPE_BYTES: 'bytes',
  TYPE_UINT32: 'uint32',
  TYPE_SFIXED32: 'sfixed32',
  TYPE_SFIXED64: 'sfixed64',
  TYPE_SINT32: 'sint32',
  TYPE_SINT64: 'sint64',
};

// sourceCodeInfo addresses every element by a path of field numbers and indexes.
// Flattening it once up front is cheaper than searching per lookup.
function indexComments(file) {
  const byPath = new Map();
  for (const loc of file.sourceCodeInfo?.location ?? []) {
    const text = (loc.leadingComments ?? '').trim();
    if (text) byPath.set(loc.path.join('.'), cleanComment(text));
  }
  return byPath;
}

// Proto comments arrive with the leading space that followed each `//`, and
// wrap mid-sentence. Unwrap paragraphs so they render as prose rather than
// keeping the source file's line breaks.
function cleanComment(text) {
  const lines = text.split('\n').map((l) => l.replace(/^ /, ''));
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length) paragraphs.push(current.join(' '));
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs.join('\n\n');
}

// Two normalizations are needed before an annotation path can be compared to a
// generated OpenAPI path.
//
// `{name=foo/*}` is a gRPC-gateway matching rule rather than part of the URL
// shape, so the `=...` half goes.
//
// Parameter names then have to agree. Annotations carry the proto field name
// (`{account_id}`) while protoc-gen-openapiv2 emits the JSON name
// (`{accountId}`). Dropping the names entirely would be simpler but would
// conflate genuinely distinct routes: auth binds both `bech32/{address_bytes}`
// and `bech32/{address_string}`, which are identical once the names are gone.
function normalizeHttpPath(path) {
  return path.replace(/\{([^}=]+)(=[^}]*)?\}/g, (_, name) => `{${toJsonName(name)}}`);
}

function toJsonName(name) {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function readHttpRule(options) {
  const rule = options?.[HTTP_OPTION];
  if (!rule) return null;
  for (const verb of HTTP_VERBS) {
    if (rule[verb]) return { verb, path: normalizeHttpPath(rule[verb]) };
  }
  // `custom` bindings exist in the spec but the SDK does not use them. Treat an
  // unrecognised shape as absent rather than guessing at it.
  return null;
}

// `cosmos.bank.v1beta1` and `cosmos.base.node.v1beta1` both belong to one module
// as far as a reader is concerned. The second segment is that module.
function moduleOf(pkg) {
  const parts = pkg.split('.');
  return parts.length > 1 ? parts[1] : parts[0];
}

// A Msg service is not served by the gRPC query router, so it must not be
// rendered as a callable endpoint. See baseapp/msg_service_router.go.
function serviceKind(name) {
  return name === 'Msg' ? 'msg' : 'query';
}

function buildTypeIndex(files) {
  const messages = new Map();
  const enums = new Map();

  const walkMessage = (pkg, prefix, msg, file, comments, path) => {
    const fullName = `${prefix}.${msg.name}`;
    messages.set(fullName, {
      fullName,
      name: msg.name,
      package: pkg,
      file: file.name,
      comment: comments.get(path.join('.')) ?? '',
      fields: (msg.field ?? []).map((field, i) => ({
        name: field.name,
        jsonName: field.jsonName,
        number: field.number,
        repeated: field.label === 'LABEL_REPEATED',
        optional: field.proto3Optional === true,
        type: SCALAR_TYPES[field.type] ?? null,
        typeName: field.typeName ? field.typeName.replace(/^\./, '') : null,
        scalarHint: field.options?.[SCALAR_OPTION] ?? null,
        // Distinguishes the three wire forms a cosmos.Dec can take. A field
        // carrying the LegacyDec custom type is marshalled as a scaled integer;
        // one without holds an already-formatted decimal.
        customType: field.options?.[CUSTOM_TYPE_OPTION] ?? null,
        addedIn: field.options?.[ADDED_IN_FIELD] ?? null,
        deprecated: field.options?.deprecated === true,
        // Fields in a oneof share an index. Only one may be set at a time, so an
        // example that sets them all is not a valid message.
        oneofIndex: field.oneofIndex ?? null,
        // An Any field declares which interface it accepts. Messages declare
        // which they implement. Together they name the concrete type URLs a
        // reader may put in that field, which is otherwise undiscoverable.
        acceptsInterface: field.options?.[ACCEPTS_INTERFACE] ?? null,
        comment: comments.get([...path, SOURCE_PATH_FIELD, i].join('.')) ?? '',
      })),
      // A map<k,v> field compiles to a repeated synthetic nested message. Those
      // are an implementation detail and must not surface as documented types.
      isMapEntry: msg.options?.mapEntry === true,
      // Which field names the account that must sign a transaction carrying
      // this message. `authority` means the governance module account, which no
      // user holds a key for, so the message only executes via a passed proposal.
      signers: msg.options?.[SIGNER_OPTION] ?? null,
      // The name this message is registered under for Amino JSON signing, which
      // is used by signers that display a transaction for human approval, such as
      // hardware wallets. Frozen for signature compatibility, so many
      // predate the current naming convention.
      aminoName: msg.options?.[AMINO_NAME_OPTION] ?? null,
      implementsInterface: msg.options?.[IMPLEMENTS_INTERFACE] ?? null,
    });

    (msg.nestedType ?? []).forEach((nested, i) => {
      walkMessage(pkg, fullName, nested, file, comments, [...path, 3, i]);
    });
    (msg.enumType ?? []).forEach((e, i) => {
      enums.set(`${fullName}.${e.name}`, {
        fullName: `${fullName}.${e.name}`,
        values: (e.value ?? []).map((v) => ({
          name: v.name,
          deprecated: v.options?.deprecated === true,
        })),
      });
    });
  };

  for (const file of files) {
    const comments = indexComments(file);
    const pkg = file.package ?? '';
    (file.messageType ?? []).forEach((msg, i) => {
      walkMessage(pkg, pkg, msg, file, comments, [SOURCE_PATH_MESSAGE, i]);
    });
    (file.enumType ?? []).forEach((e) => {
      enums.set(`${pkg}.${e.name}`, {
        fullName: `${pkg}.${e.name}`,
        values: (e.value ?? []).map((v) => ({
          name: v.name,
          deprecated: v.options?.deprecated === true,
        })),
      });
    });
  }

  return { messages, enums };
}

function buildModules(files) {
  const modules = new Map();

  for (const file of files) {
    if (!file.service?.length) continue;
    const pkg = file.package ?? '';

    // The proto tree vendors its dependencies, so a descriptor built from it
    // also contains tendermint.abci.ABCI, the consensus interface between
    // CometBFT and the application. That is not an SDK module API and belongs
    // in the CometBFT docs. This is a namespace boundary rather than a list of
    // modules, so a module added upstream still appears without an edit here.
    if (!pkg.startsWith('cosmos.')) continue;

    const comments = indexComments(file);
    const moduleName = moduleOf(pkg);

    if (!modules.has(moduleName)) {
      modules.set(moduleName, { name: moduleName, services: [] });
    }

    file.service.forEach((service, svcIndex) => {
      const servicePath = [SOURCE_PATH_SERVICE, svcIndex];
      modules.get(moduleName).services.push({
        name: service.name,
        fullName: `${pkg}.${service.name}`,
        package: pkg,
        file: file.name,
        kind: serviceKind(service.name),
        comment: comments.get(servicePath.join('.')) ?? '',
        methods: (service.method ?? []).map((method, i) => {
          const http = readHttpRule(method.options);
          return {
            name: method.name,
            fullName: `${pkg}.${service.name}/${method.name}`,
            inputType: method.inputType.replace(/^\./, ''),
            outputType: method.outputType.replace(/^\./, ''),
            comment: comments.get([...servicePath, SOURCE_PATH_METHOD, i].join('.')) ?? '',
            http,
            addedIn: method.options?.[ADDED_IN_METHOD] ?? null,
            deprecated: method.options?.deprecated === true,
          };
        }),
      });
    });
  }

  for (const module of modules.values()) {
    module.services.sort((a, b) => a.fullName.localeCompare(b.fullName));
    for (const service of module.services) {
      service.methods.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return [...modules.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function parseDescriptor(descriptor) {
  const files = descriptor.file ?? [];
  const types = buildTypeIndex(files);

  /**
   * A string field whose name matches an enum in its own package carries that
   * enum's values, even though the proto types it as a plain string and links
   * nothing. staking's QueryValidatorsRequest.status is the only such field in
   * the SDK, and without this a reader sees `"status": "<string>"` while the
   * values sit in the same page's Types section, unconnected. Verified to match
   * exactly one field, so it names a real relationship rather than guessing.
   */
  for (const message of types.messages.values()) {
    for (const field of message.fields) {
      if (field.type !== 'string' || field.enumValues) continue;
      for (const [name, enumType] of types.enums) {
        const short = name.split('.').pop();
        if (
          name.startsWith(`${message.package}.`) &&
          short.toLowerCase().endsWith(field.name.toLowerCase())
        ) {
          field.enumValues = enumType;
          break;
        }
      }
    }
  }

  // interface name -> the concrete messages that implement it
  // implements_interface is a repeated option, so it arrives as an array even
  // when a message declares one interface. accepts_interface is a single value.
  const implementations = new Map();
  for (const message of types.messages.values()) {
    const declared = message.implementsInterface;
    if (!declared) continue;
    for (const name of Array.isArray(declared) ? declared : [declared]) {
      const list = implementations.get(name) ?? [];
      if (!list.includes(message.fullName)) list.push(message.fullName);
      implementations.set(name, list);
    }
  }
  for (const list of implementations.values()) list.sort();

  return { modules: buildModules(files), types: { ...types, implementations } };
}

export { moduleOf, normalizeHttpPath };
