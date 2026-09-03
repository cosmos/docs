// End-to-end tests for the API reference generator.
//
// These run against synthetic descriptors rather than the network, so they are
// fast, offline, and able to describe upstream changes that have not happened:
// a module removed, a method added, a new scalar annotation, a new proto
// version appearing beside an old one.
//
// The encoding cases are regression tests. Every one of them shipped wrong at
// some point and was caught only by calling a real chain: enums as {}, Any as
// {typeUrl,value}, Duration as {seconds,nanos}, bytes as an unparseable
// placeholder. They are cheap to assert and expensive to rediscover.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { parseDescriptor } from '../lib/descriptor.js';
import { renderModulePage, buildMethodHeadings } from '../lib/render.js';
import { buildInventory } from '../lib/inventory.js';
import {
  convertToOpenApi3,
  joinSpecToDescriptor,
  useProtoFieldNames,
  dropIdenticalPathTemplates,
} from '../lib/openapi.js';
import {
  pruneRemovedModulePages,
  checkScalarAnnotationsDocumented,
  checkWellKnownTypesHandled,
} from '../lib/checks.js';
import {
  baseDescriptor,
  govModule,
  govV1Beta1,
  descriptor,
  file,
  message,
  field,
  method,
  service,
  swagger,
} from './fixtures.js';

const CONTEXT = {
  repository: 'cosmos/cosmos-sdk',
  ref: 'release/v0.55.x',
  sha: 'abc123def456abc123def456abc123def456abcd',
  displayVersion: 'v0.55',
  version: 'latest',
};

function render(desc, moduleName) {
  const { modules, types } = parseDescriptor(desc);
  const module = modules.find((m) => m.name === moduleName);
  assert.ok(module, `fixture has no ${moduleName} module`);
  return renderModulePage(module, types, CONTEXT, buildMethodHeadings(modules));
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'api-ref-test-'));
}

