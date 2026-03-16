var e = require("graphql");

var t = require("crypto");

exports.ts = void 0;

class CharacterStream {
  constructor(e) {
    this._start = 0;
    this._pos = 0;
    this.getStartOfToken = () => this._start;
    this.getCurrentPosition = () => this._pos;
    this.eol = () => this._sourceText.length === this._pos;
    this.sol = () => 0 === this._pos;
    this.peek = () => this._sourceText.charAt(this._pos) || null;
    this.next = () => {
      var e = this._sourceText.charAt(this._pos);
      this._pos++;
      return e;
    };
    this.eat = e => {
      if (this._testNextCharacter(e)) {
        this._start = this._pos;
        this._pos++;
        return this._sourceText.charAt(this._pos - 1);
      }
      return;
    };
    this.eatWhile = e => {
      var t = this._testNextCharacter(e);
      var i = !1;
      if (t) {
        i = t;
        this._start = this._pos;
      }
      while (t) {
        this._pos++;
        t = this._testNextCharacter(e);
        i = !0;
      }
      return i;
    };
    this.eatSpace = () => this.eatWhile(/[\s\u00a0]/);
    this.skipToEnd = () => {
      this._pos = this._sourceText.length;
    };
    this.skipTo = e => {
      this._pos = e;
    };
    this.match = (e, t = !0, i = !1) => {
      var r = null;
      var s = null;
      if ("string" == typeof e) {
        s = new RegExp(e, i ? "i" : "g").test(this._sourceText.slice(this._pos, this._pos + e.length));
        r = e;
      } else if (e instanceof RegExp) {
        r = null == (s = this._sourceText.slice(this._pos).match(e)) ? void 0 : s[0];
      }
      if (null != s && ("string" == typeof e || s instanceof Array && this._sourceText.startsWith(s[0], this._pos))) {
        if (t) {
          this._start = this._pos;
          if (r && r.length) {
            this._pos += r.length;
          }
        }
        return s;
      }
      return !1;
    };
    this.backUp = e => {
      this._pos -= e;
    };
    this.column = () => this._pos;
    this.indentation = () => {
      var e = this._sourceText.match(/\s*/);
      var t = 0;
      if (e && 0 !== e.length) {
        var i = e[0];
        var r = 0;
        while (i.length > r) {
          if (9 === i.charCodeAt(r)) {
            t += 2;
          } else {
            t++;
          }
          r++;
        }
      }
      return t;
    };
    this.current = () => this._sourceText.slice(this._start, this._pos);
    this._sourceText = e;
  }
  _testNextCharacter(e) {
    var t = this._sourceText.charAt(this._pos);
    var i = !1;
    if ("string" == typeof e) {
      i = t === e;
    } else {
      i = e instanceof RegExp ? e.test(t) : e(t);
    }
    return i;
  }
}

function opt(e) {
  return {
    ofRule: e
  };
}

function list(e, t) {
  return {
    ofRule: e,
    isList: !0,
    separator: t
  };
}

function t$1(e, t) {
  return {
    style: t,
    match: t => t.kind === e
  };
}

function p$1(e, t) {
  return {
    style: t || "punctuation",
    match: t => "Punctuation" === t.kind && t.value === e
  };
}

var isIgnored = e => " " === e || "\t" === e || "," === e || "\n" === e || "\r" === e || "\ufeff" === e || " " === e;

var i = {
  Name: /^[_A-Za-z][_0-9A-Za-z]*/,
  Punctuation: /^(?:!|\$|\(|\)|\.\.\.|:|=|&|@|\[|]|\{|\||\})/,
  Number: /^-?(?:0|(?:[1-9][0-9]*))(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?/,
  String: /^(?:"""(?:\\"""|[^"]|"[^"]|""[^"])*(?:""")?|"(?:[^"\\]|\\(?:"|\/|\\|b|f|n|r|t|u[0-9a-fA-F]{4}))*"?)/,
  Comment: /^#.*/
};

var r = {
  Document: [ list("Definition") ],
  Definition(t) {
    switch (t.value) {
     case "{":
      return "ShortQuery";

     case "query":
      return "Query";

     case "mutation":
      return "Mutation";

     case "subscription":
      return "Subscription";

     case "fragment":
      return e.Kind.FRAGMENT_DEFINITION;

     case "schema":
      return "SchemaDef";

     case "scalar":
      return "ScalarDef";

     case "type":
      return "ObjectTypeDef";

     case "interface":
      return "InterfaceDef";

     case "union":
      return "UnionDef";

     case "enum":
      return "EnumDef";

     case "input":
      return "InputDef";

     case "extend":
      return "ExtendDef";

     case "directive":
      return "DirectiveDef";
    }
  },
  ShortQuery: [ "SelectionSet" ],
  Query: [ word("query"), opt(name$1("def")), opt("VariableDefinitions"), list("Directive"), "SelectionSet" ],
  Mutation: [ word("mutation"), opt(name$1("def")), opt("VariableDefinitions"), list("Directive"), "SelectionSet" ],
  Subscription: [ word("subscription"), opt(name$1("def")), opt("VariableDefinitions"), list("Directive"), "SelectionSet" ],
  VariableDefinitions: [ p$1("("), list("VariableDefinition"), p$1(")") ],
  VariableDefinition: [ "Variable", p$1(":"), "Type", opt("DefaultValue") ],
  Variable: [ p$1("$", "variable"), name$1("variable") ],
  DefaultValue: [ p$1("="), "Value" ],
  SelectionSet: [ p$1("{"), list("Selection"), p$1("}") ],
  Selection: (e, t) => "..." === e.value ? t.match(/[\s\u00a0,]*(on\b|@|{)/, !1) ? "InlineFragment" : "FragmentSpread" : t.match(/[\s\u00a0,]*:/, !1) ? "AliasedField" : "Field",
  AliasedField: [ name$1("property"), p$1(":"), name$1("qualifier"), opt("Arguments"), list("Directive"), opt("SelectionSet") ],
  Field: [ name$1("property"), opt("Arguments"), list("Directive"), opt("SelectionSet") ],
  Arguments: [ p$1("("), list("Argument"), p$1(")") ],
  Argument: [ name$1("attribute"), p$1(":"), "Value" ],
  FragmentSpread: [ p$1("..."), name$1("def"), list("Directive") ],
  InlineFragment: [ p$1("..."), opt("TypeCondition"), list("Directive"), "SelectionSet" ],
  FragmentDefinition: [ word("fragment"), opt(function butNot(e, t) {
    var i = e.match;
    e.match = e => {
      var r = !1;
      if (i) {
        r = i(e);
      }
      return r && t.every(t => t.match && !t.match(e));
    };
    return e;
  }(name$1("def"), [ word("on") ])), "TypeCondition", list("Directive"), "SelectionSet" ],
  TypeCondition: [ word("on"), "NamedType" ],
  Value(e) {
    switch (e.kind) {
     case "Number":
      return "NumberValue";

     case "String":
      return "StringValue";

     case "Punctuation":
      switch (e.value) {
       case "[":
        return "ListValue";

       case "{":
        return "ObjectValue";

       case "$":
        return "Variable";

       case "&":
        return "NamedType";
      }
      return null;

     case "Name":
      switch (e.value) {
       case "true":
       case "false":
        return "BooleanValue";
      }
      if ("null" === e.value) {
        return "NullValue";
      }
      return "EnumValue";
    }
  },
  NumberValue: [ t$1("Number", "number") ],
  StringValue: [ {
    style: "string",
    match: e => "String" === e.kind,
    update(e, t) {
      if (t.value.startsWith('"""')) {
        e.inBlockstring = !t.value.slice(3).endsWith('"""');
      }
    }
  } ],
  BooleanValue: [ t$1("Name", "builtin") ],
  NullValue: [ t$1("Name", "keyword") ],
  EnumValue: [ name$1("string-2") ],
  ListValue: [ p$1("["), list("Value"), p$1("]") ],
  ObjectValue: [ p$1("{"), list("ObjectField"), p$1("}") ],
  ObjectField: [ name$1("attribute"), p$1(":"), "Value" ],
  Type: e => "[" === e.value ? "ListType" : "NonNullType",
  ListType: [ p$1("["), "Type", p$1("]"), opt(p$1("!")) ],
  NonNullType: [ "NamedType", opt(p$1("!")) ],
  NamedType: [ function type$1(e) {
    return {
      style: e,
      match: e => "Name" === e.kind,
      update(e, t) {
        var i;
        if (null === (i = e.prevState) || void 0 === i ? void 0 : i.prevState) {
          e.name = t.value;
          e.prevState.prevState.type = t.value;
        }
      }
    };
  }("atom") ],
  Directive: [ p$1("@", "meta"), name$1("meta"), opt("Arguments") ],
  DirectiveDef: [ word("directive"), p$1("@", "meta"), name$1("meta"), opt("ArgumentsDef"), word("on"), list("DirectiveLocation", p$1("|")) ],
  InterfaceDef: [ word("interface"), name$1("atom"), opt("Implements"), list("Directive"), p$1("{"), list("FieldDef"), p$1("}") ],
  Implements: [ word("implements"), list("NamedType", p$1("&")) ],
  DirectiveLocation: [ name$1("string-2") ],
  SchemaDef: [ word("schema"), list("Directive"), p$1("{"), list("OperationTypeDef"), p$1("}") ],
  OperationTypeDef: [ name$1("keyword"), p$1(":"), name$1("atom") ],
  ScalarDef: [ word("scalar"), name$1("atom"), list("Directive") ],
  ObjectTypeDef: [ word("type"), name$1("atom"), opt("Implements"), list("Directive"), p$1("{"), list("FieldDef"), p$1("}") ],
  FieldDef: [ name$1("property"), opt("ArgumentsDef"), p$1(":"), "Type", list("Directive") ],
  ArgumentsDef: [ p$1("("), list("InputValueDef"), p$1(")") ],
  InputValueDef: [ name$1("attribute"), p$1(":"), "Type", opt("DefaultValue"), list("Directive") ],
  UnionDef: [ word("union"), name$1("atom"), list("Directive"), p$1("="), list("UnionMember", p$1("|")) ],
  UnionMember: [ "NamedType" ],
  EnumDef: [ word("enum"), name$1("atom"), list("Directive"), p$1("{"), list("EnumValueDef"), p$1("}") ],
  EnumValueDef: [ name$1("string-2"), list("Directive") ],
  InputDef: [ word("input"), name$1("atom"), list("Directive"), p$1("{"), list("InputValueDef"), p$1("}") ],
  ExtendDef: [ word("extend"), "ExtensionDefinition" ],
  ExtensionDefinition(t) {
    switch (t.value) {
     case "schema":
      return e.Kind.SCHEMA_EXTENSION;

     case "scalar":
      return e.Kind.SCALAR_TYPE_EXTENSION;

     case "type":
      return e.Kind.OBJECT_TYPE_EXTENSION;

     case "interface":
      return e.Kind.INTERFACE_TYPE_EXTENSION;

     case "union":
      return e.Kind.UNION_TYPE_EXTENSION;

     case "enum":
      return e.Kind.ENUM_TYPE_EXTENSION;

     case "input":
      return e.Kind.INPUT_OBJECT_TYPE_EXTENSION;
    }
  },
  [e.Kind.SCHEMA_EXTENSION]: [ "SchemaDef" ],
  [e.Kind.SCALAR_TYPE_EXTENSION]: [ "ScalarDef" ],
  [e.Kind.OBJECT_TYPE_EXTENSION]: [ "ObjectTypeDef" ],
  [e.Kind.INTERFACE_TYPE_EXTENSION]: [ "InterfaceDef" ],
  [e.Kind.UNION_TYPE_EXTENSION]: [ "UnionDef" ],
  [e.Kind.ENUM_TYPE_EXTENSION]: [ "EnumDef" ],
  [e.Kind.INPUT_OBJECT_TYPE_EXTENSION]: [ "InputDef" ]
};

function word(e) {
  return {
    style: "keyword",
    match: t => "Name" === t.kind && t.value === e
  };
}

function name$1(e) {
  return {
    style: e,
    match: e => "Name" === e.kind,
    update(e, t) {
      e.name = t.value;
    }
  };
}

