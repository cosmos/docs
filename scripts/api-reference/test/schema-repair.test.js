// Tests for the repair of response fields upstream's spec omits.
//
// Upstream's gateway swagger is generated separately from the protos and lags
// them, so the generator adds a field the descriptor defines and the spec does
// not. That runs against every response schema in a 47,000-line published
// document, and a wrong shape there is a wrong shape for every client generated
// from it, so each proto type class is pinned here rather than left to one
// end-to-end conformance run.
//
// The shapes asserted are the ones upstream itself emits for the same types
// elsewhere in this document: 64-bit integers as strings, 32-bit as integers,
// unsigned 32-bit widened because it does not fit an int32, bytes base64,
// enums as their value names.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  schemaForField,
  correctResponseSchemas,
  findSchemaDrift,
} from '../lib/openapi.js';

function field(overrides) {
  return {
    name: 'f', repeated: false, type: null, typeName: null, comment: '', ...overrides,
  };
}

function message(fullName, fields, extra = {}) {
  return { fullName, name: fullName.split('.').pop(), fields, isMapEntry: false, ...extra };
}

const COIN = message('cosmos.base.v1beta1.Coin', [
  field({ name: 'denom', type: 'string' }),
  field({ name: 'amount', type: 'string' }),
]);

// map<string, string>: a repeated synthetic entry message, which is how the
// descriptor represents every map.
const STRING_MAP_ENTRY = message('cosmos.demo.v1.Thing.LabelsEntry', [
  field({ name: 'key', type: 'string' }),
  field({ name: 'value', type: 'string' }),
], { isMapEntry: true });

const BOND_STATUS = {
  fullName: 'cosmos.staking.v1beta1.BondStatus',
  values: [
    { name: 'BOND_STATUS_UNSPECIFIED' },
    { name: 'BOND_STATUS_UNBONDED' },
    { name: 'BOND_STATUS_BONDED' },
  ],
};

const types = {
  messages: new Map([
    [COIN.fullName, COIN],
    [STRING_MAP_ENTRY.fullName, STRING_MAP_ENTRY],
  ]),
  enums: new Map([[BOND_STATUS.fullName, BOND_STATUS]]),
};

function shapeOf(overrides) {
  const declined = [];
  const schema = schemaForField(field(overrides), types, declined, 'p');
  return { schema, declined };
}

describe('schemaForField: scalars', () => {
  const cases = [
    ['int64 is a string, because JSON numbers lose precision past 2^53',
      'int64', { type: 'string', format: 'int64' }],
    ['uint64 likewise', 'uint64', { type: 'string', format: 'uint64' }],
    ['sfixed64 is an int64 in the same encoding', 'sfixed64', { type: 'string', format: 'int64' }],
    ['int32 fits a JSON number', 'int32', { type: 'integer', format: 'int32' }],
    ['uint32 is widened: it does not fit an int32', 'uint32', { type: 'integer', format: 'int64' }],
    ['fixed32 is widened for the same reason', 'fixed32', { type: 'integer', format: 'int64' }],
    ['bytes is base64', 'bytes', { type: 'string', format: 'byte' }],
    ['bool', 'bool', { type: 'boolean' }],
    ['string', 'string', { type: 'string' }],
    ['double', 'double', { type: 'number', format: 'double' }],
  ];

  for (const [name, type, expected] of cases) {
    test(name, () => {
      const { schema, declined } = shapeOf({ type });
      assert.deepEqual(schema, expected);
      assert.deepEqual(declined, []);
    });
  }
});

describe('schemaForField: named types', () => {
  test('an enum lists its value names and defaults to the unspecified one', () => {
    const { schema, declined } = shapeOf({ typeName: BOND_STATUS.fullName });
    assert.deepEqual(schema, {
      type: 'string',
      enum: ['BOND_STATUS_UNSPECIFIED', 'BOND_STATUS_UNBONDED', 'BOND_STATUS_BONDED'],
      default: 'BOND_STATUS_UNSPECIFIED',
    });
    assert.deepEqual(declined, []);
  });

  test('a nested message is an empty shell the recursion fills', () => {
    const { schema } = shapeOf({ typeName: COIN.fullName });
    assert.deepEqual(schema, { type: 'object', properties: {} });
  });

  test('a Timestamp is a date-time string, not its proto fields', () => {
    const { schema } = shapeOf({ typeName: 'google.protobuf.Timestamp' });
    assert.deepEqual(schema, { type: 'string', format: 'date-time' });
  });

  test('an Any stays open: it is inlined with @type', () => {
    const { schema } = shapeOf({ typeName: 'google.protobuf.Any' });
    assert.deepEqual(schema, { type: 'object', properties: { '@type': { type: 'string' } } });
    assert.equal(schema.additionalProperties, undefined);
  });
});