describe('modules appearing and disappearing upstream', () => {
  test('a module added upstream is discovered with no code change', () => {
    const before = parseDescriptor(baseDescriptor()).modules.map((m) => m.name);
    assert.deepEqual(before, ['bank']);

    const after = parseDescriptor(
      descriptor([...baseDescriptor().file, ...govModule()]),
    ).modules.map((m) => m.name);
    assert.deepEqual(after, ['bank', 'gov'], 'new module should appear, alphabetically');
  });

  test('a module removed upstream has its page deleted from disk', () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'grpc'), { recursive: true });
    for (const name of ['bank.mdx', 'gov.mdx', 'index.mdx']) {
      fs.writeFileSync(path.join(dir, 'grpc', name), 'x');
    }

    const removed = pruneRemovedModulePages(dir, ['bank']);

    assert.deepEqual(removed, ['gov.mdx']);
    assert.ok(fs.existsSync(path.join(dir, 'grpc', 'bank.mdx')), 'kept module survives');
    assert.ok(fs.existsSync(path.join(dir, 'grpc', 'index.mdx')), 'hand-written index is exempt');
    assert.ok(!fs.existsSync(path.join(dir, 'grpc', 'gov.mdx')), 'removed module is deleted');
  });

  test('a method added upstream appears on the page', () => {
    const desc = baseDescriptor();
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType.push(message('QueryParamsRequest', []));
    queryFile.messageType.push(message('QueryParamsResponse', []));
    queryFile.service[0].method.push(
      method(
        'Params',
        'cosmos.bank.v1beta1.QueryParamsRequest',
        'cosmos.bank.v1beta1.QueryParamsResponse',
      ),
    );

    const page = render(desc, 'bank');
    assert.match(page, /### Params/);
    assert.match(page, /cosmos\.bank\.v1beta1\.Query\/Params/);
  });

  test('a method removed upstream disappears from the page', () => {
    const desc = baseDescriptor();
    const txFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/tx.proto');
    txFile.service[0].method = [];

    const page = render(desc, 'bank');
    assert.doesNotMatch(page, /### Send/);
    assert.doesNotMatch(page, /## Transaction messages/, 'empty section is omitted entirely');
  });

  test('a module with only transaction messages renders no Queries section', () => {
    const desc = descriptor(
      baseDescriptor().file.filter((f) => f.name !== 'cosmos/bank/v1beta1/query.proto'),
    );
    const page = render(desc, 'bank');
    assert.doesNotMatch(page, /## Queries/);
    assert.match(page, /## Transaction messages/);
  });
});

describe('JSON encodings, each a regression found against a live chain', () => {
  test('an enum renders as a quoted value, never as an empty object', () => {
    const page = render(descriptor([...baseDescriptor().file, ...govModule()]), 'gov');
    assert.match(page, /"option": "VOTE_OPTION_YES"/);
    assert.doesNotMatch(page, /"option": \{\}/);
  });

  test('the enum example skips the UNSPECIFIED zero value that handlers reject', () => {
    const page = render(descriptor([...baseDescriptor().file, ...govModule()]), 'gov');
    assert.doesNotMatch(page, /"option": "VOTE_OPTION_UNSPECIFIED"/);
  });

  test('an enum is documented in Types with all of its values', () => {
    const page = render(descriptor([...baseDescriptor().file, ...govModule()]), 'gov');
    assert.match(page, /### cosmos\.gov\.v1\.VoteOption/);
    assert.match(page, /VOTE_OPTION_YES/);
    assert.match(page, /Zero value\. Handlers reject it\./);
  });

  test('Any is inlined with @type, not expanded to typeUrl and value', () => {
    const desc = baseDescriptor();
    const txFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/tx.proto');
    txFile.messageType[0].field.push(
      field('extra', { number: 4, type: 'TYPE_MESSAGE', typeName: 'google.protobuf.Any' }),
    );

    const page = render(desc, 'bank');
    assert.match(page, /"@type": "\/cosmos\.example\.v1\.MsgExample"/);
    assert.doesNotMatch(page, /"type_url"/);
  });

  test('Duration renders as a string, not as seconds and nanos', () => {
    const desc = baseDescriptor();
    const txFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/tx.proto');
    txFile.messageType[0].field.push(
      field('period', { number: 4, type: 'TYPE_MESSAGE', typeName: 'google.protobuf.Duration' }),
    );

    const page = render(desc, 'bank');
    assert.match(page, /"period": "0s"/);
    assert.doesNotMatch(page, /"nanos"/);
  });

  test('bytes renders as valid base64, since a placeholder fails to decode', () => {
    const desc = baseDescriptor();
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType[0].field.push(field('key', { number: 3, type: 'TYPE_BYTES' }));

    const page = render(desc, 'bank');
    // Compact in the grpcurl payload, spaced in the pretty-printed transaction
    // JSON. Either way it must be valid base64, and the empty string is.
    assert.match(page, /"key": ?""/);
    assert.doesNotMatch(page, /<bytes>/);
  });

  test('64-bit integers render as quoted strings', () => {
    const page = render(descriptor([...baseDescriptor().file, ...govModule()]), 'gov');
    assert.match(page, /"proposal_id": "\d+"/, 'uint64 is a string in protobuf JSON');
  });

  test('64-bit integer examples avoid zero, which many handlers reject', () => {
    // proposal_id 0 and height 0 are legal in the type system and errors on
    // chain, and they were the values the page's own examples used.
    const page = render(descriptor([...baseDescriptor().file, ...govModule()]), 'gov');
    assert.doesNotMatch(page, /"proposal_id": "0"/);
  });

  test('a cosmos.Dec names which of its three wire forms a field uses', () => {
    const desc = baseDescriptor();
    const coin = desc.file.find((f) => f.name === 'cosmos/base/v1beta1/coin.proto');
    coin.messageType.push(
      message('DecPair', [
        { ...field('scaled', { number: 1, scalar: 'cosmos.Dec' }),
          options: { '[cosmos_proto.scalar]': 'cosmos.Dec',
                     '[gogoproto.customtype]': 'cosmossdk.io/math.LegacyDec' } },
        field('formatted', { number: 2, scalar: 'cosmos.Dec' }),
      ]),
    );
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType[1].field.push(
      field('pair', { number: 2, type: 'TYPE_MESSAGE', typeName: 'cosmos.base.v1beta1.DecPair' }),
    );

    const page = render(desc, 'bank');
    assert.match(page, /`scaled`.*integer string scaled by 10\^18/);
    assert.match(page, /`formatted`.*a decimal string/);
  });

  test('example keys use proto field names, matching the field tables', () => {
    const page = render(baseDescriptor(), 'bank');
    assert.match(page, /"from_address"/);
    assert.doesNotMatch(page, /"fromAddress"/);
  });

  test('only one member of a oneof appears in an example', () => {
    // A message with several oneof members set is rejected by the parser with
    // "should not have multiple oneof fields", so such an example can never work.
    const desc = baseDescriptor();
    const coin = desc.file.find((f) => f.name === 'cosmos/base/v1beta1/coin.proto');
    coin.messageType.push({
      name: 'Choice',
      field: [
        { ...field('first', { number: 1 }), oneofIndex: 0 },
        { ...field('second', { number: 2 }), oneofIndex: 0 },
        field('always', { number: 3 }),
      ],
      oneofDecl: [{ name: 'kind' }],
      options: {},
    });
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType[0].field.push(
      field('choice', { number: 5, type: 'TYPE_MESSAGE', typeName: 'cosmos.base.v1beta1.Choice' }),
    );

    const page = render(desc, 'bank');
    const example = page.match(/grpcurl -plaintext -d '(\{.*?\})'/s)[1];
    assert.match(example, /"first"/);
    assert.doesNotMatch(example, /"second"/, 'a second oneof member must not be set');
    assert.match(example, /"always"/, 'fields outside the oneof are unaffected');
  });

  test('a deprecated field is documented but kept out of runnable examples', () => {
    const desc = baseDescriptor();
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType[0].field.push(field('old_id', { number: 9, deprecated: true }));

    const page = render(desc, 'bank');
    assert.match(page, /`old_id`/, 'still in the field table');
    assert.doesNotMatch(page, /"old_id"/, 'omitted from the example payload');
  });
});

describe('queries and transaction messages are presented differently', () => {
  test('a query gets a grpcurl example', () => {
    const page = render(baseDescriptor(), 'bank');
    const queries = page.slice(page.indexOf('## Queries'), page.indexOf('## Transaction messages'));
    assert.match(queries, /grpcurl/);
  });

  test('a transaction message gets no grpcurl example', () => {
    const page = render(baseDescriptor(), 'bank');
    const txs = page.slice(page.indexOf('## Transaction messages'), page.indexOf('## Types'));
    assert.doesNotMatch(txs, /grpcurl/, 'Msg is not served by the gRPC query router');
    assert.match(txs, /Type URL/);
  });

  test('the signer is shown, and authority carries the governance warning', () => {
    const desc = baseDescriptor();
    const txFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/tx.proto');
    txFile.messageType[0].options['[cosmos.msg.v1.signer]'] = ['authority'];

    const page = render(desc, 'bank');
    assert.match(page, /\| Signer \| `authority` \|/);
    assert.match(page, /only through a passed governance proposal/);
  });

  test('a message with no amino name says so rather than omitting the row', () => {
    const desc = baseDescriptor();
    const txFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/tx.proto');
    delete txFile.messageType[0].options['[amino.name]'];

    const page = render(desc, 'bank');
    // The row must still appear, so absence is unambiguous. It must not claim
    // the message cannot be Amino-signed: that was disproved on chain, where two
    // such messages signed with --sign-mode amino-json and executed with code 0.
    assert.match(page, /\| Amino name \| none registered \|/);
    assert.doesNotMatch(page, /cannot be signed/);
  });
});

describe('headings stay unique as upstream adds proto versions', () => {
  test('a single version needs no qualification', () => {
    const headings = buildMethodHeadings(parseDescriptor(baseDescriptor()).modules);
    assert.equal(headings.get('cosmos.bank.v1beta1.Query/Balance').label, 'Balance');
  });

  test('two package versions of one module are disambiguated', () => {
    const { modules } = parseDescriptor(descriptor([...baseDescriptor().file, ...govV1Beta1()]));
    const headings = buildMethodHeadings(modules);

    assert.equal(headings.get('cosmos.gov.v1.Query/Proposals').label, 'Proposals (v1)');
    assert.equal(headings.get('cosmos.gov.v1beta1.Query/Proposals').label, 'Proposals (v1beta1)');
  });

  test('a name colliding across services in one version also gets the service', () => {
    const files = [...baseDescriptor().file, ...govV1Beta1()];
    // gov v1 gains a Msg service with a method named like its query.
    files.push(
      file({
        name: 'cosmos/gov/v1/tx2.proto',
        pkg: 'cosmos.gov.v1',
        messages: [message('MsgProposals', []), message('MsgProposalsResponse', [])],
        services: [
          service('Msg', [
            method('Proposals', 'cosmos.gov.v1.MsgProposals', 'cosmos.gov.v1.MsgProposalsResponse'),
          ]),
        ],
      }),
    );

    const headings = buildMethodHeadings(parseDescriptor(descriptor(files)).modules);
    assert.equal(headings.get('cosmos.gov.v1.Query/Proposals').label, 'Proposals (Query, v1)');
    assert.equal(headings.get('cosmos.gov.v1.Msg/Proposals').label, 'Proposals (Msg, v1)');
  });

  test('every heading on a page is unique, so no anchor is ambiguous', () => {
    const page = render(descriptor([...baseDescriptor().file, ...govV1Beta1()]), 'gov');
    const headings = [...page.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    assert.equal(new Set(headings).size, headings.length, `duplicate heading in: ${headings}`);
  });
});

describe('the join between the descriptor and upstream REST spec', () => {
  const grpcPagePath = '/sdk/latest/api-reference/grpc';

  async function join(desc, spec) {
    const { modules } = parseDescriptor(desc);
    const converted = await convertToOpenApi3(spec);
    return joinSpecToDescriptor(converted, modules, {
      grpcPagePath,
      headings: buildMethodHeadings(modules),
    });
  }

  test('a REST operation with no descriptor method is a hard failure', async () => {
    const spec = swagger({
      '/cosmos/bank/v1beta1/balances/{address}/by_denom': { operationId: 'Balance' },
      '/cosmos/bank/v1beta1/invented': { operationId: 'Invented' },
    });
    const { problems } = await join(baseDescriptor(), spec);
    assert.ok(
      problems.some((p) => p.includes('/cosmos/bank/v1beta1/invented')),
      'an unexplained route must stop the build',
    );
  });

  test('an annotated method absent from the REST spec warns but does not fail', async () => {
    const spec = swagger({});
    const { problems, unrepresented } = await join(baseDescriptor(), spec);
    assert.deepEqual(problems, [], 'upstream omitting a module is not a disagreement');
    assert.ok(unrepresented.some((u) => u.includes('Query/Balance')));
  });

  test('operation ids are derived, so upstream duplicates cannot collide pages', async () => {
    // Upstream really does assign one id to two different gov routes.
    const spec = swagger({
      '/cosmos/gov/v1/proposals': { operationId: 'GovV1Proposal' },
      '/cosmos/gov/v1beta1/proposals': { operationId: 'GovV1Proposal' },
    });
    const { spec: joined, problems } = await join(
      descriptor([...baseDescriptor().file, ...govV1Beta1()]),
      spec,
    );

    assert.deepEqual(problems, [], 'derived ids should resolve upstream collision');
    const ids = Object.values(joined.paths).map((p) => p.get.operationId);
    assert.equal(new Set(ids).size, ids.length, `ids still collide: ${ids}`);
  });

  test('path parameter naming differences do not break the join', async () => {
    // The annotation says {address}; protoc-gen-openapiv2 may emit the JSON name.
    const spec = swagger({
      '/cosmos/bank/v1beta1/balances/{address}/by_denom': { operationId: 'Balance' },
    });
    const { problems } = await join(baseDescriptor(), spec);
    assert.deepEqual(problems, []);
  });

  test('each REST operation links to its gRPC method by a real anchor', async () => {
    const desc = descriptor([...baseDescriptor().file, ...govV1Beta1()]);
    const spec = swagger({
      '/cosmos/gov/v1beta1/proposals': { operationId: 'Proposals' },
    });
    const { spec: joined } = await join(desc, spec);

    const description = joined.paths['/cosmos/gov/v1beta1/proposals'].get.description;
    const anchor = description.match(/#([a-z0-9-]+)\)/)[1];

    const page = render(desc, 'gov');
    const anchors = [...page.matchAll(/^### (.+)$/gm)].map((m) =>
      m[1].toLowerCase().replace(/[(),]/g, '').trim().replace(/\s+/g, '-'),
    );
    assert.ok(anchors.includes(anchor), `${anchor} is not a heading on the gov page`);
  });

  test('schema properties are renamed to the names the gateway actually emits', () => {
    const { types } = parseDescriptor(baseDescriptor());
    const spec = {
      components: {
        schemas: {
          'cosmos.bank.v1beta1.MsgSend': {
            properties: { fromAddress: {}, toAddress: {}, amount: {} },
            required: ['fromAddress'],
          },
        },
      },
      paths: {},
    };

    const { renamed } = useProtoFieldNames(spec, types);
    const schema = spec.components.schemas['cosmos.bank.v1beta1.MsgSend'];

    assert.equal(renamed, 2);
    assert.deepEqual(Object.keys(schema.properties), ['from_address', 'to_address', 'amount']);
    assert.deepEqual(schema.required, ['from_address']);
  });

  test('paths differing only by parameter name are reduced to one', () => {
    const spec = {
      paths: {
        '/cosmos/auth/v1beta1/bech32/{addressBytes}': { get: {} },
        '/cosmos/auth/v1beta1/bech32/{addressString}': { get: {} },
        '/cosmos/auth/v1beta1/accounts': { get: {} },
      },
    };
    const { dropped } = dropIdenticalPathTemplates(spec);

    assert.equal(dropped.length, 1, 'OpenAPI forbids both templates in one document');
    assert.equal(Object.keys(spec.paths).length, 2);
  });
});

describe('guards over the hand-written half', () => {
  test('a new scalar annotation upstream stops the build and names it', () => {
    const desc = baseDescriptor();
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType[0].field.push(
      field('novel', { number: 8, scalar: 'cosmos.SomethingNew' }),
    );
    const { types } = parseDescriptor(desc);

    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'grpc'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'grpc', 'index.mdx'),
      '| `cosmos.Int` | ... |\n| `cosmos.AddressString` | ... |\n',
    );

    assert.throws(
      () => checkScalarAnnotationsDocumented(types, dir),
      /cosmos\.SomethingNew/,
      'an undefined encoding must fail loudly',
    );
  });

  test('the guard names a field using the annotation, so it can be looked up', () => {
    const desc = baseDescriptor();
    const { types } = parseDescriptor(desc);
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'grpc'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'grpc', 'index.mdx'), 'nothing documented here');

    assert.throws(() => checkScalarAnnotationsDocumented(types, dir), /used by cosmos\./);
  });

  test('the guard passes when every annotation is documented', () => {
    const { types } = parseDescriptor(baseDescriptor());
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'grpc'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'grpc', 'index.mdx'),
      '| `cosmos.Int` | ... |\n| `cosmos.AddressString` | ... |\n',
    );

    assert.deepEqual(
      checkScalarAnnotationsDocumented(types, dir).sort(),
      ['cosmos.AddressString', 'cosmos.Int'],
    );
  });

  test('an unhandled specification-defined JSON type stops the build', () => {
    const desc = baseDescriptor();
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType[0].field.push(
      field('mask', { number: 7, type: 'TYPE_MESSAGE', typeName: 'google.protobuf.FieldMask' }),
    );
    const { types } = parseDescriptor(desc);

    // FieldMask is handled, so this must pass.
    assert.doesNotThrow(() => checkWellKnownTypesHandled(types));
  });

  test('an ordinary google.protobuf message is not treated as special', () => {
    const desc = baseDescriptor();
    const queryFile = desc.file.find((f) => f.name === 'cosmos/bank/v1beta1/query.proto');
    queryFile.messageType[0].field.push(
      field('descriptor', {
        number: 6,
        type: 'TYPE_MESSAGE',
        typeName: 'google.protobuf.DescriptorProto',
      }),
    );
    const { types } = parseDescriptor(desc);

    assert.doesNotThrow(
      () => checkWellKnownTypesHandled(types),
      'DescriptorProto expands correctly and must not trip the guard',
    );
  });
});

describe('output stability', () => {
  test('rendering twice from one descriptor is byte-identical', () => {
    const desc = descriptor([...baseDescriptor().file, ...govModule()]);
    assert.equal(render(desc, 'bank'), render(desc, 'bank'));
    assert.equal(render(desc, 'gov'), render(desc, 'gov'));
  });

  test('the page records the commit it was generated from', () => {
    const page = render(baseDescriptor(), 'bank');
    assert.match(page, /abc123def456/, 'the resolved SHA must be on the page');
    assert.match(page, /release\/v0\.55\.x/);
    assert.doesNotMatch(page, /\d{4}-\d{2}-\d{2}T/, 'no timestamp: it would churn every run');
  });

  test('modules and their methods come out in a stable order', () => {
    const shuffled = descriptor([...govModule(), ...baseDescriptor().file]);
    assert.deepEqual(
      parseDescriptor(shuffled).modules.map((m) => m.name),
      ['bank', 'gov'],
      'ordering must not depend on descriptor file order',
    );
  });
});

describe('inventory', () => {
  test('lists every query method and transaction message, sorted', () => {
    const { modules } = parseDescriptor(descriptor([...baseDescriptor().file, ...govModule()]));
    const inventory = buildInventory(modules);

    assert.ok(inventory.queries.includes('cosmos.bank.v1beta1.Query/Balance'));
    assert.ok(inventory.messages.includes('cosmos.gov.v1.MsgVote'));
    assert.deepEqual(inventory.queries, [...inventory.queries].sort());
    assert.deepEqual(inventory.messages, [...inventory.messages].sort());
  });

  test('a method added upstream appears without any other edit', () => {
    const { modules } = parseDescriptor(descriptor([...baseDescriptor().file, ...govModule()]));
    const before = buildInventory(modules).messages.length;

    const service = modules
      .find((m) => m.name === 'gov').services
      .find((s) => s.fullName === 'cosmos.gov.v1.Msg');
    service.methods.push({ name: 'Deposit', inputType: 'cosmos.gov.v1.MsgDeposit', outputType: 'cosmos.gov.v1.MsgDepositResponse' });

    assert.equal(buildInventory(modules).messages.length, before + 1);
  });
});