function onlineParser(t = {
  eatWhitespace: e => e.eatWhile(isIgnored),
  lexRules: i,
  parseRules: r,
  editorConfig: {}
}) {
  return {
    startState() {
      var i = {
        level: 0,
        step: 0,
        name: null,
        kind: null,
        type: null,
        rule: null,
        needsSeparator: !1,
        prevState: null
      };
      pushRule(t.parseRules, i, e.Kind.DOCUMENT);
      return i;
    },
    token: (e, i) => function getToken(e, t, i) {
      var r;
      if (t.inBlockstring) {
        if (e.match(/.*"""/)) {
          t.inBlockstring = !1;
          return "string";
        }
        e.skipToEnd();
        return "string";
      }
      var {lexRules: a, parseRules: n, eatWhitespace: o, editorConfig: l} = i;
      if (t.rule && 0 === t.rule.length) {
        popRule(t);
      } else if (t.needsAdvance) {
        t.needsAdvance = !1;
        advanceRule(t, !0);
      }
      if (e.sol()) {
        var u = (null == l ? void 0 : l.tabSize) || 2;
        t.indentLevel = Math.floor(e.indentation() / u);
      }
      if (o(e)) {
        return "ws";
      }
      var p = function lex(e, t) {
        var i = Object.keys(e);
        for (var r = 0; r < i.length; r++) {
          var s = t.match(e[i[r]]);
          if (s && s instanceof Array) {
            return {
              kind: i[r],
              value: s[0]
            };
          }
        }
      }(a, e);
      if (!p) {
        if (!e.match(/\S+/)) {
          e.match(/\s/);
        }
        pushRule(s, t, "Invalid");
        return "invalidchar";
      }
      if ("Comment" === p.kind) {
        pushRule(s, t, "Comment");
        return "comment";
      }
      var f = assign({}, t);
      if ("Punctuation" === p.kind) {
        if (/^[{([]/.test(p.value)) {
          if (void 0 !== t.indentLevel) {
            t.levels = (t.levels || []).concat(t.indentLevel + 1);
          }
        } else if (/^[})\]]/.test(p.value)) {
          var c = t.levels = (t.levels || []).slice(0, -1);
          if (t.indentLevel && c.length > 0 && c.at(-1) < t.indentLevel) {
            t.indentLevel = c.at(-1);
          }
        }
      }
      while (t.rule) {
        var h = "function" == typeof t.rule ? 0 === t.step ? t.rule(p, e) : null : t.rule[t.step];
        if (t.needsSeparator) {
          h = null == h ? void 0 : h.separator;
        }
        if (h) {
          if (h.ofRule) {
            h = h.ofRule;
          }
          if ("string" == typeof h) {
            pushRule(n, t, h);
            continue;
          }
          if (null === (r = h.match) || void 0 === r ? void 0 : r.call(h, p)) {
            if (h.update) {
              h.update(t, p);
            }
            if ("Punctuation" === p.kind) {
              advanceRule(t, !0);
            } else {
              t.needsAdvance = !0;
            }
            return h.style;
          }
        }
        unsuccessful(t);
      }
      assign(t, f);
      pushRule(s, t, "Invalid");
      return "invalidchar";
    }(e, i, t)
  };
}

function assign(e, t) {
  var i = Object.keys(t);
  for (var r = 0; r < i.length; r++) {
    e[i[r]] = t[i[r]];
  }
  return e;
}

var s = {
  Invalid: [],
  Comment: []
};

function pushRule(e, t, i) {
  if (!e[i]) {
    throw new TypeError("Unknown rule: " + i);
  }
  t.prevState = Object.assign({}, t);
  t.kind = i;
  t.name = null;
  t.type = null;
  t.rule = e[i];
  t.step = 0;
  t.needsSeparator = !1;
}

function popRule(e) {
  if (!e.prevState) {
    return;
  }
  e.kind = e.prevState.kind;
  e.name = e.prevState.name;
  e.type = e.prevState.type;
  e.rule = e.prevState.rule;
  e.step = e.prevState.step;
  e.needsSeparator = e.prevState.needsSeparator;
  e.prevState = e.prevState.prevState;
}

function advanceRule(e, t) {
  var i;
  if (isList(e) && e.rule) {
    var r = e.rule[e.step];
    if (r.separator) {
      var {separator: s} = r;
      e.needsSeparator = !e.needsSeparator;
      if (!e.needsSeparator && s.ofRule) {
        return;
      }
    }
    if (t) {
      return;
    }
  }
  e.needsSeparator = !1;
  e.step++;
  while (e.rule && !(Array.isArray(e.rule) && e.step < e.rule.length)) {
    popRule(e);
    if (e.rule) {
      if (isList(e)) {
        if (null === (i = e.rule) || void 0 === i ? void 0 : i[e.step].separator) {
          e.needsSeparator = !e.needsSeparator;
        }
      } else {
        e.needsSeparator = !1;
        e.step++;
      }
    }
  }
}

function isList(e) {
  var t = Array.isArray(e.rule) && "string" != typeof e.rule[e.step] && e.rule[e.step];
  return t && t.isList;
}

function unsuccessful(e) {
  while (e.rule && (!Array.isArray(e.rule) || !e.rule[e.step].ofRule)) {
    popRule(e);
  }
  if (e.rule) {
    advanceRule(e, !1);
  }
}

function getDefaultExportFromCjs(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}

class Range {
  constructor(e, t) {
    this.containsPosition = e => {
      if (this.start.line === e.line) {
        return this.start.character <= e.character;
      }
      if (this.end.line === e.line) {
        return this.end.character >= e.character;
      }
      return this.start.line <= e.line && this.end.line >= e.line;
    };
    this.start = e;
    this.end = t;
  }
  setStart(e, t) {
    this.start = new Position(e, t);
  }
  setEnd(e, t) {
    this.end = new Position(e, t);
  }
}

class Position {
  constructor(e, t) {
    this.lessThanOrEqualTo = e => this.line < e.line || this.line === e.line && this.character <= e.character;
    this.line = e;
    this.character = t;
  }
  setLine(e) {
    this.line = e;
  }
  setCharacter(e) {
    this.character = e;
  }
}

var a = [ e.LoneSchemaDefinitionRule, e.UniqueOperationTypesRule, e.UniqueTypeNamesRule, e.UniqueEnumValueNamesRule, e.UniqueFieldDefinitionNamesRule, e.UniqueDirectiveNamesRule, e.KnownTypeNamesRule, e.KnownDirectivesRule, e.UniqueDirectivesPerLocationRule, e.PossibleTypeExtensionsRule, e.UniqueArgumentNamesRule, e.UniqueInputFieldNamesRule ];

var n = "Error", o = "Warning", l = "Information", u = "Hint";

var p = {
  [n]: 1,
  [o]: 2,
  [l]: 3,
  [u]: 4
};

var invariant = (e, t) => {
  if (!e) {
    throw new Error(t);
  }
};

function getDiagnostics(t, i = null, r, s, n) {
  var o, l;
  var u = null;
  var f = "";
  if (n) {
    f = "string" == typeof n ? n : n.reduce((t, i) => t + e.print(i) + "\n\n", "");
  }
  var c = f ? `${t}\n\n${f}` : t;
  try {
    u = e.parse(c);
  } catch (t) {
    if (t instanceof e.GraphQLError) {
      var h = function getRange(e, t) {
        var i = onlineParser();
        var r = i.startState();
        var s = t.split("\n");
        invariant(s.length >= e.line, "Query text must have more lines than where the error happened");
        var a = null;
        for (var n = 0; n < e.line; n++) {
          a = new CharacterStream(s[n]);
          while (!a.eol()) {
            if ("invalidchar" === i.token(a, r)) {
              break;
            }
          }
        }
        invariant(a, "Expected Parser stream to be available.");
        var o = e.line - 1;
        var l = a.getStartOfToken();
        var u = a.getCurrentPosition();
        return new Range(new Position(o, l), new Position(o, u));
      }(null !== (l = null === (o = t.locations) || void 0 === o ? void 0 : o[0]) && void 0 !== l ? l : {
        line: 0,
        column: 0
      }, c);
      return [ {
        severity: p.Error,
        message: t.message,
        source: "GraphQL: Syntax",
        range: h
      } ];
    }
    throw t;
  }
  return function validateQuery(t, i = null, r, s) {
    if (!i) {
      return [];
    }
    var n = function validateWithCustomRules(t, i, r, s, n) {
      var o = e.specifiedRules.filter(t => {
        if (t === e.NoUnusedFragmentsRule || t === e.ExecutableDefinitionsRule) {
          return !1;
        }
        if (s && t === e.KnownFragmentNamesRule) {
          return !1;
        }
        return !0;
      });
      if (r) {
        Array.prototype.push.apply(o, r);
      }
      if (n) {
        Array.prototype.push.apply(o, a);
      }
      return e.validate(t, i, o).filter(t => {
        if (t.message.includes("Unknown directive") && t.nodes) {
          var i = t.nodes[0];
          if (i && i.kind === e.Kind.DIRECTIVE) {
            var r = i.name.value;
            if ("arguments" === r || "argumentDefinitions" === r) {
              return !1;
            }
          }
        }
        return !0;
      });
    }(i, t, r, s).flatMap(e => annotations(e, p.Error, "Validation"));
    var o = e.validate(i, t, [ e.NoDeprecatedCustomRule ]).flatMap(e => annotations(e, p.Warning, "Deprecation"));
    return n.concat(o);
  }(u, i, r, s);
}

function annotations(e, t, i) {
  if (!e.nodes) {
    return [];
  }
  var r = [];
  for (var [s, a] of e.nodes.entries()) {
    var n = "Variable" !== a.kind && "name" in a && void 0 !== a.name ? a.name : "variable" in a && void 0 !== a.variable ? a.variable : a;
    if (n) {
      invariant(e.locations, "GraphQL validation error requires locations.");
      var o = e.locations[s];
      var l = getLocation(n);
      var u = o.column + (l.end - l.start);
      r.push({
        source: `GraphQL: ${i}`,
        message: e.message,
        severity: t,
        range: new Range(new Position(o.line - 1, o.column - 1), new Position(o.line - 1, u))
      });
    }
  }
  return r;
}

function getLocation(e) {
  var t = e.loc;
  invariant(t, "Expected ASTNode to have a location.");
  return t;
}

var f = "FragmentDefinition";

class GraphQLError extends Error {
  constructor(e, t, i, r, s, a, n) {
    super(e);
    this.name = "GraphQLError";
    this.message = e;
    if (s) {
      this.path = s;
    }
    if (t) {
      this.nodes = Array.isArray(t) ? t : [ t ];
    }
    if (i) {
      this.source = i;
    }
    if (r) {
      this.positions = r;
    }
    if (a) {
      this.originalError = a;
    }
    var o = n;
    if (!o && a) {
      var l = a.extensions;
      if (l && "object" == typeof l) {
        o = l;
      }
    }
    this.extensions = o || {};
  }
  toJSON() {
    return {
      ...this,
      message: this.message
    };
  }
  toString() {
    return this.message;
  }
  get [Symbol.toStringTag]() {
    return "GraphQLError";
  }
}

var c;

var h;

function error(e) {
  return new GraphQLError(`Syntax Error: Unexpected token at ${h} in ${e}`);
}

function advance(e) {
  e.lastIndex = h;
  if (e.test(c)) {
    return c.slice(h, h = e.lastIndex);
  }
}

var d = / +(?=[^\s])/y;

function blockString(e) {
  var t = e.split("\n");
  var i = "";
  var r = 0;
  var s = 0;
  var a = t.length - 1;
  for (var n = 0; n < t.length; n++) {
    d.lastIndex = 0;
    if (d.test(t[n])) {
      if (n && (!r || d.lastIndex < r)) {
        r = d.lastIndex;
      }
      s = s || n;
      a = n;
    }
  }
  for (var o = s; o <= a; o++) {
    if (o !== s) {
      i += "\n";
    }
    i += t[o].slice(r).replace(/\\"""/g, '"""');
  }
  return i;
}

function ignored() {
  for (var e = 0 | c.charCodeAt(h++); 9 === e || 10 === e || 13 === e || 32 === e || 35 === e || 44 === e || 65279 === e; e = 0 | c.charCodeAt(h++)) {
    if (35 === e) {
      while (10 !== (e = c.charCodeAt(h++)) && 13 !== e) {}
    }
  }
  h--;
}

var v = /[_A-Za-z]\w*/y;

function name() {
  var e;
  if (e = advance(v)) {
    return {
      kind: "Name",
      value: e
    };
  }
}

var g = /(?:null|true|false)/y;

var m = /\$[_A-Za-z]\w*/y;

var x = /-?\d+/y;

var S = /(?:\.\d+)?[eE][+-]?\d+|\.\d+/y;

var y = /\\/g;

var T = /"""(?:"""|(?:[\s\S]*?[^\\])""")/y;

var E = /"(?:"|[^\r\n]*?[^\\]")/y;

function value(e) {
  var t;
  var i;
  if (i = advance(g)) {
    t = "null" === i ? {
      kind: "NullValue"
    } : {
      kind: "BooleanValue",
      value: "true" === i
    };
  } else if (!e && (i = advance(m))) {
    t = {
      kind: "Variable",
      name: {
        kind: "Name",
        value: i.slice(1)
      }
    };
  } else if (i = advance(x)) {
    var r = i;
    if (i = advance(S)) {
      t = {
        kind: "FloatValue",
        value: r + i
      };
    } else {
      t = {
        kind: "IntValue",
        value: r
      };
    }
  } else if (i = advance(v)) {
    t = {
      kind: "EnumValue",
      value: i
    };
  } else if (i = advance(T)) {
    t = {
      kind: "StringValue",
      value: blockString(i.slice(3, -3)),
      block: !0
    };
  } else if (i = advance(E)) {
    t = {
      kind: "StringValue",
      value: y.test(i) ? JSON.parse(i) : i.slice(1, -1),
      block: !1
    };
  } else if (t = function list(e) {
    var t;
    if (91 === c.charCodeAt(h)) {
      h++;
      ignored();
      var i = [];
      while (t = value(e)) {
        i.push(t);
      }
      if (93 !== c.charCodeAt(h++)) {
        throw error("ListValue");
      }
      ignored();
      return {
        kind: "ListValue",
        values: i
      };
    }
  }(e) || function object(e) {
    if (123 === c.charCodeAt(h)) {
      h++;
      ignored();
      var t = [];
      var i;
      while (i = name()) {
        ignored();
        if (58 !== c.charCodeAt(h++)) {
          throw error("ObjectField");
        }
        ignored();
        var r = value(e);
        if (!r) {
          throw error("ObjectField");
        }
        t.push({
          kind: "ObjectField",
          name: i,
          value: r
        });
      }
      if (125 !== c.charCodeAt(h++)) {
        throw error("ObjectValue");
      }
      ignored();
      return {
        kind: "ObjectValue",
        fields: t
      };
    }
  }(e)) {
    return t;
  }
  ignored();
  return t;
}

function arguments_(e) {
  var t = [];
  ignored();
  if (40 === c.charCodeAt(h)) {
    h++;
    ignored();
    var i;
    while (i = name()) {
      ignored();
      if (58 !== c.charCodeAt(h++)) {
        throw error("Argument");
      }
      ignored();
      var r = value(e);
      if (!r) {
        throw error("Argument");
      }
      t.push({
        kind: "Argument",
        name: i,
        value: r
      });
    }
    if (!t.length || 41 !== c.charCodeAt(h++)) {
      throw error("Argument");
    }
    ignored();
  }
  return t;
}

function directives(e) {
  var t = [];
  ignored();
  while (64 === c.charCodeAt(h)) {
    h++;
    var i = name();
    if (!i) {
      throw error("Directive");
    }
    ignored();
    t.push({
      kind: "Directive",
      name: i,
      arguments: arguments_(e)
    });
  }
  return t;
}

function field() {
  var e = name();
  if (e) {
    ignored();
    var t;
    if (58 === c.charCodeAt(h)) {
      h++;
      ignored();
      t = e;
      if (!(e = name())) {
        throw error("Field");
      }
      ignored();
    }
    return {
      kind: "Field",
      alias: t,
      name: e,
      arguments: arguments_(!1),
      directives: directives(!1),
      selectionSet: selectionSet()
    };
  }
}

function type() {
  var e;
  ignored();
  if (91 === c.charCodeAt(h)) {
    h++;
    ignored();
    var t = type();
    if (!t || 93 !== c.charCodeAt(h++)) {
      throw error("ListType");
    }
    e = {
      kind: "ListType",
      type: t
    };
  } else if (e = name()) {
    e = {
      kind: "NamedType",
      name: e
    };
  } else {
    throw error("NamedType");
  }
  ignored();
  if (33 === c.charCodeAt(h)) {
    h++;
    ignored();
    return {
      kind: "NonNullType",
      type: e
    };
  } else {
    return e;
  }
}

var A = /on/y;

function typeCondition() {
  if (advance(A)) {
    ignored();
    var e = name();
    if (!e) {
      throw error("NamedType");
    }
    ignored();
    return {
      kind: "NamedType",
      name: e
    };
  }
}

var b = /\.\.\./y;

function fragmentSpread() {
  if (advance(b)) {
    ignored();
    var e = h;
    var t;
    if ((t = name()) && "on" !== t.value) {
      return {
        kind: "FragmentSpread",
        name: t,
        directives: directives(!1)
      };
    } else {
      h = e;
      var i = typeCondition();
      var r = directives(!1);
      var s = selectionSet();
      if (!s) {
        throw error("InlineFragment");
      }
      return {
        kind: "InlineFragment",
        typeCondition: i,
        directives: r,
        selectionSet: s
      };
    }
  }
}

function selectionSet() {
  var e;
  ignored();
  if (123 === c.charCodeAt(h)) {
    h++;
    ignored();
    var t = [];
    while (e = fragmentSpread() || field()) {
      t.push(e);
    }
    if (!t.length || 125 !== c.charCodeAt(h++)) {
      throw error("SelectionSet");
    }
    ignored();
    return {
      kind: "SelectionSet",
      selections: t
    };
  }
}

var D = /fragment/y;

function fragmentDefinition() {
  if (advance(D)) {
    ignored();
    var e = name();
    if (!e) {
      throw error("FragmentDefinition");
    }
    ignored();
    var t = typeCondition();
    if (!t) {
      throw error("FragmentDefinition");
    }
    var i = directives(!1);
    var r = selectionSet();
    if (!r) {
      throw error("FragmentDefinition");
    }
    return {
      kind: "FragmentDefinition",
      name: e,
      typeCondition: t,
      directives: i,
      selectionSet: r
    };
  }
}

var w = /(?:query|mutation|subscription)/y;

function operationDefinition() {
  var e;
  var t;
  var i = [];
  var r = [];
  if (e = advance(w)) {
    ignored();
    t = name();
    i = function variableDefinitions() {
      var e;
      var t = [];
      ignored();
      if (40 === c.charCodeAt(h)) {
        h++;
        ignored();
        while (e = advance(m)) {
          ignored();
          if (58 !== c.charCodeAt(h++)) {
            throw error("VariableDefinition");
          }
          var i = type();
          var r = void 0;
          if (61 === c.charCodeAt(h)) {
            h++;
            ignored();
            if (!(r = value(!0))) {
              throw error("VariableDefinition");
            }
          }
          ignored();
          t.push({
            kind: "VariableDefinition",
            variable: {
              kind: "Variable",
              name: {
                kind: "Name",
                value: e.slice(1)
              }
            },
            type: i,
            defaultValue: r,
            directives: directives(!0)
          });
        }
        if (41 !== c.charCodeAt(h++)) {
          throw error("VariableDefinition");
        }
        ignored();
      }
      return t;
    }();
    r = directives(!1);
  }
  var s = selectionSet();
  if (s) {
    return {
      kind: "OperationDefinition",
      operation: e || "query",
      name: t,
      variableDefinitions: i,
      directives: r,
      selectionSet: s
    };
  }
}

function parse(e, t) {
  c = "string" == typeof e.body ? e.body : e;
  h = 0;
  return function document() {
    var e;
    ignored();
    var t = [];
    while (e = fragmentDefinition() || operationDefinition()) {
      t.push(e);
    }
    return {
      kind: "Document",
      definitions: t
    };
  }();
}

var k = {};

function visit(e, t) {
  var i = [];
  var r = [];
  try {
    var s = function traverse(e, s, a) {
      var n = !1;
      var o = t[e.kind] && t[e.kind].enter || t[e.kind] || t.enter;
      var l = o && o.call(t, e, s, a, r, i);
      if (!1 === l) {
        return e;
      } else if (null === l) {
        return null;
      } else if (l === k) {
        throw k;
      } else if (l && "string" == typeof l.kind) {
        n = l !== e;
        e = l;
      }
      if (a) {
        i.push(a);
      }
      var u;
      var p = {
        ...e
      };
      for (var f in e) {
        r.push(f);
        var c = e[f];
        if (Array.isArray(c)) {
          var h = [];
          for (var d = 0; d < c.length; d++) {
            if (null != c[d] && "string" == typeof c[d].kind) {
              i.push(e);
              r.push(d);
              u = traverse(c[d], d, c);
              r.pop();
              i.pop();
              if (null == u) {
                n = !0;
              } else {
                n = n || u !== c[d];
                h.push(u);
              }
            }
          }
          c = h;
        } else if (null != c && "string" == typeof c.kind) {
          if (void 0 !== (u = traverse(c, f, e))) {
            n = n || c !== u;
            c = u;
          }
        }
        r.pop();
        if (n) {
          p[f] = c;
        }
      }
      if (a) {
        i.pop();
      }
      var v = t[e.kind] && t[e.kind].leave || t.leave;
      var g = v && v.call(t, e, s, a, r, i);
      if (g === k) {
        throw k;
      } else if (void 0 !== g) {
        return g;
      } else if (void 0 !== l) {
        return n ? p : l;
      } else {
        return n ? p : e;
      }
    }(e);
    return void 0 !== s && !1 !== s ? s : e;
  } catch (t) {
    if (t !== k) {
      throw t;
    }
    return e;
  }
}

var hasItems = e => !(!e || !e.length);

var F = {
  OperationDefinition(e) {
    if ("query" === e.operation && !e.name && !hasItems(e.variableDefinitions) && !hasItems(e.directives)) {
      return F.SelectionSet(e.selectionSet);
    }
    var t = e.operation;
    if (e.name) {
      t += " " + e.name.value;
    }
    if (hasItems(e.variableDefinitions)) {
      if (!e.name) {
        t += " ";
      }
      t += "(" + e.variableDefinitions.map(F.VariableDefinition).join(", ") + ")";
    }
    if (hasItems(e.directives)) {
      t += " " + e.directives.map(F.Directive).join(" ");
    }
    return t + " " + F.SelectionSet(e.selectionSet);
  },
  VariableDefinition(e) {
    var t = F.Variable(e.variable) + ": " + print(e.type);
    if (e.defaultValue) {
      t += " = " + print(e.defaultValue);
    }
    if (hasItems(e.directives)) {
      t += " " + e.directives.map(F.Directive).join(" ");
    }
    return t;
  },
  Field(e) {
    var t = (e.alias ? e.alias.value + ": " : "") + e.name.value;
    if (hasItems(e.arguments)) {
      var i = e.arguments.map(F.Argument);
      var r = t + "(" + i.join(", ") + ")";
      t = r.length > 80 ? t + "(\n  " + i.join("\n").replace(/\n/g, "\n  ") + "\n)" : r;
    }
    if (hasItems(e.directives)) {
      t += " " + e.directives.map(F.Directive).join(" ");
    }
    return e.selectionSet ? t + " " + F.SelectionSet(e.selectionSet) : t;
  },
  StringValue: e => e.block ? function printBlockString(e) {
    return '"""\n' + e.replace(/"""/g, '\\"""') + '\n"""';
  }(e.value) : function printString(e) {
    return JSON.stringify(e);
  }(e.value),
  BooleanValue: e => "" + e.value,
  NullValue: e => "null",
  IntValue: e => e.value,
  FloatValue: e => e.value,
  EnumValue: e => e.value,
  Name: e => e.value,
  Variable: e => "$" + e.name.value,
  ListValue: e => "[" + e.values.map(print).join(", ") + "]",
  ObjectValue: e => "{" + e.fields.map(F.ObjectField).join(", ") + "}",
  ObjectField: e => e.name.value + ": " + print(e.value),
  Document: e => hasItems(e.definitions) ? e.definitions.map(print).join("\n\n") : "",
  SelectionSet: e => "{\n  " + e.selections.map(print).join("\n").replace(/\n/g, "\n  ") + "\n}",
  Argument: e => e.name.value + ": " + print(e.value),
  FragmentSpread(e) {
    var t = "..." + e.name.value;
    if (hasItems(e.directives)) {
      t += " " + e.directives.map(F.Directive).join(" ");
    }
    return t;
  },
  InlineFragment(e) {
    var t = "...";
    if (e.typeCondition) {
      t += " on " + e.typeCondition.name.value;
    }
    if (hasItems(e.directives)) {
      t += " " + e.directives.map(F.Directive).join(" ");
    }
    return t + " " + print(e.selectionSet);
  },
  FragmentDefinition(e) {
    var t = "fragment " + e.name.value;
    t += " on " + e.typeCondition.name.value;
    if (hasItems(e.directives)) {
      t += " " + e.directives.map(F.Directive).join(" ");
    }
    return t + " " + print(e.selectionSet);
  },
  Directive(e) {
    var t = "@" + e.name.value;
    if (hasItems(e.arguments)) {
      t += "(" + e.arguments.map(F.Argument).join(", ") + ")";
    }
    return t;
  },
  NamedType: e => e.name.value,
  ListType: e => "[" + print(e.type) + "]",
  NonNullType: e => print(e.type) + "!"
};

function print(e) {
  return F[e.kind] ? F[e.kind](e) : "";
}

var C = new Set([ "gql", "graphql" ]);

var isIIFE = e => exports.ts.isCallExpression(e) && 0 === e.arguments.length && (exports.ts.isFunctionExpression(e.expression) || exports.ts.isArrowFunction(e.expression)) && !e.expression.asteriskToken && !e.expression.modifiers?.length;

var isGraphQLFunctionIdentifier = e => exports.ts.isIdentifier(e) && C.has(e.escapedText);

var isTadaGraphQLFunction = (e, t) => {
  if (!exports.ts.isLeftHandSideExpression(e)) {
    return !1;
  }
  var i = t?.getTypeAtLocation(e);
  return null != i && null != i.getProperty("scalar") && null != i.getProperty("persisted");
};

var isTadaGraphQLCall = (e, t) => {
  if (!exports.ts.isCallExpression(e)) {
    return !1;
  } else if (e.arguments.length < 1 || e.arguments.length > 2) {
    return !1;
  } else if (!exports.ts.isStringLiteralLike(e.arguments[0])) {
    return !1;
  }
  return t ? isTadaGraphQLFunction(e.expression, t) : !1;
};

var isTadaPersistedCall = (e, t) => {
  if (!e) {
    return !1;
  } else if (!exports.ts.isCallExpression(e)) {
    return !1;
  } else if (!exports.ts.isPropertyAccessExpression(e.expression)) {
    return !1;
  } else if (!exports.ts.isIdentifier(e.expression.name) || "persisted" !== e.expression.name.escapedText) {
    return !1;
  } else if (isGraphQLFunctionIdentifier(e.expression.expression)) {
    return !0;
  } else {
    return isTadaGraphQLFunction(e.expression.expression, t);
  }
};

var isGraphQLCall = (e, t) => exports.ts.isCallExpression(e) && e.arguments.length >= 1 && e.arguments.length <= 2 && (isGraphQLFunctionIdentifier(e.expression) || isTadaGraphQLCall(e, t));

var isGraphQLTag = e => exports.ts.isTaggedTemplateExpression(e) && isGraphQLFunctionIdentifier(e.tag);

var getSchemaName = (e, t, i = !1) => {
  if (!t) {
    return null;
  }
  var r = t.getTypeAtLocation(i ? e.getChildAt(0).getChildAt(0) : e.expression);
  if (r) {
    var s = r.getProperty("__name");
    if (s) {
      var a = t.getTypeOfSymbol(s);
      if (a.isUnionOrIntersection()) {
        var n = a.types.find(e => e.isStringLiteral());
        return n && n.isStringLiteral() ? n.value : null;
      } else if (a.isStringLiteral()) {
        return a.value;
      }
    }
  }
  return null;
};

function isValueDeclaration(e) {
  switch (e.kind) {
   case exports.ts.SyntaxKind.BinaryExpression:
   case exports.ts.SyntaxKind.ArrowFunction:
   case exports.ts.SyntaxKind.BindingElement:
   case exports.ts.SyntaxKind.ClassDeclaration:
   case exports.ts.SyntaxKind.ClassExpression:
   case exports.ts.SyntaxKind.ClassStaticBlockDeclaration:
   case exports.ts.SyntaxKind.Constructor:
   case exports.ts.SyntaxKind.EnumDeclaration:
   case exports.ts.SyntaxKind.EnumMember:
   case exports.ts.SyntaxKind.ExportAssignment:
   case exports.ts.SyntaxKind.FunctionDeclaration:
   case exports.ts.SyntaxKind.FunctionExpression:
   case exports.ts.SyntaxKind.GetAccessor:
   case exports.ts.SyntaxKind.JsxAttribute:
   case exports.ts.SyntaxKind.MethodDeclaration:
   case exports.ts.SyntaxKind.Parameter:
   case exports.ts.SyntaxKind.PropertyAssignment:
   case exports.ts.SyntaxKind.PropertyDeclaration:
   case exports.ts.SyntaxKind.SetAccessor:
   case exports.ts.SyntaxKind.ShorthandPropertyAssignment:
   case exports.ts.SyntaxKind.VariableDeclaration:
    return !0;

   default:
    return !1;
  }
}

function getValueOfValueDeclaration(e) {
  switch (e.kind) {
   case exports.ts.SyntaxKind.ClassExpression:
   case exports.ts.SyntaxKind.ClassDeclaration:
   case exports.ts.SyntaxKind.ArrowFunction:
   case exports.ts.SyntaxKind.ClassStaticBlockDeclaration:
   case exports.ts.SyntaxKind.Constructor:
   case exports.ts.SyntaxKind.EnumDeclaration:
   case exports.ts.SyntaxKind.FunctionDeclaration:
   case exports.ts.SyntaxKind.FunctionExpression:
   case exports.ts.SyntaxKind.GetAccessor:
   case exports.ts.SyntaxKind.SetAccessor:
   case exports.ts.SyntaxKind.MethodDeclaration:
    return e;

   case exports.ts.SyntaxKind.BindingElement:
   case exports.ts.SyntaxKind.EnumMember:
   case exports.ts.SyntaxKind.JsxAttribute:
   case exports.ts.SyntaxKind.Parameter:
   case exports.ts.SyntaxKind.PropertyAssignment:
   case exports.ts.SyntaxKind.PropertyDeclaration:
   case exports.ts.SyntaxKind.VariableDeclaration:
    return e.initializer;

   case exports.ts.SyntaxKind.ExportAssignment:
    return e.expression;

   case exports.ts.SyntaxKind.BinaryExpression:
    return function isAssignmentOperator(e) {
      switch (e.kind) {
       case exports.ts.SyntaxKind.EqualsToken:
       case exports.ts.SyntaxKind.BarBarEqualsToken:
       case exports.ts.SyntaxKind.AmpersandAmpersandEqualsToken:
       case exports.ts.SyntaxKind.QuestionQuestionEqualsToken:
        return !0;

       default:
        return !1;
      }
    }(e.operatorToken) ? e.right : void 0;

   case exports.ts.SyntaxKind.ShorthandPropertyAssignment:
    return e.objectAssignmentInitializer;

   default:
    return;
  }
}

function climbPastPropertyOrElementAccess(e) {
  if (e.parent && exports.ts.isPropertyAccessExpression(e.parent) && e.parent.name === e) {
    return e.parent;
  } else if (e.parent && exports.ts.isElementAccessExpression(e.parent) && e.parent.argumentExpression === e) {
    return e.parent;
  } else {
    return e;
  }
}

function getNameFromPropertyName(e) {
  if (exports.ts.isComputedPropertyName(e)) {
    return exports.ts.isStringLiteralLike(e.expression) || exports.ts.isNumericLiteral(e.expression) ? e.expression.text : void 0;
  } else if (exports.ts.isPrivateIdentifier(e) || exports.ts.isMemberName(e)) {
    return exports.ts.idText(e);
  } else {
    return e.text;
  }
}

function getDeclarationOfIdentifier(e, t) {
  var i = t.getSymbolAtLocation(e);
  if (i?.declarations?.[0] && i.flags & exports.ts.SymbolFlags.Alias && (e.parent === i?.declarations?.[0] || !exports.ts.isNamespaceImport(i.declarations[0]))) {
    var r = t.getAliasedSymbol(i);
    if (r.declarations) {
      i = r;
    }
  }
  if (i && exports.ts.isShorthandPropertyAssignment(e.parent)) {
    var s = t.getShorthandAssignmentValueSymbol(i.valueDeclaration);
    if (s) {
      i = s;
    }
  } else if (exports.ts.isBindingElement(e.parent) && exports.ts.isObjectBindingPattern(e.parent.parent) && e === (e.parent.propertyName || e.parent.name)) {
    var a = getNameFromPropertyName(e);
    var n = a ? t.getTypeAtLocation(e.parent.parent).getProperty(a) : void 0;
    if (n) {
      i = n;
    }
  } else if (exports.ts.isObjectLiteralElement(e.parent) && (exports.ts.isObjectLiteralExpression(e.parent.parent) || exports.ts.isJsxAttributes(e.parent.parent)) && e.parent.name === e) {
    var o = getNameFromPropertyName(e);
    var l = o ? t.getContextualType(e.parent.parent)?.getProperty(o) : void 0;
    if (l) {
      i = l;
    }
  }
  if (i && i.declarations?.length) {
    if (i.flags & exports.ts.SymbolFlags.Class && !(i.flags & (exports.ts.SymbolFlags.Function | exports.ts.SymbolFlags.Variable)) && function isNewExpressionTarget(e) {
      var t = climbPastPropertyOrElementAccess(e).parent;
      return exports.ts.isNewExpression(t) && t.expression === e;
    }(e)) {
      for (var u of i.declarations) {
        if (exports.ts.isClassLike(u)) {
          return u;
        }
      }
    } else if (function isCallOrNewExpressionTarget(e) {
      var t = climbPastPropertyOrElementAccess(e).parent;
      return exports.ts.isCallOrNewExpression(t) && t.expression === e;
    }(e) || function isNameOfFunctionDeclaration(e) {
      return exports.ts.isIdentifier(e) && e.parent && exports.ts.isFunctionLike(e.parent) && e.parent.name === e;
    }(e)) {
      for (var p of i.declarations) {
        if (exports.ts.isFunctionLike(p) && p.body && isValueDeclaration(p)) {
          return p;
        }
      }
    }
    if (i.valueDeclaration && exports.ts.isPropertyAccessExpression(i.valueDeclaration)) {
      var f = i.valueDeclaration.parent;
      if (f && exports.ts.isBinaryExpression(f) && f.left === i.valueDeclaration) {
        return f;
      }
    }
    if (i.valueDeclaration && isValueDeclaration(i.valueDeclaration)) {
      return i.valueDeclaration;
    }
    for (var c of i.declarations) {
      if (isValueDeclaration(c)) {
        return c;
      }
    }
  }
  return;
}

function getValueOfIdentifier(e, t) {
  while (exports.ts.isIdentifier(e)) {
    var i = getDeclarationOfIdentifier(e, t);
    if (!i) {
      return;
    } else {
      var r = getValueOfValueDeclaration(i);
      if (r && exports.ts.isIdentifier(r) && r !== e) {
        e = r;
      } else {
        return r;
      }
    }
  }
}

function resolveTemplate(e, t, i) {
  if (exports.ts.isStringLiteralLike(e)) {
    return {
      combinedText: e.getText().slice(1, -1),
      resolvedSpans: []
    };
  }
  var r = e.template.getText().slice(1, -1);
  if (exports.ts.isNoSubstitutionTemplateLiteral(e.template) || 0 === e.template.templateSpans.length) {
    return {
      combinedText: r,
      resolvedSpans: []
    };
  }
  var s = 0;
  var a = e.template.templateSpans.map(e => {
    if (exports.ts.isIdentifier(e.expression)) {
      var t = i.languageService.getProgram()?.getTypeChecker();
      if (!t) {
        return;
      }
      var a = getDeclarationOfIdentifier(e.expression, t);
      if (!a) {
        return;
      }
      var n = a;
      if (exports.ts.isVariableDeclaration(n)) {
        var o = e.expression.escapedText;
        var l = getValueOfValueDeclaration(n);
        if (!l) {
          return;
        }
        var u = e.expression.getStart() - 2;
        var p = {
          start: u,
          length: e.expression.end - u + 1
        };
        if (exports.ts.isTaggedTemplateExpression(l)) {
          var f = resolveTemplate(l, n.getSourceFile().fileName, i);
          r = r.replace("${" + e.expression.escapedText + "}", f.combinedText);
          var c = {
            lines: f.combinedText.split("\n").length,
            identifier: o,
            original: p,
            new: {
              start: p.start + s,
              length: f.combinedText.length
            }
          };
          s += f.combinedText.length - p.length;
          return c;
        } else if (exports.ts.isAsExpression(l) && exports.ts.isTaggedTemplateExpression(l.expression)) {
          var h = resolveTemplate(l.expression, n.getSourceFile().fileName, i);
          r = r.replace("${" + e.expression.escapedText + "}", h.combinedText);
          var d = {
            lines: h.combinedText.split("\n").length,
            identifier: o,
            original: p,
            new: {
              start: p.start + s,
              length: h.combinedText.length
            }
          };
          s += h.combinedText.length - p.length;
          return d;
        } else if (exports.ts.isAsExpression(l) && exports.ts.isAsExpression(l.expression) && exports.ts.isObjectLiteralExpression(l.expression.expression)) {
          var v = print(JSON.parse(l.expression.expression.getText()));
          r = r.replace("${" + e.expression.escapedText + "}", v);
          var g = {
            lines: v.split("\n").length,
            identifier: o,
            original: p,
            new: {
              start: p.start + s,
              length: v.length
            }
          };
          s += v.length - p.length;
          return g;
        }
        return;
      }
    }
    return;
  }).filter(Boolean);
  return {
    combinedText: r,
    resolvedSpans: a
  };
}

var resolveTadaFragmentArray = e => {
  if (!e) {
    return;
  }
  while (exports.ts.isAsExpression(e)) {
    e = e.expression;
  }
  if (!exports.ts.isArrayLiteralExpression(e)) {
    return;
  }
  if (e.elements.every(exports.ts.isIdentifier)) {
    return e.elements;
  }
  var t = [];
  for (var i of e.elements) {
    while (exports.ts.isPropertyAccessExpression(i)) {
      i = i.name;
    }
    if (exports.ts.isIdentifier(i)) {
      t.push(i);
    }
  }
  return t;
};

function getSource(e, t) {
  var i = e.languageService.getProgram();
  if (!i) {
    return;
  }
  var r = i.getSourceFile(t);
  if (!r) {
    return;
  }
  return r;
}

function findNode(e, t) {
  return function find(e) {
    if (t >= e.getStart() && t < e.getEnd()) {
      return exports.ts.forEachChild(e, find) || e;
    }
  }(e);
}

function unrollFragment(t, i, r) {
  var s = [];
  var a = [ t ];
  var n = new WeakSet;
  var _unrollElement = t => {
    if (n.has(t)) {
      return;
    }
    n.add(t);
    var i = function resolveIdentifierToGraphQLCall(e, t, i) {
      if (!i) {
        return null;
      }
      var r = getValueOfIdentifier(e, i);
      if (!r) {
        return null;
      }
      return isGraphQLCall(r, i) ? r : null;
    }(t, 0, r);
    if (!i) {
      return;
    }
    var o = resolveTadaFragmentArray(i.arguments[1]);
    if (o) {
      a.push(...o);
    }
    try {
      e.parse(i.arguments[0].getText().slice(1, -1), {
        noLocation: !0
      }).definitions.forEach(e => {
        if ("FragmentDefinition" === e.kind) {
          s.push(e);
        }
      });
    } catch (e) {}
  };
  var o;
  while (void 0 !== (o = a.shift())) {
    _unrollElement(o);
  }
  return s;
}

function unrollTadaFragments(e, t, i) {
  var r = i.languageService.getProgram()?.getTypeChecker();
  e.elements.forEach(e => {
    if (exports.ts.isIdentifier(e)) {
      t.push(...unrollFragment(e, 0, r));
    } else if (exports.ts.isPropertyAccessExpression(e)) {
      var i = e;
      while (exports.ts.isPropertyAccessExpression(i.expression)) {
        i = i.expression;
      }
      if (exports.ts.isIdentifier(i.name)) {
        t.push(...unrollFragment(i.name, 0, r));
      }
    }
  });
  return t;
}

function findAllCallExpressions(e, t, i = !0) {
  var r = t.languageService.getProgram()?.getTypeChecker();
  var s = [];
  var a = [];
  var n = i ? !1 : !0;
  !function find(e) {
    if (!exports.ts.isCallExpression(e) || isIIFE(e)) {
      return exports.ts.forEachChild(e, find);
    }
    if (!isGraphQLCall(e, r)) {
      return exports.ts.forEachChild(e, find);
    }
    var i = getSchemaName(e, r);
    var o = e.arguments[0];
    var l = resolveTadaFragmentArray(e.arguments[1]);
    var u = isTadaGraphQLCall(e, r);
    if (!n && !l) {
      if (!u) {
        n = !0;
        a.push(...getAllFragments(e, t));
      }
    } else if (l) {
      for (var p of l) {
        a.push(...unrollFragment(p, 0, r));
      }
    }
    if (o && exports.ts.isStringLiteralLike(o)) {
      s.push({
        node: o,
        schema: i,
        tadaFragmentRefs: u ? void 0 === l ? [] : l : void 0
      });
    }
  }(e);
  return {
    nodes: s,
    fragments: a
  };
}

function findAllPersistedCallExpressions(e, t) {
  var i = [];
  var r = t?.languageService.getProgram()?.getTypeChecker();
  !function find(e) {
    if (!exports.ts.isCallExpression(e) || isIIFE(e)) {
      return exports.ts.forEachChild(e, find);
    }
    if (!isTadaPersistedCall(e, r)) {
      return;
    } else if (t) {
      var s = getSchemaName(e, r, !0);
      i.push({
        node: e,
        schema: s
      });
    } else {
      i.push(e);
    }
  }(e);
  return i;
}

function getAllFragments(t, i) {
  var r = [];
  var s = i.languageService.getProgram()?.getTypeChecker();
  if (!exports.ts.isCallExpression(t)) {
    return r;
  }
  var a = resolveTadaFragmentArray(t.arguments[1]);
  if (a) {
    var n = i.languageService.getProgram()?.getTypeChecker();
    for (var o of a) {
      r.push(...unrollFragment(o, 0, n));
    }
    return r;
  } else if (isTadaGraphQLCall(t, s)) {
    return r;
  }
  if (!s) {
    return r;
  }
  var l = function getIdentifierOfChainExpression(e) {
    var t = e;
    while (t) {
      if (exports.ts.isPropertyAccessExpression(t)) {
        t = t.name;
      } else if (exports.ts.isAsExpression(t) || exports.ts.isSatisfiesExpression(t) || exports.ts.isNonNullExpression(t) || exports.ts.isParenthesizedExpression(t) || exports.ts.isExpressionWithTypeArguments(t)) {
        t = t.expression;
      } else if (exports.ts.isCommaListExpression(t)) {
        t = t.elements[t.elements.length - 1];
      } else if (exports.ts.isIdentifier(t)) {
        return t;
      } else {
        return;
      }
    }
  }(t.expression);
  if (!l) {
    return r;
  }
  var u = getDeclarationOfIdentifier(l, s);
  if (!u) {
    return r;
  }
  var p = u.getSourceFile();
  if (!p) {
    return r;
  }
  var f = [ {
    fileName: p.fileName,
    textSpan: {
      start: u.getStart(),
      length: u.getWidth()
    }
  } ];
  if (!f || !f.length) {
    return r;
  }
  var c = f[0];
  if (!c) {
    return r;
  }
  var h = getSource(i, c.fileName);
  if (!h) {
    return r;
  }
  exports.ts.forEachChild(h, t => {
    if (exports.ts.isVariableStatement(t) && t.declarationList && t.declarationList.declarations[0] && "documents" === t.declarationList.declarations[0].name.getText()) {
      var [i] = t.declarationList.declarations;
      if (i.initializer && exports.ts.isObjectLiteralExpression(i.initializer)) {
        i.initializer.properties.forEach(t => {
          if (exports.ts.isPropertyAssignment(t) && exports.ts.isStringLiteral(t.name)) {
            try {
              var i = JSON.parse(`${t.name.getText().replace(/'/g, '"')}`);
              if (i.includes("fragment ") && i.includes(" on ")) {
                e.parse(i, {
                  noLocation: !0
                }).definitions.forEach(e => {
                  if ("FragmentDefinition" === e.kind) {
                    r.push(e);
                  }
                });
              }
            } catch (e) {}
          }
        });
      }
    }
  });
  return r;
}

function findAllMaskFragmentsCalls(e) {
  var t = [];
  !function find(e) {
    if ((e => {
      if (!exports.ts.isCallExpression(e)) {
        return !1;
      }
      if (!exports.ts.isIdentifier(e.expression)) {
        return !1;
      }
      return "maskFragments" === e.expression.escapedText;
    })(e)) {
      t.push(e);
    }
    exports.ts.forEachChild(e, find);
  }(e);
  return t;
}

var L = "object" == typeof performance && performance && "function" == typeof performance.now ? performance : Date;

var N = new Set;

var _ = "object" == typeof process && process ? process : {};

var emitWarning = (e, t, i, r) => {
  "function" == typeof _.emitWarning ? _.emitWarning(e, t, i, r) : console.error(`[${i}] ${t}: ${e}`);
};

var O = globalThis.AbortController;

var I = globalThis.AbortSignal;

if (void 0 === O) {
  I = class AbortSignal {
    _onabort=[];
    aborted=!1;
    addEventListener(e, t) {
      this._onabort.push(t);
    }
  };
  O = class AbortController {
    constructor() {
      warnACPolyfill();
    }
    signal=new I;
    abort(e) {
      if (this.signal.aborted) {
        return;
      }
      this.signal.reason = e;
      this.signal.aborted = !0;
      for (var t of this.signal._onabort) {
        t(e);
      }
      this.signal.onabort?.(e);
    }
  };
  var z = "1" !== _.env?.LRU_CACHE_IGNORE_AC_WARNING;
  var warnACPolyfill = () => {
    if (!z) {
      return;
    }
    z = !1;
    emitWarning("AbortController is not defined. If using lru-cache in node 14, load an AbortController polyfill from the `node-abort-controller` package. A minimal polyfill is provided for use by LRUCache.fetch(), but it should not be relied upon in other contexts (eg, passing it to other APIs that use AbortController/AbortSignal might have undesirable effects). You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.", "NO_ABORT_CONTROLLER", "ENOTSUP", warnACPolyfill);
  };
}

var isPosInt = e => e && e === Math.floor(e) && e > 0 && isFinite(e);

var getUintArray = e => !isPosInt(e) ? null : e <= Math.pow(2, 8) ? Uint8Array : e <= Math.pow(2, 16) ? Uint16Array : e <= Math.pow(2, 32) ? Uint32Array : e <= Number.MAX_SAFE_INTEGER ? ZeroArray : null;

class ZeroArray extends Array {
  constructor(e) {
    super(e);
    this.fill(0);
  }
}

class Stack {
  static #e=!1;
  static create(e) {
    var t = getUintArray(e);
    if (!t) {
      return [];
    }
    Stack.#e = !0;
    var i = new Stack(e, t);
    Stack.#e = !1;
    return i;
  }
  constructor(e, t) {
    if (!Stack.#e) {
      throw new TypeError("instantiate Stack using Stack.create(n)");
    }
    this.heap = new t(e);
    this.length = 0;
  }
  push(e) {
    this.heap[this.length++] = e;
  }
  pop() {
    return this.heap[--this.length];
  }
}

class LRUCache {
  #t;
  #i;
  #r;
  #s;
  #a;
  #n;
  #o;
  #l;
  #u;
  #p;
  #f;
  #c;
  #h;
  #d;
  #v;
  #g;
  #m;
  #x;
  #S;
  #y;
  #T;
  #E;
  static unsafeExposeInternals(e) {
    return {
      starts: e.#x,
      ttls: e.#S,
      sizes: e.#m,
      keyMap: e.#l,
      keyList: e.#u,
      valList: e.#p,
      next: e.#f,
      prev: e.#c,
      get head() {
        return e.#h;
      },
      get tail() {
        return e.#d;
      },
      free: e.#v,
      isBackgroundFetch: t => e.#A(t),
      backgroundFetch: (t, i, r, s) => e.#b(t, i, r, s),
      moveToTail: t => e.#D(t),
      indexes: t => e.#w(t),
      rindexes: t => e.#k(t),
      isStale: t => e.#F(t)
    };
  }
  get max() {
    return this.#t;
  }
  get maxSize() {
    return this.#i;
  }
  get calculatedSize() {
    return this.#o;
  }
  get size() {
    return this.#n;
  }
  get fetchMethod() {
    return this.#a;
  }
  get dispose() {
    return this.#r;
  }
  get disposeAfter() {
    return this.#s;
  }
  constructor(e) {
    var {max: t = 0, ttl: i, ttlResolution: r = 1, ttlAutopurge: s, updateAgeOnGet: a, updateAgeOnHas: n, allowStale: o, dispose: l, disposeAfter: u, noDisposeOnSet: p, noUpdateTTL: f, maxSize: c = 0, maxEntrySize: h = 0, sizeCalculation: d, fetchMethod: v, noDeleteOnFetchRejection: g, noDeleteOnStaleGet: m, allowStaleOnFetchRejection: x, allowStaleOnFetchAbort: S, ignoreFetchAbort: y} = e;
    if (0 !== t && !isPosInt(t)) {
      throw new TypeError("max option must be a nonnegative integer");
    }
    var T = t ? getUintArray(t) : Array;
    if (!T) {
      throw new Error("invalid max value: " + t);
    }
    this.#t = t;
    this.#i = c;
    this.maxEntrySize = h || this.#i;
    this.sizeCalculation = d;
    if (this.sizeCalculation) {
      if (!this.#i && !this.maxEntrySize) {
        throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
      }
      if ("function" != typeof this.sizeCalculation) {
        throw new TypeError("sizeCalculation set to non-function");
      }
    }
    if (void 0 !== v && "function" != typeof v) {
      throw new TypeError("fetchMethod must be a function if specified");
    }
    this.#a = v;
    this.#T = !!v;
    this.#l = new Map;
    this.#u = new Array(t).fill(void 0);
    this.#p = new Array(t).fill(void 0);
    this.#f = new T(t);
    this.#c = new T(t);
    this.#h = 0;
    this.#d = 0;
    this.#v = Stack.create(t);
    this.#n = 0;
    this.#o = 0;
    if ("function" == typeof l) {
      this.#r = l;
    }
    if ("function" == typeof u) {
      this.#s = u;
      this.#g = [];
    } else {
      this.#s = void 0;
      this.#g = void 0;
    }
    this.#y = !!this.#r;
    this.#E = !!this.#s;
    this.noDisposeOnSet = !!p;
    this.noUpdateTTL = !!f;
    this.noDeleteOnFetchRejection = !!g;
    this.allowStaleOnFetchRejection = !!x;
    this.allowStaleOnFetchAbort = !!S;
    this.ignoreFetchAbort = !!y;
    if (0 !== this.maxEntrySize) {
      if (0 !== this.#i) {
        if (!isPosInt(this.#i)) {
          throw new TypeError("maxSize must be a positive integer if specified");
        }
      }
      if (!isPosInt(this.maxEntrySize)) {
        throw new TypeError("maxEntrySize must be a positive integer if specified");
      }
      this.#C();
    }
    this.allowStale = !!o;
    this.noDeleteOnStaleGet = !!m;
    this.updateAgeOnGet = !!a;
    this.updateAgeOnHas = !!n;
    this.ttlResolution = isPosInt(r) || 0 === r ? r : 1;
    this.ttlAutopurge = !!s;
    this.ttl = i || 0;
    if (this.ttl) {
      if (!isPosInt(this.ttl)) {
        throw new TypeError("ttl must be a positive integer if specified");
      }
      this.#L();
    }
    if (0 === this.#t && 0 === this.ttl && 0 === this.#i) {
      throw new TypeError("At least one of max, maxSize, or ttl is required");
    }
    if (!this.ttlAutopurge && !this.#t && !this.#i) {
      var E = "LRU_CACHE_UNBOUNDED";
      if ((e => !N.has(e))(E)) {
        N.add(E);
        emitWarning("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", E, LRUCache);
      }
    }
  }
  getRemainingTTL(e) {
    return this.#l.has(e) ? 1 / 0 : 0;
  }
  #L() {
    var e = new ZeroArray(this.#t);
    var t = new ZeroArray(this.#t);
    this.#S = e;
    this.#x = t;
    this.#N = (i, r, s = L.now()) => {
      t[i] = 0 !== r ? s : 0;
      e[i] = r;
      if (0 !== r && this.ttlAutopurge) {
        var a = setTimeout(() => {
          if (this.#F(i)) {
            this.delete(this.#u[i]);
          }
        }, r + 1);
        if (a.unref) {
          a.unref();
        }
      }
    };
    this.#_ = i => {
      t[i] = 0 !== e[i] ? L.now() : 0;
    };
    this.#O = (r, s) => {
      if (e[s]) {
        var a = e[s];
        var n = t[s];
        r.ttl = a;
        r.start = n;
        r.now = i || getNow();
        r.remainingTTL = a - (r.now - n);
      }
    };
    var i = 0;
    var getNow = () => {
      var e = L.now();
      if (this.ttlResolution > 0) {
        i = e;
        var t = setTimeout(() => i = 0, this.ttlResolution);
        if (t.unref) {
          t.unref();
        }
      }
      return e;
    };
    this.getRemainingTTL = r => {
      var s = this.#l.get(r);
      if (void 0 === s) {
        return 0;
      }
      var a = e[s];
      var n = t[s];
      if (0 === a || 0 === n) {
        return 1 / 0;
      }
      return a - ((i || getNow()) - n);
    };
    this.#F = r => 0 !== e[r] && 0 !== t[r] && (i || getNow()) - t[r] > e[r];
  }
  #_=() => {};
  #O=() => {};
  #N=() => {};
  #F=() => !1;
  #C() {
    var e = new ZeroArray(this.#t);
    this.#o = 0;
    this.#m = e;
    this.#I = t => {
      this.#o -= e[t];
      e[t] = 0;
    };
    this.#z = (e, t, i, r) => {
      if (this.#A(t)) {
        return 0;
      }
      if (!isPosInt(i)) {
        if (r) {
          if ("function" != typeof r) {
            throw new TypeError("sizeCalculation must be a function");
          }
          i = r(t, e);
          if (!isPosInt(i)) {
            throw new TypeError("sizeCalculation return invalid (expect positive integer)");
          }
        } else {
          throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
        }
      }
      return i;
    };
    this.#P = (t, i, r) => {
      e[t] = i;
      if (this.#i) {
        var s = this.#i - e[t];
        while (this.#o > s) {
          this.#$(!0);
        }
      }
      this.#o += e[t];
      if (r) {
        r.entrySize = i;
        r.totalCalculatedSize = this.#o;
      }
    };
  }
  #I=e => {};
  #P=(e, t, i) => {};
  #z=(e, t, i, r) => {
    if (i || r) {
      throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
    }
    return 0;
  };
  * #w({allowStale: e = this.allowStale} = {}) {
    if (this.#n) {
      for (var t = this.#d; 1; ) {
        if (!this.#R(t)) {
          break;
        }
        if (e || !this.#F(t)) {
          yield t;
        }
        if (t === this.#h) {
          break;
        } else {
          t = this.#c[t];
        }
      }
    }
  }
  * #k({allowStale: e = this.allowStale} = {}) {
    if (this.#n) {
      for (var t = this.#h; 1; ) {
        if (!this.#R(t)) {
          break;
        }
        if (e || !this.#F(t)) {
          yield t;
        }
        if (t === this.#d) {
          break;
        } else {
          t = this.#f[t];
        }
      }
    }
  }
  #R(e) {
    return void 0 !== e && this.#l.get(this.#u[e]) === e;
  }
  * entries() {
    for (var e of this.#w()) {
      if (void 0 !== this.#p[e] && void 0 !== this.#u[e] && !this.#A(this.#p[e])) {
        yield [ this.#u[e], this.#p[e] ];
      }
    }
  }
  * rentries() {
    for (var e of this.#k()) {
      if (void 0 !== this.#p[e] && void 0 !== this.#u[e] && !this.#A(this.#p[e])) {
        yield [ this.#u[e], this.#p[e] ];
      }
    }
  }
  * keys() {
    for (var e of this.#w()) {
      var t = this.#u[e];
      if (void 0 !== t && !this.#A(this.#p[e])) {
        yield t;
      }
    }
  }
  * rkeys() {
    for (var e of this.#k()) {
      var t = this.#u[e];
      if (void 0 !== t && !this.#A(this.#p[e])) {
        yield t;
      }
    }
  }
  * values() {
    for (var e of this.#w()) {
      if (void 0 !== this.#p[e] && !this.#A(this.#p[e])) {
        yield this.#p[e];
      }
    }
  }
  * rvalues() {
    for (var e of this.#k()) {
      if (void 0 !== this.#p[e] && !this.#A(this.#p[e])) {
        yield this.#p[e];
      }
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  find(e, t = {}) {
    for (var i of this.#w()) {
      var r = this.#p[i];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s) {
        continue;
      }
      if (e(s, this.#u[i], this)) {
        return this.get(this.#u[i], t);
      }
    }
  }
  forEach(e, t = this) {
    for (var i of this.#w()) {
      var r = this.#p[i];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s) {
        continue;
      }
      e.call(t, s, this.#u[i], this);
    }
  }
  rforEach(e, t = this) {
    for (var i of this.#k()) {
      var r = this.#p[i];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s) {
        continue;
      }
      e.call(t, s, this.#u[i], this);
    }
  }
  purgeStale() {
    var e = !1;
    for (var t of this.#k({
      allowStale: !0
    })) {
      if (this.#F(t)) {
        this.delete(this.#u[t]);
        e = !0;
      }
    }
    return e;
  }
  dump() {
    var e = [];
    for (var t of this.#w({
      allowStale: !0
    })) {
      var i = this.#u[t];
      var r = this.#p[t];
      var s = this.#A(r) ? r.__staleWhileFetching : r;
      if (void 0 === s || void 0 === i) {
        continue;
      }
      var a = {
        value: s
      };
      if (this.#S && this.#x) {
        a.ttl = this.#S[t];
        var n = L.now() - this.#x[t];
        a.start = Math.floor(Date.now() - n);
      }
      if (this.#m) {
        a.size = this.#m[t];
      }
      e.unshift([ i, a ]);
    }
    return e;
  }
  load(e) {
    this.clear();
    for (var [t, i] of e) {
      if (i.start) {
        var r = Date.now() - i.start;
        i.start = L.now() - r;
      }
      this.set(t, i.value, i);
    }
  }
  set(e, t, i = {}) {
    if (void 0 === t) {
      this.delete(e);
      return this;
    }
    var {ttl: r = this.ttl, start: s, noDisposeOnSet: a = this.noDisposeOnSet, sizeCalculation: n = this.sizeCalculation, status: o} = i;
    var {noUpdateTTL: l = this.noUpdateTTL} = i;
    var u = this.#z(e, t, i.size || 0, n);
    if (this.maxEntrySize && u > this.maxEntrySize) {
      if (o) {
        o.set = "miss";
        o.maxEntrySizeExceeded = !0;
      }
      this.delete(e);
      return this;
    }
    var p = 0 === this.#n ? void 0 : this.#l.get(e);
    if (void 0 === p) {
      p = 0 === this.#n ? this.#d : 0 !== this.#v.length ? this.#v.pop() : this.#n === this.#t ? this.#$(!1) : this.#n;
      this.#u[p] = e;
      this.#p[p] = t;
      this.#l.set(e, p);
      this.#f[this.#d] = p;
      this.#c[p] = this.#d;
      this.#d = p;
      this.#n++;
      this.#P(p, u, o);
      if (o) {
        o.set = "add";
      }
      l = !1;
    } else {
      this.#D(p);
      var f = this.#p[p];
      if (t !== f) {
        if (this.#T && this.#A(f)) {
          f.__abortController.abort(new Error("replaced"));
          var {__staleWhileFetching: c} = f;
          if (void 0 !== c && !a) {
            if (this.#y) {
              this.#r?.(c, e, "set");
            }
            if (this.#E) {
              this.#g?.push([ c, e, "set" ]);
            }
          }
        } else if (!a) {
          if (this.#y) {
            this.#r?.(f, e, "set");
          }
          if (this.#E) {
            this.#g?.push([ f, e, "set" ]);
          }
        }
        this.#I(p);
        this.#P(p, u, o);
        this.#p[p] = t;
        if (o) {
          o.set = "replace";
          var h = f && this.#A(f) ? f.__staleWhileFetching : f;
          if (void 0 !== h) {
            o.oldValue = h;
          }
        }
      } else if (o) {
        o.set = "update";
      }
    }
    if (0 !== r && !this.#S) {
      this.#L();
    }
    if (this.#S) {
      if (!l) {
        this.#N(p, r, s);
      }
      if (o) {
        this.#O(o, p);
      }
    }
    if (!a && this.#E && this.#g) {
      var d = this.#g;
      var v;
      while (v = d?.shift()) {
        this.#s?.(...v);
      }
    }
    return this;
  }
  pop() {
    try {
      while (this.#n) {
        var e = this.#p[this.#h];
        this.#$(!0);
        if (this.#A(e)) {
          if (e.__staleWhileFetching) {
            return e.__staleWhileFetching;
          }
        } else if (void 0 !== e) {
          return e;
        }
      }
    } finally {
      if (this.#E && this.#g) {
        var t = this.#g;
        var i;
        while (i = t?.shift()) {
          this.#s?.(...i);
        }
      }
    }
  }
  #$(e) {
    var t = this.#h;
    var i = this.#u[t];
    var r = this.#p[t];
    if (this.#T && this.#A(r)) {
      r.__abortController.abort(new Error("evicted"));
    } else if (this.#y || this.#E) {
      if (this.#y) {
        this.#r?.(r, i, "evict");
      }
      if (this.#E) {
        this.#g?.push([ r, i, "evict" ]);
      }
    }
    this.#I(t);
    if (e) {
      this.#u[t] = void 0;
      this.#p[t] = void 0;
      this.#v.push(t);
    }
    if (1 === this.#n) {
      this.#h = this.#d = 0;
      this.#v.length = 0;
    } else {
      this.#h = this.#f[t];
    }
    this.#l.delete(i);
    this.#n--;
    return t;
  }
  has(e, t = {}) {
    var {updateAgeOnHas: i = this.updateAgeOnHas, status: r} = t;
    var s = this.#l.get(e);
    if (void 0 !== s) {
      var a = this.#p[s];
      if (this.#A(a) && void 0 === a.__staleWhileFetching) {
        return !1;
      }
      if (!this.#F(s)) {
        if (i) {
          this.#_(s);
        }
        if (r) {
          r.has = "hit";
          this.#O(r, s);
        }
        return !0;
      } else if (r) {
        r.has = "stale";
        this.#O(r, s);
      }
    } else if (r) {
      r.has = "miss";
    }
    return !1;
  }
  peek(e, t = {}) {
    var {allowStale: i = this.allowStale} = t;
    var r = this.#l.get(e);
    if (void 0 !== r && (i || !this.#F(r))) {
      var s = this.#p[r];
      return this.#A(s) ? s.__staleWhileFetching : s;
    }
  }
  #b(e, t, i, r) {
    var s = void 0 === t ? void 0 : this.#p[t];
    if (this.#A(s)) {
      return s;
    }
    var a = new O;
    var {signal: n} = i;
    n?.addEventListener("abort", () => a.abort(n.reason), {
      signal: a.signal
    });
    var o = {
      signal: a.signal,
      options: i,
      context: r
    };
    var cb = (r, s = !1) => {
      var {aborted: n} = a.signal;
      var u = i.ignoreFetchAbort && void 0 !== r;
      if (i.status) {
        if (n && !s) {
          i.status.fetchAborted = !0;
          i.status.fetchError = a.signal.reason;
          if (u) {
            i.status.fetchAbortIgnored = !0;
          }
        } else {
          i.status.fetchResolved = !0;
        }
      }
      if (n && !u && !s) {
        return fetchFail(a.signal.reason);
      }
      if (this.#p[t] === l) {
        if (void 0 === r) {
          if (l.__staleWhileFetching) {
            this.#p[t] = l.__staleWhileFetching;
          } else {
            this.delete(e);
          }
        } else {
          if (i.status) {
            i.status.fetchUpdated = !0;
          }
          this.set(e, r, o.options);
        }
      }
      return r;
    };
    var fetchFail = r => {
      var {aborted: s} = a.signal;
      var n = s && i.allowStaleOnFetchAbort;
      var o = n || i.allowStaleOnFetchRejection;
      var u = l;
      if (this.#p[t] === l) {
        if (!(o || i.noDeleteOnFetchRejection) || void 0 === u.__staleWhileFetching) {
          this.delete(e);
        } else if (!n) {
          this.#p[t] = u.__staleWhileFetching;
        }
      }
      if (o) {
        if (i.status && void 0 !== u.__staleWhileFetching) {
          i.status.returnedStale = !0;
        }
        return u.__staleWhileFetching;
      } else if (u.__returned === u) {
        throw r;
      }
    };
    if (i.status) {
      i.status.fetchDispatched = !0;
    }
    var l = new Promise((t, r) => {
      var n = this.#a?.(e, s, o);
      if (n && n instanceof Promise) {
        n.then(e => t(void 0 === e ? void 0 : e), r);
      }
      a.signal.addEventListener("abort", () => {
        if (!i.ignoreFetchAbort || i.allowStaleOnFetchAbort) {
          t(void 0);
          if (i.allowStaleOnFetchAbort) {
            t = e => cb(e, !0);
          }
        }
      });
    }).then(cb, e => {
      if (i.status) {
        i.status.fetchRejected = !0;
        i.status.fetchError = e;
      }
      return fetchFail(e);
    });
    var u = Object.assign(l, {
      __abortController: a,
      __staleWhileFetching: s,
      __returned: void 0
    });
    if (void 0 === t) {
      this.set(e, u, {
        ...o.options,
        status: void 0
      });
      t = this.#l.get(e);
    } else {
      this.#p[t] = u;
    }
    return u;
  }
  #A(e) {
    if (!this.#T) {
      return !1;
    }
    var t = e;
    return !!t && t instanceof Promise && t.hasOwnProperty("__staleWhileFetching") && t.__abortController instanceof O;
  }
  async fetch(e, t = {}) {
    var {allowStale: i = this.allowStale, updateAgeOnGet: r = this.updateAgeOnGet, noDeleteOnStaleGet: s = this.noDeleteOnStaleGet, ttl: a = this.ttl, noDisposeOnSet: n = this.noDisposeOnSet, size: o = 0, sizeCalculation: l = this.sizeCalculation, noUpdateTTL: u = this.noUpdateTTL, noDeleteOnFetchRejection: p = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection: f = this.allowStaleOnFetchRejection, ignoreFetchAbort: c = this.ignoreFetchAbort, allowStaleOnFetchAbort: h = this.allowStaleOnFetchAbort, context: d, forceRefresh: v = !1, status: g, signal: m} = t;
    if (!this.#T) {
      if (g) {
        g.fetch = "get";
      }
      return this.get(e, {
        allowStale: i,
        updateAgeOnGet: r,
        noDeleteOnStaleGet: s,
        status: g
      });
    }
    var x = {
      allowStale: i,
      updateAgeOnGet: r,
      noDeleteOnStaleGet: s,
      ttl: a,
      noDisposeOnSet: n,
      size: o,
      sizeCalculation: l,
      noUpdateTTL: u,
      noDeleteOnFetchRejection: p,
      allowStaleOnFetchRejection: f,
      allowStaleOnFetchAbort: h,
      ignoreFetchAbort: c,
      status: g,
      signal: m
    };
    var S = this.#l.get(e);
    if (void 0 === S) {
      if (g) {
        g.fetch = "miss";
      }
      var y = this.#b(e, S, x, d);
      return y.__returned = y;
    } else {
      var T = this.#p[S];
      if (this.#A(T)) {
        var E = i && void 0 !== T.__staleWhileFetching;
        if (g) {
          g.fetch = "inflight";
          if (E) {
            g.returnedStale = !0;
          }
        }
        return E ? T.__staleWhileFetching : T.__returned = T;
      }
      var A = this.#F(S);
      if (!v && !A) {
        if (g) {
          g.fetch = "hit";
        }
        this.#D(S);
        if (r) {
          this.#_(S);
        }
        if (g) {
          this.#O(g, S);
        }
        return T;
      }
      var b = this.#b(e, S, x, d);
      var D = void 0 !== b.__staleWhileFetching && i;
      if (g) {
        g.fetch = A ? "stale" : "refresh";
        if (D && A) {
          g.returnedStale = !0;
        }
      }
      return D ? b.__staleWhileFetching : b.__returned = b;
    }
  }
  get(e, t = {}) {
    var {allowStale: i = this.allowStale, updateAgeOnGet: r = this.updateAgeOnGet, noDeleteOnStaleGet: s = this.noDeleteOnStaleGet, status: a} = t;
    var n = this.#l.get(e);
    if (void 0 !== n) {
      var o = this.#p[n];
      var l = this.#A(o);
      if (a) {
        this.#O(a, n);
      }
      if (this.#F(n)) {
        if (a) {
          a.get = "stale";
        }
        if (!l) {
          if (!s) {
            this.delete(e);
          }
          if (a && i) {
            a.returnedStale = !0;
          }
          return i ? o : void 0;
        } else {
          if (a && i && void 0 !== o.__staleWhileFetching) {
            a.returnedStale = !0;
          }
          return i ? o.__staleWhileFetching : void 0;
        }
      } else {
        if (a) {
          a.get = "hit";
        }
        if (l) {
          return o.__staleWhileFetching;
        }
        this.#D(n);
        if (r) {
          this.#_(n);
        }
        return o;
      }
    } else if (a) {
      a.get = "miss";
    }
  }
  #V(e, t) {
    this.#c[t] = e;
    this.#f[e] = t;
  }
  #D(e) {
    if (e !== this.#d) {
      if (e === this.#h) {
        this.#h = this.#f[e];
      } else {
        this.#V(this.#c[e], this.#f[e]);
      }
      this.#V(this.#d, e);
      this.#d = e;
    }
  }
  delete(e) {
    var t = !1;
    if (0 !== this.#n) {
      var i = this.#l.get(e);
      if (void 0 !== i) {
        t = !0;
        if (1 === this.#n) {
          this.clear();
        } else {
          this.#I(i);
          var r = this.#p[i];
          if (this.#A(r)) {
            r.__abortController.abort(new Error("deleted"));
          } else if (this.#y || this.#E) {
            if (this.#y) {
              this.#r?.(r, e, "delete");
            }
            if (this.#E) {
              this.#g?.push([ r, e, "delete" ]);
            }
          }
          this.#l.delete(e);
          this.#u[i] = void 0;
          this.#p[i] = void 0;
          if (i === this.#d) {
            this.#d = this.#c[i];
          } else if (i === this.#h) {
            this.#h = this.#f[i];
          } else {
            this.#f[this.#c[i]] = this.#f[i];
            this.#c[this.#f[i]] = this.#c[i];
          }
          this.#n--;
          this.#v.push(i);
        }
      }
    }
    if (this.#E && this.#g?.length) {
      var s = this.#g;
      var a;
      while (a = s?.shift()) {
        this.#s?.(...a);
      }
    }
    return t;
  }
  clear() {
    for (var e of this.#k({
      allowStale: !0
    })) {
      var t = this.#p[e];
      if (this.#A(t)) {
        t.__abortController.abort(new Error("deleted"));
      } else {
        var i = this.#u[e];
        if (this.#y) {
          this.#r?.(t, i, "delete");
        }
        if (this.#E) {
          this.#g?.push([ t, i, "delete" ]);
        }
      }
    }
    this.#l.clear();
    this.#p.fill(void 0);
    this.#u.fill(void 0);
    if (this.#S && this.#x) {
      this.#S.fill(0);
      this.#x.fill(0);
    }
    if (this.#m) {
      this.#m.fill(0);
    }
    this.#h = 0;
    this.#d = 0;
    this.#v.length = 0;
    this.#o = 0;
    this.#n = 0;
    if (this.#E && this.#g) {
      var r = this.#g;
      var s;
      while (s = r?.shift()) {
        this.#s?.(...s);
      }
    }
  }
}

