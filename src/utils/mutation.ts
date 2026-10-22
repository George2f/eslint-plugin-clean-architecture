import type { TSESTree } from '@typescript-eslint/utils';
import type { Context } from '../types.js';

const mutators: Record<string, Set<string>> = {
  Array: new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']),
  Map: new Set(['set', 'delete', 'clear']), Set: new Set(['add', 'delete', 'clear']),
  WeakMap: new Set(['set', 'delete']), WeakSet: new Set(['add', 'delete']),
  Date: new Set(['setDate', 'setFullYear', 'setHours', 'setMilliseconds', 'setMinutes', 'setMonth',
    'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear', 'setUTCHours', 'setUTCMilliseconds',
    'setUTCMinutes', 'setUTCMonth', 'setUTCSeconds', 'setYear']),
};

function initializer(context: Context, node: TSESTree.Node, seen = new Set<string>()): TSESTree.Node | undefined {
  if (node.type !== 'Identifier') return node;
  if (seen.has(node.name)) return;
  const nextSeen = new Set(seen).add(node.name);
  let scope: ReturnType<Context['sourceCode']['getScope']> | null = context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) {
      const definition = variable.defs[0];
      return definition?.node.type === 'VariableDeclarator' && definition.node.init
        ? initializer(context, definition.node.init, nextSeen) : undefined;
    }
    scope = scope.upper;
  }
  return;
}

export function knownMutation(context: Context, node: TSESTree.CallExpression): boolean {
  if (node.callee.type !== 'MemberExpression' || node.callee.computed || node.callee.property.type !== 'Identifier') return false;
  const object = initializer(context, node.callee.object);
  const method = node.callee.property.name;
  if (object?.type === 'ArrayExpression') return mutators.Array?.has(method) ?? false;
  if (object?.type === 'NewExpression' && object.callee.type === 'Identifier') {
    const calleeName = object.callee.name;
    let scope: ReturnType<Context['sourceCode']['getScope']> | null = context.sourceCode.getScope(object.callee);
    while (scope) {
      const variable = scope.set.get(calleeName);
      if ((variable?.defs.length ?? 0) > 0) return false;
      scope = scope.upper;
    }
    return mutators[calleeName]?.has(method) ?? false;
  }
  return false;
}
