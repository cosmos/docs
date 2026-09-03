// Builders for synthetic FileDescriptorSet fragments.
//
// The tests fabricate upstream instead of downloading it. That keeps them fast
// and offline, and more importantly it lets a test express a change that has not
// happened yet: a module removed, a method added, a new scalar annotation. Those
// are exactly the cases a fixture captured from the real SDK cannot cover.

/** A field, in the shape buf emits. */
export function field(name, options = {}) {
  const {
    type = 'TYPE_STRING',
    typeName = null,
    repeated = false,
    deprecated = false,
    scalar = null,
    number = 1,
  } = options;

  return {
    name,
    number,
    label: repeated ? 'LABEL_REPEATED' : 'LABEL_OPTIONAL',
    type,
    jsonName: name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
    ...(typeName ? { typeName: `.${typeName}` } : {}),
    options: {
      ...(deprecated ? { deprecated: true } : {}),
      ...(scalar ? { '[cosmos_proto.scalar]': scalar } : {}),
    },
  };
}

export function message(name, fields = [], options = {}) {
  const { signer = null, aminoName = null } = options;
  return {
    name,
    field: fields,
    options: {
      ...(signer ? { '[cosmos.msg.v1.signer]': [signer] } : {}),
      ...(aminoName ? { '[amino.name]': aminoName } : {}),
    },
  };
}

export function enumType(name, values) {
  return { name, value: values.map((v) => ({ name: v })) };
}

export function method(name, inputType, outputType, options = {}) {
  const { http = null } = options;
  return {
    name,
    inputType: `.${inputType}`,
    outputType: `.${outputType}`,
    options: http ? { '[google.api.http]': { [http.verb]: http.path } } : {},
  };
}

export function service(name, methods) {
  return { name, method: methods };
}

export function file({ name, pkg, messages = [], enums = [], services = [] }) {
  return {
    name,
    package: pkg,
    messageType: messages,
    enumType: enums,
    service: services,
    sourceCodeInfo: { location: [] },
  };
}

export function descriptor(files) {
  return { file: files };
}

/**
 * A miniature but structurally faithful SDK: one module with a Query and a Msg
 * service, an enum, a nested type, a deprecated field, and a scalar annotation.
 * Tests mutate a copy of this to represent an upstream change.
 */
export function baseDescriptor() {
  return descriptor([
    file({
      name: 'cosmos/base/v1beta1/coin.proto',
      pkg: 'cosmos.base.v1beta1',
      messages: [
        message('Coin', [
          field('denom', { number: 1 }),
          field('amount', { number: 2, scalar: 'cosmos.Int' }),
        ]),
      ],
    }),
    file({
      name: 'cosmos/bank/v1beta1/query.proto',
      pkg: 'cosmos.bank.v1beta1',
      messages: [
        message('QueryBalanceRequest', [
          field('address', { number: 1, scalar: 'cosmos.AddressString' }),
          field('denom', { number: 2 }),
        ]),
        message('QueryBalanceResponse', [
          field('balance', { number: 1, type: 'TYPE_MESSAGE', typeName: 'cosmos.base.v1beta1.Coin' }),
        ]),
      ],
      services: [
        service('Query', [
          method(
            'Balance',
            'cosmos.bank.v1beta1.QueryBalanceRequest',
            'cosmos.bank.v1beta1.QueryBalanceResponse',
            { http: { verb: 'get', path: '/cosmos/bank/v1beta1/balances/{address}/by_denom' } },
          ),
        ]),
      ],
    }),
    file({
      name: 'cosmos/bank/v1beta1/tx.proto',
      pkg: 'cosmos.bank.v1beta1',
      messages: [
        message(
          'MsgSend',
          [
            field('from_address', { number: 1, scalar: 'cosmos.AddressString' }),
            field('to_address', { number: 2, scalar: 'cosmos.AddressString' }),
            field('amount', {
              number: 3,
              type: 'TYPE_MESSAGE',
              typeName: 'cosmos.base.v1beta1.Coin',
              repeated: true,
            }),
          ],
          { signer: 'from_address', aminoName: 'cosmos-sdk/MsgSend' },
        ),
        message('MsgSendResponse', []),
      ],
      services: [
        service('Msg', [
          method('Send', 'cosmos.bank.v1beta1.MsgSend', 'cosmos.bank.v1beta1.MsgSendResponse'),
        ]),
      ],
    }),
  ]);
}

/** A second module, used to represent one being added or removed upstream. */
export function govModule() {
  return [
    file({
      name: 'cosmos/gov/v1/gov.proto',
      pkg: 'cosmos.gov.v1',
      enums: [
        enumType('VoteOption', [
          'VOTE_OPTION_UNSPECIFIED',
          'VOTE_OPTION_YES',
          'VOTE_OPTION_NO',
        ]),
      ],
    }),
    file({
      name: 'cosmos/gov/v1/tx.proto',
      pkg: 'cosmos.gov.v1',
      messages: [
        message(
          'MsgVote',
          [
            field('proposal_id', { number: 1, type: 'TYPE_UINT64' }),
            field('voter', { number: 2, scalar: 'cosmos.AddressString' }),
            field('option', { number: 3, type: 'TYPE_ENUM', typeName: 'cosmos.gov.v1.VoteOption' }),
          ],
          { signer: 'voter', aminoName: 'cosmos-sdk/v1/MsgVote' },
        ),
        message('MsgVoteResponse', []),
      ],
      services: [
        service('Msg', [
          method('Vote', 'cosmos.gov.v1.MsgVote', 'cosmos.gov.v1.MsgVoteResponse'),
        ]),
      ],
    }),
  ];
}

/** The same gov module at a second package version, to force heading collisions. */
export function govV1Beta1() {
  return [
    file({
      name: 'cosmos/gov/v1beta1/query.proto',
      pkg: 'cosmos.gov.v1beta1',
      messages: [
        message('QueryProposalsRequest', [field('depositor', { number: 1 })]),
        message('QueryProposalsResponse', [field('total', { number: 1, type: 'TYPE_UINT64' })]),
      ],
      services: [
        service('Query', [
          method(
            'Proposals',
            'cosmos.gov.v1beta1.QueryProposalsRequest',
            'cosmos.gov.v1beta1.QueryProposalsResponse',
            { http: { verb: 'get', path: '/cosmos/gov/v1beta1/proposals' } },
          ),
        ]),
      ],
    }),
    file({
      name: 'cosmos/gov/v1/query.proto',
      pkg: 'cosmos.gov.v1',
      messages: [
        message('QueryProposalsRequest', [field('depositor', { number: 1 })]),
        message('QueryProposalsResponse', [field('total', { number: 1, type: 'TYPE_UINT64' })]),
      ],
      services: [
        service('Query', [
          method(
            'Proposals',
            'cosmos.gov.v1.QueryProposalsRequest',
            'cosmos.gov.v1.QueryProposalsResponse',
            { http: { verb: 'get', path: '/cosmos/gov/v1/proposals' } },
          ),
        ]),
      ],
    }),
  ];
}

/** A minimal Swagger 2.0 document matching a set of routes. */
export function swagger(paths) {
  return {
    swagger: '2.0',
    info: { title: 'test', version: '1.0.0' },
    paths: Object.fromEntries(
      Object.entries(paths).map(([route, { verb = 'get', operationId, summary }]) => [
        route,
        {
          [verb]: {
            operationId,
            summary,
            responses: { 200: { description: 'ok', schema: { type: 'object' } } },
          },
        },
      ]),
    ),
  };
}