var P = {
  exports: {}
};

var $ = {
  32: 16777619n,
  64: 1099511628211n,
  128: 309485009821345068724781371n,
  256: 374144419156711147060143317175368453031918731002211n,
  512: 35835915874844867368919076489095108449946327955754392558399825615420669938882575126094039892345713852759n,
  1024: 5016456510113118655434598811035278955030765345404790744303017523831112055108147451509157692220295382716162651878526895249385292291816524375083746691371804094271873160484737966720260389217684476157468082573n
};

var R = {
  32: 2166136261n,
  64: 14695981039346656037n,
  128: 144066263297769815596495629667062367629n,
  256: 100029257958052580907070968620625704837092796014241193945225284501741471925557n,
  512: 9659303129496669498009435400716310466090418745672637896108374329434462657994582932197716438449813051892206539805784495328239340083876191928701583869517785n,
  1024: 14197795064947621068722070641403218320880622795441933960878474914617582723252296732303717722150864096521202355549365628174669108571814760471015076148029755969804077320157692458563003215304957150157403644460363550505412711285966361610267868082893823963790439336411086884584107735010676915n
};

P.exports = function fnv1a(e) {
  var t = Number(R[32]);
  var i = !1;
  for (var r = 0; r < e.length; r++) {
    var s = e.charCodeAt(r);
    if (s > 127 && !i) {
      s = (e = unescape(encodeURIComponent(e))).charCodeAt(r);
      i = !0;
    }
    t ^= s;
    t += (t << 1) + (t << 4) + (t << 7) + (t << 8) + (t << 24);
  }
  return t >>> 0;
};