describe('schemaForField: repetition', () => {
  test('a repeated scalar is an array of that scalar', () => {
    const { schema } = shapeOf({ repeated: true, type: 'string' });
    assert.deepEqual(schema, { type: 'array', items: { type: 'string' } });
  });

  test('a repeated message is an array of shells', () => {
    const { schema } = shapeOf({ repeated: true, typeName: COIN.fullName });
    assert.deepEqual(schema, { type: 'array', items: { type: 'object', properties: {} } });
  });

  test("a map is an object, not an array of the descriptor's synthetic entries", () => {
    // The descriptor marks a map field LABEL_REPEATED, so anything that trusts
    // `repeated` alone emits an array of {key, value} pairs for what JSON
    // renders as a plain object.
    const { schema, declined } = shapeOf({
      name: 'labels', repeated: true, typeName: STRING_MAP_ENTRY.fullName,
    });
    assert.equal(schema.type, 'object');
    assert.notEqual(schema.type, 'array');
    assert.deepEqual(schema.additionalProperties, { type: 'string' });
    assert.deepEqual(declined, []);
  });

  test('a map of messages keys onto the value shell', () => {
    const entry = message('cosmos.demo.v1.Thing.CoinsEntry', [
      field({ name: 'key', type: 'string' }),
      field({ name: 'value', typeName: COIN.fullName }),
    ], { isMapEntry: true });
    const local = { messages: new Map([...types.messages, [entry.fullName, entry]]), enums: types.enums };
    const schema = schemaForField(
      field({ name: 'coins', repeated: true, typeName: entry.fullName }), local, [], 'p',
    );
    assert.deepEqual(schema, {
      type: 'object',
      additionalProperties: { type: 'object', properties: {} },
    });
  });

  test("a description goes on the array, not on its items, as upstream writes it", () => {
    const { schema } = shapeOf({ repeated: true, type: 'string', comment: '  what it holds.  ' });
    assert.equal(schema.description, 'what it holds.');
    assert.equal(schema.items.description, undefined);
  });
});

describe('schemaForField: what it declines to describe', () => {
  test('a type with no precedent is left open and said so', () => {
    const { schema, declined } = shapeOf({ name: 'x', typeName: 'some.unknown.Type' });
    assert.deepEqual(schema, { type: 'object' });
    assert.equal(declined.length, 1);
    assert.match(declined[0], /some\.unknown\.Type/);
    assert.match(declined[0], /open object/);
  });

  test('an unrecognised scalar falls back to a string and is reported', () => {
    const { schema, declined } = shapeOf({ type: 'quaternion' });
    assert.deepEqual(schema, { type: 'string' });
    assert.equal(declined.length, 1);
    assert.match(declined[0], /quaternion/);
  });

  test('a field that is neither scalar nor named is reported', () => {
    const { declined } = shapeOf({});
    assert.equal(declined.length, 1);
  });

  test('a well-described field reports nothing', () => {
    assert.deepEqual(shapeOf({ type: 'uint64' }).declined, []);
    assert.deepEqual(shapeOf({ typeName: COIN.fullName }).declined, []);
  });
});

