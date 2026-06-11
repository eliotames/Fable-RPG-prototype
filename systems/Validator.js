/**
 * Tiny declarative shape validator. shapes.js describes every content type with
 * these combinators; PreloadScene (and the Node test suite) validate each JSON
 * file against its shape and report errors as "file → path.to.field: problem".
 *
 * A shape is {check(value, path, errors), describe()}. Keys named "//" are
 * always allowed and ignored, so designers can comment JSON freely.
 */

function err(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export const S = {
  str: {
    check(v, path, errors) {
      if (typeof v !== 'string') err(errors, path, `expected string, got ${typeOf(v)}`);
    },
    describe: () => 'string',
  },

  num: {
    check(v, path, errors) {
      if (typeof v !== 'number' || Number.isNaN(v)) err(errors, path, `expected number, got ${typeOf(v)}`);
    },
    describe: () => 'number',
  },

  int: {
    check(v, path, errors) {
      if (!Number.isInteger(v)) err(errors, path, `expected integer, got ${typeOf(v)}`);
    },
    describe: () => 'integer',
  },

  bool: {
    check(v, path, errors) {
      if (typeof v !== 'boolean') err(errors, path, `expected boolean, got ${typeOf(v)}`);
    },
    describe: () => 'boolean',
  },

  any: { check() {}, describe: () => 'any' },

  /** Value must be one of the listed literals. */
  oneOf(values) {
    return {
      check(v, path, errors) {
        if (!values.includes(v)) err(errors, path, `expected one of [${values.join(', ')}], got ${JSON.stringify(v)}`);
      },
      describe: () => `oneOf(${values.join('|')})`,
    };
  },

  /** Array where every element matches `item`. */
  arr(item) {
    return {
      check(v, path, errors) {
        if (!Array.isArray(v)) return err(errors, path, `expected array, got ${typeOf(v)}`);
        v.forEach((el, i) => item.check(el, `${path}[${i}]`, errors));
      },
      describe: () => `array of ${item.describe()}`,
    };
  },

  /**
   * Object with required `fields`. Pass optional fields in `opts.optional`.
   * Unknown keys are reported (catches typos like "atributeBonuses") unless
   * `opts.open` is true. Keys named "//" are always allowed (JSON comments).
   */
  obj(fields, opts = {}) {
    const optional = opts.optional ?? {};
    return {
      check(v, path, errors) {
        if (typeOf(v) !== 'object') return err(errors, path, `expected object, got ${typeOf(v)}`);
        for (const [key, shape] of Object.entries(fields)) {
          if (!(key in v)) err(errors, path, `missing required field "${key}" (${shape.describe()})`);
          else shape.check(v[key], `${path}.${key}`, errors);
        }
        for (const [key, shape] of Object.entries(optional)) {
          if (key in v) shape.check(v[key], `${path}.${key}`, errors);
        }
        if (!opts.open) {
          for (const key of Object.keys(v)) {
            if (key !== '//' && !(key in fields) && !(key in optional)) {
              err(errors, path, `unknown field "${key}" (allowed: ${[...Object.keys(fields), ...Object.keys(optional)].join(', ')})`);
            }
          }
        }
      },
      describe: () => 'object',
    };
  },

  /** Object used as a dictionary: every value matches `valueShape`. */
  dict(valueShape) {
    return {
      check(v, path, errors) {
        if (typeOf(v) !== 'object') return err(errors, path, `expected object (dictionary), got ${typeOf(v)}`);
        for (const [key, val] of Object.entries(v)) {
          if (key === '//') continue;
          valueShape.check(val, `${path}.${key}`, errors);
        }
      },
      describe: () => 'dictionary',
    };
  },
};

/**
 * Validate `value` against `shape`.
 * @returns {string[]} list of human-readable problems (empty when valid)
 */
export function validate(value, shape, rootPath = '$') {
  const errors = [];
  shape.check(value, rootPath, errors);
  return errors;
}