P.exports.bigInt = function bigInt(e, {size: t = 32} = {}) {
  if (!$[t]) {
    throw new Error("The `size` option must be one of 32, 64, 128, 256, 512, or 1024");
  }
  var i = R[t];
  var r = $[t];
  var s = !1;
  for (var a = 0; a < e.length; a++) {
    var n = e.charCodeAt(a);
    if (n > 127 && !s) {
      n = (e = unescape(encodeURIComponent(e))).charCodeAt(a);
      s = !0;
    }
    i ^= BigInt(n);
    i = BigInt.asUintN(t, i * r);
  }
  return i;
};

var V = getDefaultExportFromCjs(P.exports);

var j = 52005;

var unwrapAbstractType = e => e.isUnionOrIntersection() ? e.types.find(e => e.flags & exports.ts.TypeFlags.Object) || e : e;

var getVariableDeclaration = e => {
  var t = e;
  var i = new Set;
  while (t.parent && !i.has(t)) {
    i.add(t);
    if (exports.ts.isBlock(t)) {
      return;
    } else if (exports.ts.isVariableDeclaration(t = t.parent)) {
      return t;
    }
  }
};

var traverseArrayDestructuring = (e, t, i, r, s) => e.elements.flatMap(e => {
  if (exports.ts.isOmittedExpression(e)) {
    return [];
  }
  var a = [ ...t ];
  return exports.ts.isIdentifier(e.name) ? crawlScope(e.name, a, i, r, s, !1) : exports.ts.isObjectBindingPattern(e.name) ? traverseDestructuring(e.name, a, i, r, s) : traverseArrayDestructuring(e.name, a, i, r, s);
});