// A miniature of the real thing: upstream's spec describes one field of a
// two-field response, exactly the v0.55 case that made the gate unpassable.
function fixture() {
  const params = message('cosmos.demo.v1.Params', [
    field({ name: 'known', type: 'string' }),
    field({ name: 'added_upstream', type: 'uint64' }),
    field({ name: 'fee', typeName: COIN.fullName, comment: 'the fee.' }),
  ]);
  const response = message('cosmos.demo.v1.QueryParamsResponse', [
    field({ name: 'params', typeName: params.fullName }),
  ]);
  const local = {
    messages: new Map([...types.messages, [params.fullName, params], [response.fullName, response]]),
    enums: types.enums,
  };
  const spec = {
    paths: {
      '/cosmos/demo/v1/params': {
        get: {
          'x-grpc-method': 'cosmos.demo.v1.Query/Params',
          responses: {
            200: {
              content: {
                '*/*': {
                  schema: {
                    type: 'object',
                    properties: {
                      params: { type: 'object', properties: { known: { type: 'string' } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  const byOperation = new Map([['cosmos.demo.v1.Query/Params', response.fullName]]);
  return { spec, types: local, byOperation };
}

describe('correctResponseSchemas repairs what upstream omits', () => {
  test('a field the protos define and the spec omits is added', () => {
    const { spec, types: local, byOperation } = fixture();
    const result = correctResponseSchemas(spec, local, byOperation);
    const params = spec.paths['/cosmos/demo/v1/params'].get
      .responses[200].content['*/*'].schema.properties.params;

    assert.deepEqual(params.properties.added_upstream, { type: 'string', format: 'uint64' });
    assert.equal(params.properties.fee.type, 'object');
    assert.deepEqual(params.properties.fee.properties.denom, { type: 'string' });
    assert.equal(params.properties.fee.nullable, true);
    assert.equal(params.properties.fee.additionalProperties, false);
    // added_upstream, fee, and the two fields of the Coin the recursion filled.
    assert.equal(result.added, 4);
    assert.deepEqual(result.declined, []);
  });

  test('a field upstream did describe is left as upstream wrote it', () => {
    const { spec, types: local, byOperation } = fixture();
    correctResponseSchemas(spec, local, byOperation);
    const params = spec.paths['/cosmos/demo/v1/params'].get
      .responses[200].content['*/*'].schema.properties.params;
    assert.deepEqual(params.properties.known, { type: 'string' });
  });

  test('the drift the repair was for is gone afterwards', () => {
    const { spec, types: local, byOperation } = fixture();
    assert.equal(findSchemaDrift(spec, local, byOperation).length, 2);
    correctResponseSchemas(spec, local, byOperation);
    assert.deepEqual(findSchemaDrift(spec, local, byOperation), []);
  });

  test('an Any is never expanded into type_url and value', () => {
    const any = message('google.protobuf.Any', [
      field({ name: 'type_url', type: 'string' }),
      field({ name: 'value', type: 'bytes' }),
    ]);
    const response = message('cosmos.demo.v1.Wrapped', [
      field({ name: 'content', typeName: 'google.protobuf.Any' }),
    ]);
    const local = {
      messages: new Map([[any.fullName, any], [response.fullName, response]]),
      enums: new Map(),
    };
    const schema = {
      type: 'object',
      properties: { content: { type: 'object', properties: { '@type': { type: 'string' } } } },
    };
    const spec = {
      paths: {
        '/x': {
          get: {
            'x-grpc-method': 'm',
            responses: { 200: { content: { '*/*': { schema } } } },
          },
        },
      },
    };
    correctResponseSchemas(spec, local, new Map([['m', response.fullName]]));
    assert.deepEqual(Object.keys(schema.properties.content.properties), ['@type']);
    // A message carrying an Any must stay open: the concrete type's own fields
    // are inlined beside @type.
    assert.equal(schema.additionalProperties, undefined);
  });

  test('a field it could not describe is reported rather than left silent', () => {
    const response = message('cosmos.demo.v1.Odd', [
      field({ name: 'mystery', typeName: 'not.in.The Descriptor' }),
    ]);
    const local = { messages: new Map([[response.fullName, response]]), enums: new Map() };
    const schema = { type: 'object', properties: {} };
    const spec = {
      paths: {
        '/x': { get: { 'x-grpc-method': 'm', responses: { 200: { content: { '*/*': { schema } } } } } },
      },
    };
    const result = correctResponseSchemas(spec, local, new Map([['m', response.fullName]]));
    assert.equal(result.declined.length, 1);
    assert.match(result.declined[0], /cosmos\.demo\.v1\.Odd\.mystery/);
  });
});