var traverseDestructuring = (e, t, i, r, s) => {
  var a = [];
  var _loop = function() {
    if (exports.ts.isObjectBindingPattern(n.name)) {
      var e = [ ...t ];
      if (n.propertyName && !t.includes(n.propertyName.getText())) {
        var o = [ ...e, n.propertyName.getText() ].join(".");
        if (i.find(e => e.startsWith(o))) {
          e.push(n.propertyName.getText());
        }
      }
      var l = traverseDestructuring(n.name, e, i, r, s);
      a.push(...l);
    } else if (exports.ts.isIdentifier(n.name)) {
      var u = [ ...t ];
      if (n.propertyName && !t.includes(n.propertyName.getText())) {
        var p = [ ...u, n.propertyName.getText() ].join(".");
        if (i.find(e => e.startsWith(p))) {
          u.push(n.propertyName.getText());
        }
      } else {
        var f = [ ...u, n.name.getText() ].join(".");
        if (i.find(e => e.startsWith(f))) {
          u.push(n.name.getText());
        }
      }
      var c = crawlScope(n.name, u, i, r, s, !1);
      a.push(...c);
    }
  };
  for (var n of e.elements) {
    _loop();
  }
  return a;
};

var B = new Set([ "map", "filter", "forEach", "reduce", "every", "some", "find", "flatMap", "sort" ]);

var crawlChainedExpressions = (e, t, i, r, s) => {
  if (exports.ts.isPropertyAccessExpression(e.expression) && B.has(e.expression.name.text)) {
    var a = "reduce" === e.expression.name.text;
    var n = e.arguments[0];
    var o = [];
    if (exports.ts.isCallExpression(e.parent.parent)) {
      var l = crawlChainedExpressions(e.parent.parent, t, i, r, s);
      if (l.length) {
        o.push(...l);
      }
    }
    if (n && exports.ts.isIdentifier(n)) {
      var u = getValueOfIdentifier(n, s.languageService.getProgram().getTypeChecker());
      if (u && (exports.ts.isFunctionDeclaration(u) || exports.ts.isFunctionExpression(u) || exports.ts.isArrowFunction(u))) {
        n = u;
      }
    }
    if (n && (exports.ts.isFunctionDeclaration(n) || exports.ts.isFunctionExpression(n) || exports.ts.isArrowFunction(n))) {
      var p = n.parameters[a ? 1 : 0];
      if (p) {
        var f = crawlScope(p.name, t, i, r, s, !0);
        if (f.length) {
          o.push(...f);
        }
      }
    }
    return o;
  }
  return [];
};

var crawlScope = (e, t, i, r, s, a) => {
  if (exports.ts.isObjectBindingPattern(e)) {
    return traverseDestructuring(e, t, i, r, s);
  } else if (exports.ts.isArrayBindingPattern(e)) {
    return traverseArrayDestructuring(e, t, i, r, s);
  }
  var n = [];
  var o = s.languageService.getReferencesAtPosition(r.fileName, e.getStart());
  if (!o) {
    return n;
  }
  return n = o.flatMap(n => {
    if (n.fileName !== r.fileName) {
      return [];
    }
    if (e.getStart() <= n.textSpan.start && e.getEnd() >= n.textSpan.start + n.textSpan.length) {
      return [];
    }
    var o = findNode(r, n.textSpan.start);
    if (!o) {
      return [];
    }
    var l = [ ...t ];
    var u, _loop2 = function() {
      if (!a && (exports.ts.isReturnStatement(o) || exports.ts.isArrowFunction(o))) {
        var e = l.join(".");
        return {
          v: i.filter(t => t.startsWith(e + "."))
        };
      } else if (exports.ts.isVariableDeclaration(o)) {
        return {
          v: crawlScope(o.name, l, i, r, s, !1)
        };
      } else if (exports.ts.isIdentifier(o) && !l.includes(o.text)) {
        var t = [ ...l, o.text ].join(".");
        if (i.find(e => e.startsWith(t + "."))) {
          l.push(o.text);
        }
        if (exports.ts.isCallExpression(o.parent)) {
          return {
            v: o.parent.arguments.flatMap(e => {
              var t = [ ...l ];
              var r = e;
              var _loop3 = function() {
                var e = [ ...t, r.name.text ].join(".");
                if (i.find(t => t.startsWith(e + "."))) {
                  t.push(r.name.text);
                }
                r = r.expression;
              };
              while (exports.ts.isPropertyAccessExpression(r)) {
                _loop3();
              }
              if (exports.ts.isIdentifier(r)) {
                var s = [ ...t, r.getText() ].join(".");
                if (i.find(e => e.startsWith(s + "."))) {
                  t.push(r.getText());
                }
              }
              var a = t.join(".");
              return i.filter(e => e.startsWith(a + "."));
            })
          };
        }
      } else if (exports.ts.isPropertyAccessExpression(o) && "at" === o.name.text && exports.ts.isCallExpression(o.parent)) {
        o = o.parent;
      } else if (exports.ts.isPropertyAccessExpression(o) && B.has(o.name.text) && exports.ts.isCallExpression(o.parent)) {
        var n = o.parent;
        var u = [];
        var p = "some" === o.name.text || "every" === o.name.text;
        var f = crawlChainedExpressions(n, l, i, r, s);
        if (f.length) {
          u.push(...f);
        }
        if (exports.ts.isVariableDeclaration(n.parent) && !p) {
          var c = crawlScope(n.parent.name, l, i, r, s, !0);
          u.push(...c);
        }
        return {
          v: u
        };
      } else if (exports.ts.isPropertyAccessExpression(o) && !l.includes(o.name.text)) {
        var h = [ ...l, o.name.text ].join(".");
        if (i.find(e => e.startsWith(h))) {
          l.push(o.name.text);
        }
      } else if (exports.ts.isElementAccessExpression(o) && exports.ts.isStringLiteral(o.argumentExpression) && !l.includes(o.argumentExpression.text)) {
        var d = [ ...l, o.argumentExpression.text ].join(".");
        if (i.find(e => e.startsWith(d))) {
          l.push(o.argumentExpression.text);
        }
      }
      if (exports.ts.isNonNullExpression(o.parent)) {
        o = o.parent.parent;
      } else {
        o = o.parent;
      }
    };
    while (exports.ts.isIdentifier(o) || exports.ts.isPropertyAccessExpression(o) || exports.ts.isElementAccessExpression(o) || exports.ts.isVariableDeclaration(o) || exports.ts.isBinaryExpression(o) || exports.ts.isReturnStatement(o) || exports.ts.isArrowFunction(o)) {
      if (u = _loop2()) {
        return u.v;
      }
    }
    return l.join(".");
  });
};

var getColocatedFragmentNames = (e, t) => {
  var i = function findAllImports(e) {
    return e.statements.filter(exports.ts.isImportDeclaration);
  }(e);
  var r = t.languageService.getProgram()?.getTypeChecker();
  var s = {};
  if (!r) {
    return s;
  }
  if (i.length) {
    i.forEach(e => {
      if (!e.importClause) {
        return;
      }
      if (e.importClause.name) {
        var i = getDeclarationOfIdentifier(e.importClause.name, r);
        if (i) {
          var a = i.getSourceFile();
          if (a.fileName.includes("node_modules")) {
            return;
          }
          if (!a) {
            return;
          }
          var n = getFragmentsInSource(a, r, t).map(e => e.name.value);
          var o = e.moduleSpecifier.getText();
          var l = s[o];
          if (n.length && l) {
            l.fragments = l.fragments.concat(n);
          } else if (n.length && !l) {
            s[o] = l = {
              start: e.moduleSpecifier.getStart(),
              length: e.moduleSpecifier.getText().length,
              fragments: n
            };
          }
        }
      }
      if (e.importClause.namedBindings && exports.ts.isNamespaceImport(e.importClause.namedBindings)) {
        var u = getDeclarationOfIdentifier(e.importClause.namedBindings.name, r);
        if (u) {
          var p = u.getSourceFile();
          if (p.fileName.includes("node_modules")) {
            return;
          }
          if (!p) {
            return;
          }
          var f = getFragmentsInSource(p, r, t).map(e => e.name.value);
          var c = e.moduleSpecifier.getText();
          var h = s[c];
          if (f.length && h) {
            h.fragments = h.fragments.concat(f);
          } else if (f.length && !h) {
            s[c] = h = {
              start: e.moduleSpecifier.getStart(),
              length: e.moduleSpecifier.getText().length,
              fragments: f
            };
          }
        }
      } else if (e.importClause.namedBindings && exports.ts.isNamedImportBindings(e.importClause.namedBindings)) {
        e.importClause.namedBindings.elements.forEach(i => {
          var a = i.name || i.propertyName;
          if (!a) {
            return;
          }
          var n = getDeclarationOfIdentifier(a, r);
          if (n) {
            var o = n.getSourceFile();
            if (o.fileName.includes("node_modules")) {
              return;
            }
            if (!o) {
              return;
            }
            var l = getFragmentsInSource(o, r, t).map(e => e.name.value);
            var u = e.moduleSpecifier.getText();
            var p = s[u];
            if (l.length && p) {
              p.fragments = p.fragments.concat(l);
            } else if (l.length && !p) {
              s[u] = p = {
                start: e.moduleSpecifier.getStart(),
                length: e.moduleSpecifier.getText().length,
                fragments: l
              };
            }
          }
        });
      }
    });
  }
  return s;
};

function getFragmentsInSource(t, i, r) {
  var s = [];
  var a = findAllCallExpressions(t, r, !1);
  var n = i.getSymbolAtLocation(t);
  if (!n) {
    return [];
  }
  var o = i.getExportsOfModule(n).map(e => e.name);
  a.nodes.filter(e => {
    var t = e.node.parent;
    while (t && !exports.ts.isSourceFile(t) && !exports.ts.isVariableDeclaration(t)) {
      t = t.parent;
    }
    if (exports.ts.isVariableDeclaration(t)) {
      return o.includes(t.name.getText());
    } else {
      return !1;
    }
  }).forEach(t => {
    var i = resolveTemplate(t.node, 0, r).combinedText;
    try {
      var a = e.parse(i, {
        noLocation: !0
      });
      if (a.definitions.every(t => t.kind === e.Kind.FRAGMENT_DEFINITION)) {
        s = s.concat(a.definitions);
      }
    } catch (e) {
      return;
    }
  });
  return s;
}

var generateHashForDocument = (e, i, r, s) => {
  if (s) {
    var a = [];
    unrollTadaFragments(s, a, e);
    var n = resolveTemplate(i, 0, e).combinedText;
    var o = parse(n);
    var l = new Set;
    for (var u of o.definitions) {
      if (u.kind === f && !l.has(u)) {
        stripUnmaskDirectivesFromDefinition(u);
      }
    }
    a.map(e => {
      stripUnmaskDirectivesFromDefinition(e);
      return print(e);
    }).filter((e, t, i) => i.indexOf(e) === t).forEach(e => {
      n = `${n}\n\n${e}`;
    });
    var p = print(parse(n));
    return t.createHash("sha256").update(p).digest("hex");
  } else {
    var c = getSource(e, r);
    var {fragments: h} = findAllCallExpressions(c, e);
    var d = resolveTemplate(i, 0, e).combinedText;
    var v = parse(d);
    var g = new Set;
    for (var m of v.definitions) {
      if (m.kind === f && !g.has(m)) {
        stripUnmaskDirectivesFromDefinition(m);
      }
    }
    var x = new Set;
    visit(v, {
      FragmentDefinition: e => {
        h.push(e);
      },
      FragmentSpread: e => {
        x.add(e.name.value);
      }
    });
    var S = d;
    var y = new Set;
    var T = [ ...x ];
    var E;
    while (E = T.shift()) {
      y.add(E);
      var A = h.find(e => e.name.value === E);
      if (!A) {
        e.project.projectService.logger.info(`[GraphQLSP] could not find fragment for spread ${E}!`);
        return;
      }
      stripUnmaskDirectivesFromDefinition(A);
      visit(A, {
        FragmentSpread: e => {
          if (!y.has(e.name.value)) {
            T.push(e.name.value);
          }
        }
      });
      S = `${S}\n\n${print(A)}`;
    }
    return t.createHash("sha256").update(print(parse(S))).digest("hex");
  }
};

var getDocumentReferenceFromTypeQuery = (e, t, i) => {
  var r = i.languageService.getProgram()?.getTypeChecker();
  if (!r) {
    return {
      node: null,
      filename: t
    };
  }
  var s;
  if (exports.ts.isIdentifier(e.exprName)) {
    s = e.exprName;
  } else if (exports.ts.isQualifiedName(e.exprName)) {
    s = e.exprName.right;
  }
  if (!s) {
    return {
      node: null,
      filename: t
    };
  }
  var a = getValueOfIdentifier(s, r);
  if (!a || !isGraphQLCall(a, r)) {
    return {
      node: null,
      filename: t
    };
  }
  return {
    node: a,
    filename: a.getSourceFile().fileName
  };
};

var getDocumentReferenceFromDocumentNode = (e, t, i) => {
  if (exports.ts.isIdentifier(e)) {
    var r = i.languageService.getProgram()?.getTypeChecker();
    if (!r) {
      return {
        node: null,
        filename: t
      };
    }
    var s = getValueOfIdentifier(e, r);
    if (!s || !isGraphQLCall(s, r)) {
      return {
        node: null,
        filename: t
      };
    }
    return {
      node: s,
      filename: s.getSourceFile().fileName
    };
  } else {
    return {
      node: e,
      filename: t
    };
  }
};

var stripUnmaskDirectivesFromDefinition = e => {
  e.directives = e.directives?.filter(e => "_unmask" !== e.name.value);
};

var K = new Set([ "populate", "client", "unmask", "_unmask", "_optional", "_relayPagination", "_simplePagination", "_required", "optional", "required", "arguments", "argumentDefinitions", "connection", "refetchable", "relay", "required", "inline" ]);

var M = 520100;

var W = 520101;

var U = 520102;

var G = 520103;

var q = [ 52001, 52004, 52003, j, M, W, U, G ];

var Q = new LRUCache({
  ttl: 9e5,
  max: 5e3
});

var runDiagnostics = (t, {nodes: i, fragments: r}, s, a) => {
  var n = a.config.templateIsCallExpression ?? !0;
  var o = a.languageService.getProgram()?.getTypeChecker();
  var l = i.map(t => {
    var i = t.node;
    if (!n && (exports.ts.isNoSubstitutionTemplateLiteral(i) || exports.ts.isTemplateExpression(i))) {
      if (exports.ts.isTaggedTemplateExpression(i.parent)) {
        i = i.parent;
      } else {
        return;
      }
    }
    var {combinedText: l, resolvedSpans: u} = resolveTemplate(i, 0, a);
    var p = l.split("\n");
    var f = !1;
    if (exports.ts.isAsExpression(i.parent)) {
      if (exports.ts.isExpressionStatement(i.parent.parent)) {
        f = !0;
      }
    } else if (exports.ts.isExpressionStatement(i.parent)) {
      f = !0;
    }
    var c = i.getStart() + (n ? 0 : i.tag.getText().length + (f ? 2 : 0));
    var h = c + i.getText().length;
    var d = [ ...r ];
    if (void 0 !== t.tadaFragmentRefs) {
      var v = new Set;
      for (var g of t.tadaFragmentRefs) {
        unrollFragment(g, 0, o).forEach(e => v.add(e.name.value));
      }
      d = d.filter(e => v.has(e.name.value));
    }
    if (n) {
      try {
        var m = e.parse(l, {
          noLocation: !0
        }).definitions.filter(t => t.kind === e.Kind.FRAGMENT_DEFINITION);
        d = d.filter(t => !m.some(i => i.kind === e.Kind.FRAGMENT_DEFINITION && i.name.value === t.name.value));
      } catch (e) {}
    }
    var x = t.schema && s.multi[t.schema] ? s.multi[t.schema]?.schema : s.current?.schema;
    if (!x) {
      return;
    }
    var S = new Set([ ...K, ...a.config.clientDirectives || [] ]);
    var y = getDiagnostics(l, x, void 0, void 0, d).filter(e => {
      if (!e.message.includes("Unknown directive")) {
        return !0;
      }
      var [t] = e.message.split("(");
      var i = t && /Unknown directive "@([^)]+)"/g.exec(t);
      if (!i) {
        return !0;
      }
      var r = i[1];
      return r && !S.has(r);
    }).map(e => {
      var {start: t, end: i} = e.range;
      var r = c + t.line;
      for (var s = 0; s <= t.line && s < p.length; s++) {
        if (s === t.line) {
          r += t.character;
        } else if (p[s]) {
          r += p[s].length;
        }
      }
      var a = c + i.line;
      for (var n = 0; n <= i.line && n < p.length; n++) {
        if (n === i.line) {
          a += i.character;
        } else if (p[n]) {
          a += p[n].length;
        }
      }
      var o = u.find(e => r >= e.new.start && a <= e.new.start + e.new.length);
      if (o) {
        return {
          ...e,
          start: o.original.start,
          length: o.original.length
        };
      } else if (r > h) {
        var l = u.filter(e => e.new.start + e.new.length < r).reduce((e, t) => e + (t.new.length - t.original.length), 0);
        r -= l;
        a -= l;
        return {
          ...e,
          start: r + 1,
          length: a - r
        };
      } else {
        return {
          ...e,
          start: r + 1,
          length: a - r
        };
      }
    }).filter(e => e.start + e.length <= h);
    return y;
  }).flat().filter(Boolean);
  var u = l.map(e => ({
    file: t,
    length: e.length,
    start: e.start,
    category: 2 === e.severity ? exports.ts.DiagnosticCategory.Warning : exports.ts.DiagnosticCategory.Error,
    code: "number" == typeof e.code ? e.code : 2 === e.severity ? 52004 : 52001,
    messageText: e.message.split("\n")[0]
  }));
  if (n) {
    var p = ((t, i, r) => {
      var s = [];
      if (!(r.config.trackFieldUsage ?? 1)) {
        return s;
      }
      var a = new Set([ "id", "_id", "__typename", ...r.config.reservedKeys ?? [] ]);
      var n = r.languageService.getProgram()?.getTypeChecker();
      if (!n) {
        return;
      }
      try {
        i.forEach(i => {
          var o = i.getText();
          if (o.includes("mutation") || o.includes("subscription")) {
            return;
          }
          var l = getVariableDeclaration(i);
          if (!l) {
            return;
          }
          var u;
          var p = n.getTypeAtLocation(i.parent);
          if ("target" in p) {
            var f = p.resolvedTypeArguments;
            u = f && f.length > 1 ? f[0] : void 0;
          }
          if (!u) {
            var c = p.getProperty("__apiType");
            if (c) {
              var h = n.getTypeOfSymbol(c);
              var d = p.getCallSignatures()[0];
              if (h.isUnionOrIntersection()) {
                for (var v of h.types) {
                  if (d = v.getCallSignatures()[0]) {
                    u = d.getReturnType();
                    break;
                  }
                }
              }
              u = d && d.getReturnType();
            }
          }
          var g = r.languageService.getReferencesAtPosition(t.fileName, l.name.getStart());
          if (!g) {
            return;
          }
          var m = [];
          var x = [];
          var S = [];
          var y = new Map;
          e.visit(e.parse(i.getText().slice(1, -1)), {
            Field: {
              enter(e) {
                var t = e.alias ? e.alias.value : e.name.value;
                var i = x.length ? `${x.join(".")}.${t}` : t;
                if (!e.selectionSet && !a.has(e.name.value)) {
                  S.push(i);
                  y.set(i, {
                    start: e.name.loc.start,
                    length: e.name.loc.end - e.name.loc.start
                  });
                } else if (e.selectionSet) {
                  x.push(t);
                  y.set(i, {
                    start: e.name.loc.start,
                    length: e.name.loc.end - e.name.loc.start
                  });
                }
              },
              leave(e) {
                if (e.selectionSet) {
                  x.pop();
                }
              }
            }
          });
          g.forEach(e => {
            if (e.fileName !== t.fileName) {
              return;
            }
            var i = findNode(t, e.textSpan.start);
            if (!i) {
              return;
            }
            if (i.parent === l) {
              return;
            }
            var s = n.getSymbolsInScope(i, exports.ts.SymbolFlags.BlockScopedVariable);
            var a;
            for (var o of s) {
              if (!o.valueDeclaration) {
                continue;
              }
              var p = unwrapAbstractType(n.getTypeOfSymbol(o));
              if (u === p) {
                a = o;
                break;
              }
              if (p.flags & exports.ts.TypeFlags.Object) {
                var f = p.getProperty("0");
                if (f) {
                  p = n.getTypeOfSymbol(f);
                  if (u === p) {
                    a = o;
                    break;
                  }
                }
                var c = p.getProperty("data");
                if (c) {
                  p = unwrapAbstractType(n.getTypeOfSymbol(c));
                  if (u === p) {
                    a = o;
                    break;
                  }
                }
              }
            }
            var h = a?.valueDeclaration;
            var d;
            if (h && "name" in h && h.name && (exports.ts.isIdentifier(h.name) || exports.ts.isBindingName(h.name))) {
              d = h.name;
            } else {
              var v = getVariableDeclaration(i);
              if (v) {
                d = v.name;
              }
            }
            if (d) {
              var g = crawlScope(d, [], S, t, r, !1);
              m.push(...g);
            }
          });
          if (!m.length) {
            return;
          }
          var T = S.filter(e => !m.includes(e));
          var E = new Set;
          var A = {};
          var b = new Set;
          T.forEach(e => {
            var t = e.split(".");
            t.pop();
            var i = t.join(".");
            if (y.get(i)) {
              E.add(i);
              if (A[i]) {
                A[i].add(e);
              } else {
                A[i] = new Set([ e ]);
              }
            } else {
              b.add(e);
            }
          });
          E.forEach(e => {
            var r = y.get(e);
            var a = A[e];
            s.push({
              file: t,
              length: r.length,
              start: i.getStart() + r.start + 1,
              category: exports.ts.DiagnosticCategory.Warning,
              code: j,
              messageText: `Field(s) ${[ ...a ].map(e => `'${e}'`).join(", ")} are not used.`
            });
          });
          b.forEach(e => {
            var r = y.get(e);
            s.push({
              file: t,
              length: r.length,
              start: i.getStart() + r.start + 1,
              category: exports.ts.DiagnosticCategory.Warning,
              code: j,
              messageText: `Field ${e} is not used.`
            });
          });
        });
      } catch (e) {
        console.error("[GraphQLSP]: ", e.message, e.stack);
      }
      return s;
    })(t, i.map(e => e.node), a) || [];
    if (!p) {
      return u;
    }
    return [ ...u, ...p ];
  } else {
    return u;
  }
};

exports.ALL_DIAGNOSTICS = q;

exports.CharacterStream = CharacterStream;

exports.bubbleUpCallExpression = function bubbleUpCallExpression(e) {
  while (exports.ts.isStringLiteralLike(e) || exports.ts.isToken(e) || exports.ts.isTemplateExpression(e) || exports.ts.isTemplateSpan(e)) {
    e = e.parent;
  }
  return e;
};

exports.bubbleUpTemplate = function bubbleUpTemplate(e) {
  while (exports.ts.isNoSubstitutionTemplateLiteral(e) || exports.ts.isToken(e) || exports.ts.isTemplateExpression(e) || exports.ts.isTemplateSpan(e)) {
    e = e.parent;
  }
  return e;
};

exports.findAllCallExpressions = findAllCallExpressions;

exports.findAllPersistedCallExpressions = findAllPersistedCallExpressions;

exports.findNode = findNode;

exports.getAllFragments = getAllFragments;

exports.getDocumentReferenceFromDocumentNode = getDocumentReferenceFromDocumentNode;

exports.getDocumentReferenceFromTypeQuery = getDocumentReferenceFromTypeQuery;

exports.getGraphQLDiagnostics = function getGraphQLDiagnostics(t, i, r) {
  var s = r.config.templateIsCallExpression ?? !0;
  var a = getSource(r, t);
  if (!a) {
    return;
  }
  var n, o = [];
  if (s) {
    var l = findAllCallExpressions(a, r);
    o = l.fragments;
    n = l.nodes;
  } else {
    n = function findAllTaggedTemplateNodes(e) {
      var t = [];
      !function find(e) {
        if (isGraphQLTag(e) || exports.ts.isNoSubstitutionTemplateLiteral(e) && isGraphQLTag(e.parent)) {
          t.push(e);
          return;
        } else {
          exports.ts.forEachChild(e, find);
        }
      }(e);
      return t;
    }(a).map(e => ({
      node: e,
      schema: null
    }));
  }
  var u = n.map(({node: e}) => {
    if ((exports.ts.isNoSubstitutionTemplateLiteral(e) || exports.ts.isTemplateExpression(e)) && !s) {
      if (exports.ts.isTaggedTemplateExpression(e.parent)) {
        e = e.parent;
      } else {
        return;
      }
    }
    return resolveTemplate(e, 0, r).combinedText;
  });
  var p = V(s ? a.getText() + o.map(e => print(e)).join("-") + i.version : u.join("-") + i.version);
  var f;
  if (Q.has(p)) {
    f = Q.get(p);
  } else {
    f = runDiagnostics(a, {
      nodes: n,
      fragments: o
    }, i, r);
    Q.set(p, f);
  }
  var c = r.config.shouldCheckForColocatedFragments ?? !0;
  var h = [];
  if (s) {
    var d = findAllPersistedCallExpressions(a, r).map(e => {
      var {node: i} = e;
      if (!i.typeArguments && !i.arguments[1]) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: M,
          file: a,
          messageText: "Missing generic pointing at the GraphQL document.",
          start: i.getStart(),
          length: i.getEnd() - i.getStart()
        };
      }
      var s, n, o, l, u = t;
      var p = i.typeArguments && i.typeArguments[0];
      if (p) {
        o = p.getStart();
        l = p.getEnd() - p.getStart();
        if (!exports.ts.isTypeQueryNode(p)) {
          return {
            category: exports.ts.DiagnosticCategory.Warning,
            code: M,
            file: a,
            messageText: "Provided generic should be a typeQueryNode in the shape of graphql.persisted<typeof document>.",
            start: o,
            length: l
          };
        }
        var {node: f, filename: c} = getDocumentReferenceFromTypeQuery(p, t, r);
        s = f;
        u = c;
        n = p.getText();
      } else if (i.arguments[1]) {
        o = i.arguments[1].getStart();
        l = i.arguments[1].getEnd() - i.arguments[1].getStart();
        if (!exports.ts.isIdentifier(i.arguments[1]) && !exports.ts.isCallExpression(i.arguments[1])) {
          return {
            category: exports.ts.DiagnosticCategory.Warning,
            code: M,
            file: a,
            messageText: 'Provided argument should be an identifier or invocation of "graphql" in the shape of graphql.persisted(hash, document).',
            start: o,
            length: l
          };
        }
        var {node: h, filename: d} = getDocumentReferenceFromDocumentNode(i.arguments[1], t, r);
        s = h;
        u = d;
        n = i.arguments[1].getText();
      }
      if (!s) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: U,
          file: a,
          messageText: `Can't find reference to "${n}".`,
          start: o,
          length: l
        };
      }
      var v = s;
      if (!(v && exports.ts.isCallExpression(v) && v.arguments[0] && exports.ts.isStringLiteralLike(v.arguments[0]))) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: U,
          file: a,
          messageText: `Referenced type "${n}" is not a GraphQL document.`,
          start: o,
          length: l
        };
      }
      if (!i.arguments[0]) {
        return {
          category: exports.ts.DiagnosticCategory.Warning,
          code: W,
          file: a,
          messageText: "The call-expression is missing a hash for the persisted argument.",
          start: i.arguments.pos,
          length: i.arguments.end - i.arguments.pos
        };
      }
      var g = i.arguments[0].getText().slice(1, -1);
      if (g.startsWith("sha256:")) {
        var m = generateHashForDocument(r, v.arguments[0], u, v.arguments[1] && exports.ts.isArrayLiteralExpression(v.arguments[1]) ? v.arguments[1] : void 0);
        if (!m) {
          return null;
        }
        if (`sha256:${m}` !== g) {
          return {
            category: exports.ts.DiagnosticCategory.Warning,
            code: G,
            file: a,
            messageText: "The persisted document's hash is outdated",
            start: i.arguments.pos,
            length: i.arguments.end - i.arguments.pos
          };
        }
      }
      return null;
    }).filter(Boolean);
    f.push(...d);
  }
  if (s && c) {
    var v = getColocatedFragmentNames(a, r);
    var g = r.languageService.getProgram()?.getTypeChecker();
    var m = new Set;
    n.forEach(({node: t}) => {
      try {
        var i = e.parse(t.getText().slice(1, -1), {
          noLocation: !0
        });
        e.visit(i, {
          FragmentSpread: e => {
            m.add(e.name.value);
          }
        });
      } catch (e) {}
    });
    findAllMaskFragmentsCalls(a).forEach(e => {
      var t = e.arguments[0];
      if (!t) {
        return;
      }
      if (exports.ts.isArrayLiteralExpression(t)) {
        t.elements.forEach(e => {
          if (exports.ts.isIdentifier(e)) {
            unrollFragment(e, 0, g).forEach(e => m.add(e.name.value));
          }
        });
      }
    });
    Object.keys(v).forEach(e => {
      var {fragments: t, start: i, length: r} = v[e];
      var s = Array.from(new Set(t.filter(e => !m.has(e))));
      if (s.length) {
        h.push({
          file: a,
          length: r,
          start: i,
          category: exports.ts.DiagnosticCategory.Warning,
          code: 52003,
          messageText: `Unused co-located fragment definition(s) "${s.join(", ")}" in ${e}`
        });
      }
    });
    return [ ...f, ...h ];
  } else {
    return f;
  }
};

exports.getPersistedCodeFixAtPosition = function getPersistedCodeFixAtPosition(e, t, i) {
  var r = i.config.templateIsCallExpression ?? !0;
  var s = i.languageService.getProgram()?.getTypeChecker();
  if (!r) {
    return;
  }
  var a = getSource(i, e);
  if (!a) {
    return;
  }
  var n = findNode(a, t);
  if (!n) {
    return;
  }
  var o = n;
  if (exports.ts.isVariableStatement(o)) {
    o = o.declarationList.declarations.find(e => exports.ts.isVariableDeclaration(e) && e.initializer && exports.ts.isCallExpression(e.initializer)) || n;
  } else if (exports.ts.isVariableDeclarationList(o)) {
    o = o.declarations.find(e => exports.ts.isVariableDeclaration(e) && e.initializer && exports.ts.isCallExpression(e.initializer)) || n;
  } else if (exports.ts.isVariableDeclaration(o) && o.initializer && exports.ts.isCallExpression(o.initializer)) {
    o = o.initializer;
  } else {
    while (o && !exports.ts.isCallExpression(o)) {
      o = o.parent;
    }
  }
  if (!isTadaPersistedCall(o, s)) {
    return;
  }
  var l, u = e;
  if (o.typeArguments) {
    var [p] = o.typeArguments;
    if (!p || !exports.ts.isTypeQueryNode(p)) {
      return;
    }
    var {node: f, filename: c} = getDocumentReferenceFromTypeQuery(p, e, i);
    l = f;
    u = c;
  } else if (o.arguments[1]) {
    if (!exports.ts.isIdentifier(o.arguments[1]) && !exports.ts.isCallExpression(o.arguments[1])) {
      return;
    }
    var {node: h, filename: d} = getDocumentReferenceFromDocumentNode(o.arguments[1], e, i);
    l = h;
    u = d;
  }
  if (!l) {
    return;
  }
  var v = l;
  if (!(v && exports.ts.isCallExpression(v) && v.arguments[0] && exports.ts.isStringLiteralLike(v.arguments[0]))) {
    return;
  }
  var g = generateHashForDocument(i, v.arguments[0], u, v.arguments[1] && exports.ts.isArrayLiteralExpression(v.arguments[1]) ? v.arguments[1] : void 0);
  var m = o.arguments[0];
  if (!m) {
    return {
      span: {
        start: o.arguments.pos,
        length: 1
      },
      replacement: `"sha256:${g}")`
    };
  } else if (exports.ts.isStringLiteral(m) && m.getText() !== `"sha256:${g}"`) {
    return {
      span: {
        start: m.getStart(),
        length: m.end - m.getStart()
      },
      replacement: `"sha256:${g}"`
    };
  } else if (exports.ts.isIdentifier(m)) {
    return {
      span: {
        start: m.getStart(),
        length: m.end - m.getStart()
      },
      replacement: `"sha256:${g}"`
    };
  } else {
    return;
  }
};

exports.getSchemaName = getSchemaName;

exports.getSource = getSource;

exports.init = function init(e) {
  exports.ts = e.typescript;
};

exports.isGraphQLCall = isGraphQLCall;

exports.isGraphQLTag = isGraphQLTag;

exports.onlineParser = onlineParser;

exports.print = print;

exports.resolveTemplate = resolveTemplate;

exports.templates = C;

exports.unrollTadaFragments = unrollTadaFragments;
//# sourceMappingURL=api-chunk.js.map
