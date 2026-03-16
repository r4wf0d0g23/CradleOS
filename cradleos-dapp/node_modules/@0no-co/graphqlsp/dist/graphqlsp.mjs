import { C as e, o as t, t as n, g as r, f as i, b as a, a as o, i as u, c as s, d as c, p as l, e as d, r as f, h as v, j as p, A as g, k as m, l as E } from "./chunks/api-chunk.mjs";

import T from "node:fs/promises";

import I from "path";

import { loadRef as y, resolveTypeScriptRootDir as S, minifyIntrospection as b, outputIntrospectionFile as h } from "@gql.tada/internal";

import { SchemaMetaFieldDef as N, TypeMetaFieldDef as D, TypeNameMetaFieldDef as A, isCompositeType as _, Kind as k, isScalarType as F, isObjectType as L, isInterfaceType as O, isUnionType as C, isEnumType as M, isInputObjectType as x, getNamedType as P, isOutputType as R, isInputType as U, GraphQLEnumType as w, GraphQLBoolean as j, isAbstractType as V, assertAbstractType as Y, doTypesOverlap as $, DirectiveLocation as B, visit as G, parse as Q, BREAK as X, isListType as J, isNonNullType as K, GraphQLInterfaceType as z, GraphQLObjectType as H, GraphQLInputObjectType as W, getNullableType as q, GraphQLList as Z, GraphQLNonNull as ee } from "graphql";

var statFile = (e, t) => T.stat(e).then(t).catch(() => !1);

var swapWrite = async (e, t) => {
  if (!await statFile(e, e => e.isFile())) {
    await T.writeFile(e, t);
  } else {
    var n = e + ".tmp";
    await T.writeFile(n, t);
    try {
      await T.rename(n, e);
    } catch (e) {
      await T.unlink(n);
      throw e;
    } finally {
      await (async e => {
        try {
          var t = new Date;
          await T.utimes(e, t, t);
        } catch (e) {}
      })(e);
    }
  }
};

async function saveTadaIntrospection(e, t, n, r) {
  var i = b(e);
  var a = h(i, {
    fileType: t,
    shouldPreprocess: !n
  });
  var o = t;
  if (await statFile(o, e => e.isDirectory())) {
    o = I.join(o, "introspection.d.ts");
  } else if (!await statFile(o, e => !!e)) {
    await T.mkdir(I.dirname(o), {
      recursive: !0
    });
    if (await statFile(o, e => e.isDirectory())) {
      o = I.join(o, "introspection.d.ts");
    }
  }
  try {
    await swapWrite(o, a);
    r(`Introspection saved to path @ ${o}`);
  } catch (e) {
    r(`Failed to write introspection @ ${e}`);
  }
}

function getDefinitionState(e) {
  var t;
  forEachState(e, e => {
    switch (e.kind) {
     case "Query":
     case "ShortQuery":
     case "Mutation":
     case "Subscription":
     case "FragmentDefinition":
      t = e;
    }
  });
  return t;
}

function getFieldDef(e, t, n) {
  if (n === N.name && e.getQueryType() === t) {
    return N;
  }
  if (n === D.name && e.getQueryType() === t) {
    return D;
  }
  if (n === A.name && _(t)) {
    return A;
  }
  if ("getFields" in t) {
    return t.getFields()[n];
  }
  return null;
}

function forEachState(e, t) {
  var n = [];
  var r = e;
  while (null == r ? void 0 : r.kind) {
    n.push(r);
    r = r.prevState;
  }
  for (var i = n.length - 1; i >= 0; i--) {
    t(n[i]);
  }
}

function objectValues(e) {
  var t = Object.keys(e);
  var n = t.length;
  var r = new Array(n);
  for (var i = 0; i < n; ++i) {
    r[i] = e[t[i]];
  }
  return r;
}

function hintList$1(e, t) {
  return function filterAndSortList$1(e, t) {
    if (!t) {
      return filterNonEmpty$1(e, e => !e.isDeprecated);
    }
    var n = e.map(e => ({
      proximity: getProximity$1(normalizeText$1(e.label), t),
      entry: e
    }));
    return filterNonEmpty$1(filterNonEmpty$1(n, e => e.proximity <= 2), e => !e.entry.isDeprecated).sort((e, t) => (e.entry.isDeprecated ? 1 : 0) - (t.entry.isDeprecated ? 1 : 0) || e.proximity - t.proximity || e.entry.label.length - t.entry.label.length).map(e => e.entry);
  }(t, normalizeText$1(e.string));
}

function filterNonEmpty$1(e, t) {
  var n = e.filter(t);
  return 0 === n.length ? e : n;
}

function normalizeText$1(e) {
  return e.toLowerCase().replaceAll(/\W/g, "");
}

function getProximity$1(e, t) {
  var n = function lexicalDistance$1(e, t) {
    var n;
    var r;
    var i = [];
    var a = e.length;
    var o = t.length;
    for (n = 0; n <= a; n++) {
      i[n] = [ n ];
    }
    for (r = 1; r <= o; r++) {
      i[0][r] = r;
    }
    for (n = 1; n <= a; n++) {
      for (r = 1; r <= o; r++) {
        var u = e[n - 1] === t[r - 1] ? 0 : 1;
        i[n][r] = Math.min(i[n - 1][r] + 1, i[n][r - 1] + 1, i[n - 1][r - 1] + u);
        if (n > 1 && r > 1 && e[n - 1] === t[r - 2] && e[n - 2] === t[r - 1]) {
          i[n][r] = Math.min(i[n][r], i[n - 2][r - 2] + u);
        }
      }
    }
    return i[a][o];
  }(t, e);
  if (e.length > t.length) {
    n -= e.length - t.length - 1;
    n += 0 === e.indexOf(t) ? 0 : .5;
  }
  return n;
}

var te;

!function(e) {
  e.is = function is(e) {
    return "string" == typeof e;
  };
}(te || (te = {}));

var ne;

!function(e) {
  e.is = function is(e) {
    return "string" == typeof e;
  };
}(ne || (ne = {}));

var re;

!function(e) {
  e.MIN_VALUE = -2147483648;
  e.MAX_VALUE = 2147483647;
  e.is = function is(t) {
    return "number" == typeof t && e.MIN_VALUE <= t && t <= e.MAX_VALUE;
  };
}(re || (re = {}));

var ie;

!function(e) {
  e.MIN_VALUE = 0;
  e.MAX_VALUE = 2147483647;
  e.is = function is(t) {
    return "number" == typeof t && e.MIN_VALUE <= t && t <= e.MAX_VALUE;
  };
}(ie || (ie = {}));

var ae;

!function(e) {
  e.create = function create(e, t) {
    if (e === Number.MAX_VALUE) {
      e = ie.MAX_VALUE;
    }
    if (t === Number.MAX_VALUE) {
      t = ie.MAX_VALUE;
    }
    return {
      line: e,
      character: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && At.uinteger(t.line) && At.uinteger(t.character);
  };
}(ae || (ae = {}));

var oe;

!function(e) {
  e.create = function create(e, t, n, r) {
    if (At.uinteger(e) && At.uinteger(t) && At.uinteger(n) && At.uinteger(r)) {
      return {
        start: ae.create(e, t),
        end: ae.create(n, r)
      };
    } else if (ae.is(e) && ae.is(t)) {
      return {
        start: e,
        end: t
      };
    } else {
      throw new Error(`Range#create called with invalid arguments[${e}, ${t}, ${n}, ${r}]`);
    }
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && ae.is(t.start) && ae.is(t.end);
  };
}(oe || (oe = {}));

var ue;

!function(e) {
  e.create = function create(e, t) {
    return {
      uri: e,
      range: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && oe.is(t.range) && (At.string(t.uri) || At.undefined(t.uri));
  };
}(ue || (ue = {}));

var se;

!function(e) {
  e.create = function create(e, t, n, r) {
    return {
      targetUri: e,
      targetRange: t,
      targetSelectionRange: n,
      originSelectionRange: r
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && oe.is(t.targetRange) && At.string(t.targetUri) && oe.is(t.targetSelectionRange) && (oe.is(t.originSelectionRange) || At.undefined(t.originSelectionRange));
  };
}(se || (se = {}));

var ce;

!function(e) {
  e.create = function create(e, t, n, r) {
    return {
      red: e,
      green: t,
      blue: n,
      alpha: r
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && At.numberRange(t.red, 0, 1) && At.numberRange(t.green, 0, 1) && At.numberRange(t.blue, 0, 1) && At.numberRange(t.alpha, 0, 1);
  };
}(ce || (ce = {}));

var le;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      color: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && oe.is(t.range) && ce.is(t.color);
  };
}(le || (le = {}));

var de;

!function(e) {
  e.create = function create(e, t, n) {
    return {
      label: e,
      textEdit: t,
      additionalTextEdits: n
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && At.string(t.label) && (At.undefined(t.textEdit) || ye.is(t)) && (At.undefined(t.additionalTextEdits) || At.typedArray(t.additionalTextEdits, ye.is));
  };
}(de || (de = {}));

var fe;

!function(e) {
  e.Comment = "comment";
  e.Imports = "imports";
  e.Region = "region";
}(fe || (fe = {}));

var ve;

!function(e) {
  e.create = function create(e, t, n, r, i, a) {
    var o = {
      startLine: e,
      endLine: t
    };
    if (At.defined(n)) {
      o.startCharacter = n;
    }
    if (At.defined(r)) {
      o.endCharacter = r;
    }
    if (At.defined(i)) {
      o.kind = i;
    }
    if (At.defined(a)) {
      o.collapsedText = a;
    }
    return o;
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && At.uinteger(t.startLine) && At.uinteger(t.startLine) && (At.undefined(t.startCharacter) || At.uinteger(t.startCharacter)) && (At.undefined(t.endCharacter) || At.uinteger(t.endCharacter)) && (At.undefined(t.kind) || At.string(t.kind));
  };
}(ve || (ve = {}));

var pe;

!function(e) {
  e.create = function create(e, t) {
    return {
      location: e,
      message: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && ue.is(t.location) && At.string(t.message);
  };
}(pe || (pe = {}));

var ge;

!function(e) {
  e.Error = 1;
  e.Warning = 2;
  e.Information = 3;
  e.Hint = 4;
}(ge || (ge = {}));

var me;

!function(e) {
  e.Unnecessary = 1;
  e.Deprecated = 2;
}(me || (me = {}));

var Ee;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && At.string(t.href);
  };
}(Ee || (Ee = {}));

var Te;

!function(e) {
  e.create = function create(e, t, n, r, i, a) {
    var o = {
      range: e,
      message: t
    };
    if (At.defined(n)) {
      o.severity = n;
    }
    if (At.defined(r)) {
      o.code = r;
    }
    if (At.defined(i)) {
      o.source = i;
    }
    if (At.defined(a)) {
      o.relatedInformation = a;
    }
    return o;
  };
  e.is = function is(e) {
    var t;
    var n = e;
    return At.defined(n) && oe.is(n.range) && At.string(n.message) && (At.number(n.severity) || At.undefined(n.severity)) && (At.integer(n.code) || At.string(n.code) || At.undefined(n.code)) && (At.undefined(n.codeDescription) || At.string(null === (t = n.codeDescription) || void 0 === t ? void 0 : t.href)) && (At.string(n.source) || At.undefined(n.source)) && (At.undefined(n.relatedInformation) || At.typedArray(n.relatedInformation, pe.is));
  };
}(Te || (Te = {}));

var Ie;

!function(e) {
  e.create = function create(e, t, ...n) {
    var r = {
      title: e,
      command: t
    };
    if (At.defined(n) && n.length > 0) {
      r.arguments = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.string(t.title) && At.string(t.command);
  };
}(Ie || (Ie = {}));

var ye;

!function(e) {
  e.replace = function replace(e, t) {
    return {
      range: e,
      newText: t
    };
  };
  e.insert = function insert(e, t) {
    return {
      range: {
        start: e,
        end: e
      },
      newText: t
    };
  };
  e.del = function del(e) {
    return {
      range: e,
      newText: ""
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && At.string(t.newText) && oe.is(t.range);
  };
}(ye || (ye = {}));

var Se;

!function(e) {
  e.create = function create(e, t, n) {
    var r = {
      label: e
    };
    if (void 0 !== t) {
      r.needsConfirmation = t;
    }
    if (void 0 !== n) {
      r.description = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && At.string(t.label) && (At.boolean(t.needsConfirmation) || void 0 === t.needsConfirmation) && (At.string(t.description) || void 0 === t.description);
  };
}(Se || (Se = {}));

var be;

!function(e) {
  e.is = function is(e) {
    return At.string(e);
  };
}(be || (be = {}));

var he;

!function(e) {
  e.replace = function replace(e, t, n) {
    return {
      range: e,
      newText: t,
      annotationId: n
    };
  };
  e.insert = function insert(e, t, n) {
    return {
      range: {
        start: e,
        end: e
      },
      newText: t,
      annotationId: n
    };
  };
  e.del = function del(e, t) {
    return {
      range: e,
      newText: "",
      annotationId: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ye.is(t) && (Se.is(t.annotationId) || be.is(t.annotationId));
  };
}(he || (he = {}));

var Ne;

!function(e) {
  e.create = function create(e, t) {
    return {
      textDocument: e,
      edits: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && Oe.is(t.textDocument) && Array.isArray(t.edits);
  };
}(Ne || (Ne = {}));

var De;

!function(e) {
  e.create = function create(e, t, n) {
    var r = {
      kind: "create",
      uri: e
    };
    if (void 0 !== t && (void 0 !== t.overwrite || void 0 !== t.ignoreIfExists)) {
      r.options = t;
    }
    if (void 0 !== n) {
      r.annotationId = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return t && "create" === t.kind && At.string(t.uri) && (void 0 === t.options || (void 0 === t.options.overwrite || At.boolean(t.options.overwrite)) && (void 0 === t.options.ignoreIfExists || At.boolean(t.options.ignoreIfExists))) && (void 0 === t.annotationId || be.is(t.annotationId));
  };
}(De || (De = {}));

var Ae;

!function(e) {
  e.create = function create(e, t, n, r) {
    var i = {
      kind: "rename",
      oldUri: e,
      newUri: t
    };
    if (void 0 !== n && (void 0 !== n.overwrite || void 0 !== n.ignoreIfExists)) {
      i.options = n;
    }
    if (void 0 !== r) {
      i.annotationId = r;
    }
    return i;
  };
  e.is = function is(e) {
    var t = e;
    return t && "rename" === t.kind && At.string(t.oldUri) && At.string(t.newUri) && (void 0 === t.options || (void 0 === t.options.overwrite || At.boolean(t.options.overwrite)) && (void 0 === t.options.ignoreIfExists || At.boolean(t.options.ignoreIfExists))) && (void 0 === t.annotationId || be.is(t.annotationId));
  };
}(Ae || (Ae = {}));

var _e;

!function(e) {
  e.create = function create(e, t, n) {
    var r = {
      kind: "delete",
      uri: e
    };
    if (void 0 !== t && (void 0 !== t.recursive || void 0 !== t.ignoreIfNotExists)) {
      r.options = t;
    }
    if (void 0 !== n) {
      r.annotationId = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return t && "delete" === t.kind && At.string(t.uri) && (void 0 === t.options || (void 0 === t.options.recursive || At.boolean(t.options.recursive)) && (void 0 === t.options.ignoreIfNotExists || At.boolean(t.options.ignoreIfNotExists))) && (void 0 === t.annotationId || be.is(t.annotationId));
  };
}(_e || (_e = {}));

var ke;

!function(e) {
  e.is = function is(e) {
    return e && (void 0 !== e.changes || void 0 !== e.documentChanges) && (void 0 === e.documentChanges || e.documentChanges.every(e => {
      if (At.string(e.kind)) {
        return De.is(e) || Ae.is(e) || _e.is(e);
      } else {
        return Ne.is(e);
      }
    }));
  };
}(ke || (ke = {}));

var Fe;

!function(e) {
  e.create = function create(e) {
    return {
      uri: e
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.string(t.uri);
  };
}(Fe || (Fe = {}));

var Le;

!function(e) {
  e.create = function create(e, t) {
    return {
      uri: e,
      version: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.string(t.uri) && At.integer(t.version);
  };
}(Le || (Le = {}));

var Oe;

!function(e) {
  e.create = function create(e, t) {
    return {
      uri: e,
      version: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.string(t.uri) && (null === t.version || At.integer(t.version));
  };
}(Oe || (Oe = {}));

var Ce;

!function(e) {
  e.create = function create(e, t, n, r) {
    return {
      uri: e,
      languageId: t,
      version: n,
      text: r
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.string(t.uri) && At.string(t.languageId) && At.integer(t.version) && At.string(t.text);
  };
}(Ce || (Ce = {}));

var Me;

!function(e) {
  e.PlainText = "plaintext";
  e.Markdown = "markdown";
  e.is = function is(t) {
    return t === e.PlainText || t === e.Markdown;
  };
}(Me || (Me = {}));

var xe;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(e) && Me.is(t.kind) && At.string(t.value);
  };
}(xe || (xe = {}));

var Pe;

!function(e) {
  e.Text = 1;
  e.Method = 2;
  e.Function = 3;
  e.Constructor = 4;
  e.Field = 5;
  e.Variable = 6;
  e.Class = 7;
  e.Interface = 8;
  e.Module = 9;
  e.Property = 10;
  e.Unit = 11;
  e.Value = 12;
  e.Enum = 13;
  e.Keyword = 14;
  e.Snippet = 15;
  e.Color = 16;
  e.File = 17;
  e.Reference = 18;
  e.Folder = 19;
  e.EnumMember = 20;
  e.Constant = 21;
  e.Struct = 22;
  e.Event = 23;
  e.Operator = 24;
  e.TypeParameter = 25;
}(Pe || (Pe = {}));

var Re;

!function(e) {
  e.PlainText = 1;
  e.Snippet = 2;
}(Re || (Re = {}));

var Ue;

!function(e) {
  e.Deprecated = 1;
}(Ue || (Ue = {}));

var we;

!function(e) {
  e.create = function create(e, t, n) {
    return {
      newText: e,
      insert: t,
      replace: n
    };
  };
  e.is = function is(e) {
    var t = e;
    return t && At.string(t.newText) && oe.is(t.insert) && oe.is(t.replace);
  };
}(we || (we = {}));

var je;

!function(e) {
  e.asIs = 1;
  e.adjustIndentation = 2;
}(je || (je = {}));

var Ve;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return t && (At.string(t.detail) || void 0 === t.detail) && (At.string(t.description) || void 0 === t.description);
  };
}(Ve || (Ve = {}));

var Ye;

!function(e) {
  e.create = function create(e) {
    return {
      label: e
    };
  };
}(Ye || (Ye = {}));

var $e;

!function(e) {
  e.create = function create(e, t) {
    return {
      items: e ? e : [],
      isIncomplete: !!t
    };
  };
}($e || ($e = {}));

var Be;

!function(e) {
  e.fromPlainText = function fromPlainText(e) {
    return e.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
  };
  e.is = function is(e) {
    var t = e;
    return At.string(t) || At.objectLiteral(t) && At.string(t.language) && At.string(t.value);
  };
}(Be || (Be = {}));

var Ge;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return !!t && At.objectLiteral(t) && (xe.is(t.contents) || Be.is(t.contents) || At.typedArray(t.contents, Be.is)) && (void 0 === e.range || oe.is(e.range));
  };
}(Ge || (Ge = {}));

var Qe;

!function(e) {
  e.create = function create(e, t) {
    return t ? {
      label: e,
      documentation: t
    } : {
      label: e
    };
  };
}(Qe || (Qe = {}));

var Xe;

!function(e) {
  e.create = function create(e, t, ...n) {
    var r = {
      label: e
    };
    if (At.defined(t)) {
      r.documentation = t;
    }
    if (At.defined(n)) {
      r.parameters = n;
    } else {
      r.parameters = [];
    }
    return r;
  };
}(Xe || (Xe = {}));

var Je;

!function(e) {
  e.Text = 1;
  e.Read = 2;
  e.Write = 3;
}(Je || (Je = {}));

var Ke;

!function(e) {
  e.create = function create(e, t) {
    var n = {
      range: e
    };
    if (At.number(t)) {
      n.kind = t;
    }
    return n;
  };
}(Ke || (Ke = {}));

var ze;

!function(e) {
  e.File = 1;
  e.Module = 2;
  e.Namespace = 3;
  e.Package = 4;
  e.Class = 5;
  e.Method = 6;
  e.Property = 7;
  e.Field = 8;
  e.Constructor = 9;
  e.Enum = 10;
  e.Interface = 11;
  e.Function = 12;
  e.Variable = 13;
  e.Constant = 14;
  e.String = 15;
  e.Number = 16;
  e.Boolean = 17;
  e.Array = 18;
  e.Object = 19;
  e.Key = 20;
  e.Null = 21;
  e.EnumMember = 22;
  e.Struct = 23;
  e.Event = 24;
  e.Operator = 25;
  e.TypeParameter = 26;
}(ze || (ze = {}));

var He;

!function(e) {
  e.Deprecated = 1;
}(He || (He = {}));

var We;

!function(e) {
  e.create = function create(e, t, n, r, i) {
    var a = {
      name: e,
      kind: t,
      location: {
        uri: r,
        range: n
      }
    };
    if (i) {
      a.containerName = i;
    }
    return a;
  };
}(We || (We = {}));

var qe;

!function(e) {
  e.create = function create(e, t, n, r) {
    return void 0 !== r ? {
      name: e,
      kind: t,
      location: {
        uri: n,
        range: r
      }
    } : {
      name: e,
      kind: t,
      location: {
        uri: n
      }
    };
  };
}(qe || (qe = {}));

var Ze;

!function(e) {
  e.create = function create(e, t, n, r, i, a) {
    var o = {
      name: e,
      detail: t,
      kind: n,
      range: r,
      selectionRange: i
    };
    if (void 0 !== a) {
      o.children = a;
    }
    return o;
  };
  e.is = function is(e) {
    var t = e;
    return t && At.string(t.name) && At.number(t.kind) && oe.is(t.range) && oe.is(t.selectionRange) && (void 0 === t.detail || At.string(t.detail)) && (void 0 === t.deprecated || At.boolean(t.deprecated)) && (void 0 === t.children || Array.isArray(t.children)) && (void 0 === t.tags || Array.isArray(t.tags));
  };
}(Ze || (Ze = {}));

var et;

!function(e) {
  e.Empty = "";
  e.QuickFix = "quickfix";
  e.Refactor = "refactor";
  e.RefactorExtract = "refactor.extract";
  e.RefactorInline = "refactor.inline";
  e.RefactorRewrite = "refactor.rewrite";
  e.Source = "source";
  e.SourceOrganizeImports = "source.organizeImports";
  e.SourceFixAll = "source.fixAll";
}(et || (et = {}));

var tt;

!function(e) {
  e.Invoked = 1;
  e.Automatic = 2;
}(tt || (tt = {}));

var nt;

!function(e) {
  e.create = function create(e, t, n) {
    var r = {
      diagnostics: e
    };
    if (null != t) {
      r.only = t;
    }
    if (null != n) {
      r.triggerKind = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.typedArray(t.diagnostics, Te.is) && (void 0 === t.only || At.typedArray(t.only, At.string)) && (void 0 === t.triggerKind || t.triggerKind === tt.Invoked || t.triggerKind === tt.Automatic);
  };
}(nt || (nt = {}));

var rt;

!function(e) {
  e.create = function create(e, t, n) {
    var r = {
      title: e
    };
    var i = !0;
    if ("string" == typeof t) {
      i = !1;
      r.kind = t;
    } else if (Ie.is(t)) {
      r.command = t;
    } else {
      r.edit = t;
    }
    if (i && void 0 !== n) {
      r.kind = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return t && At.string(t.title) && (void 0 === t.diagnostics || At.typedArray(t.diagnostics, Te.is)) && (void 0 === t.kind || At.string(t.kind)) && (void 0 !== t.edit || void 0 !== t.command) && (void 0 === t.command || Ie.is(t.command)) && (void 0 === t.isPreferred || At.boolean(t.isPreferred)) && (void 0 === t.edit || ke.is(t.edit));
  };
}(rt || (rt = {}));

var it;

!function(e) {
  e.create = function create(e, t) {
    var n = {
      range: e
    };
    if (At.defined(t)) {
      n.data = t;
    }
    return n;
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && oe.is(t.range) && (At.undefined(t.command) || Ie.is(t.command));
  };
}(it || (it = {}));

var at;

!function(e) {
  e.create = function create(e, t) {
    return {
      tabSize: e,
      insertSpaces: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.uinteger(t.tabSize) && At.boolean(t.insertSpaces);
  };
}(at || (at = {}));

var ot;

!function(e) {
  e.create = function create(e, t, n) {
    return {
      range: e,
      target: t,
      data: n
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && oe.is(t.range) && (At.undefined(t.target) || At.string(t.target));
  };
}(ot || (ot = {}));

var ut;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      parent: t
    };
  };
  e.is = function is(t) {
    var n = t;
    return At.objectLiteral(n) && oe.is(n.range) && (void 0 === n.parent || e.is(n.parent));
  };
}(ut || (ut = {}));

var st;

!function(e) {
  e.namespace = "namespace";
  e.type = "type";
  e.class = "class";
  e.enum = "enum";
  e.interface = "interface";
  e.struct = "struct";
  e.typeParameter = "typeParameter";
  e.parameter = "parameter";
  e.variable = "variable";
  e.property = "property";
  e.enumMember = "enumMember";
  e.event = "event";
  e.function = "function";
  e.method = "method";
  e.macro = "macro";
  e.keyword = "keyword";
  e.modifier = "modifier";
  e.comment = "comment";
  e.string = "string";
  e.number = "number";
  e.regexp = "regexp";
  e.operator = "operator";
  e.decorator = "decorator";
}(st || (st = {}));

var ct;

!function(e) {
  e.declaration = "declaration";
  e.definition = "definition";
  e.readonly = "readonly";
  e.static = "static";
  e.deprecated = "deprecated";
  e.abstract = "abstract";
  e.async = "async";
  e.modification = "modification";
  e.documentation = "documentation";
  e.defaultLibrary = "defaultLibrary";
}(ct || (ct = {}));

var lt;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && (void 0 === t.resultId || "string" == typeof t.resultId) && Array.isArray(t.data) && (0 === t.data.length || "number" == typeof t.data[0]);
  };
}(lt || (lt = {}));

var dt;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      text: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return null != t && oe.is(t.range) && At.string(t.text);
  };
}(dt || (dt = {}));

var ft;

!function(e) {
  e.create = function create(e, t, n) {
    return {
      range: e,
      variableName: t,
      caseSensitiveLookup: n
    };
  };
  e.is = function is(e) {
    var t = e;
    return null != t && oe.is(t.range) && At.boolean(t.caseSensitiveLookup) && (At.string(t.variableName) || void 0 === t.variableName);
  };
}(ft || (ft = {}));

var vt;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      expression: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return null != t && oe.is(t.range) && (At.string(t.expression) || void 0 === t.expression);
  };
}(vt || (vt = {}));

var pt;

!function(e) {
  e.create = function create(e, t) {
    return {
      frameId: e,
      stoppedLocation: t
    };
  };
  e.is = function is(e) {
    return At.defined(e) && oe.is(e.stoppedLocation);
  };
}(pt || (pt = {}));

var gt;

!function(e) {
  e.Type = 1;
  e.Parameter = 2;
  e.is = function is(e) {
    return 1 === e || 2 === e;
  };
}(gt || (gt = {}));

var mt;

!function(e) {
  e.create = function create(e) {
    return {
      value: e
    };
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && (void 0 === t.tooltip || At.string(t.tooltip) || xe.is(t.tooltip)) && (void 0 === t.location || ue.is(t.location)) && (void 0 === t.command || Ie.is(t.command));
  };
}(mt || (mt = {}));

var Et;

!function(e) {
  e.create = function create(e, t, n) {
    var r = {
      position: e,
      label: t
    };
    if (void 0 !== n) {
      r.kind = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && ae.is(t.position) && (At.string(t.label) || At.typedArray(t.label, mt.is)) && (void 0 === t.kind || gt.is(t.kind)) && void 0 === t.textEdits || At.typedArray(t.textEdits, ye.is) && (void 0 === t.tooltip || At.string(t.tooltip) || xe.is(t.tooltip)) && (void 0 === t.paddingLeft || At.boolean(t.paddingLeft)) && (void 0 === t.paddingRight || At.boolean(t.paddingRight));
  };
}(Et || (Et = {}));

var Tt;

!function(e) {
  e.createSnippet = function createSnippet(e) {
    return {
      kind: "snippet",
      value: e
    };
  };
}(Tt || (Tt = {}));

var It;

!function(e) {
  e.create = function create(e, t, n, r) {
    return {
      insertText: e,
      filterText: t,
      range: n,
      command: r
    };
  };
}(It || (It = {}));

var yt;

!function(e) {
  e.create = function create(e) {
    return {
      items: e
    };
  };
}(yt || (yt = {}));

var St;

!function(e) {
  e.Invoked = 0;
  e.Automatic = 1;
}(St || (St = {}));

var bt;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      text: t
    };
  };
}(bt || (bt = {}));

var ht;

!function(e) {
  e.create = function create(e, t) {
    return {
      triggerKind: e,
      selectedCompletionInfo: t
    };
  };
}(ht || (ht = {}));

var Nt;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return At.objectLiteral(t) && ne.is(t.uri) && At.string(t.name);
  };
}(Nt || (Nt = {}));

var Dt;

!function(e) {
  e.create = function create(e, t, n, r) {
    return new FullTextDocument(e, t, n, r);
  };
  e.is = function is(e) {
    var t = e;
    return At.defined(t) && At.string(t.uri) && (At.undefined(t.languageId) || At.string(t.languageId)) && At.uinteger(t.lineCount) && At.func(t.getText) && At.func(t.positionAt) && At.func(t.offsetAt) ? !0 : !1;
  };
  e.applyEdits = function applyEdits(e, t) {
    var n = e.getText();
    var r = mergeSort(t, (e, t) => {
      var n = e.range.start.line - t.range.start.line;
      if (0 === n) {
        return e.range.start.character - t.range.start.character;
      }
      return n;
    });
    var i = n.length;
    for (var a = r.length - 1; a >= 0; a--) {
      var o = r[a];
      var u = e.offsetAt(o.range.start);
      var s = e.offsetAt(o.range.end);
      if (s <= i) {
        n = n.substring(0, u) + o.newText + n.substring(s, n.length);
      } else {
        throw new Error("Overlapping edit");
      }
      i = u;
    }
    return n;
  };
  function mergeSort(e, t) {
    if (e.length <= 1) {
      return e;
    }
    var n = e.length / 2 | 0;
    var r = e.slice(0, n);
    var i = e.slice(n);
    mergeSort(r, t);
    mergeSort(i, t);
    var a = 0;
    var o = 0;
    var u = 0;
    while (a < r.length && o < i.length) {
      if (t(r[a], i[o]) <= 0) {
        e[u++] = r[a++];
      } else {
        e[u++] = i[o++];
      }
    }
    while (a < r.length) {
      e[u++] = r[a++];
    }
    while (o < i.length) {
      e[u++] = i[o++];
    }
    return e;
  }
}(Dt || (Dt = {}));

class FullTextDocument {
  constructor(e, t, n, r) {
    this._uri = e;
    this._languageId = t;
    this._version = n;
    this._content = r;
    this._lineOffsets = void 0;
  }
  get uri() {
    return this._uri;
  }
  get languageId() {
    return this._languageId;
  }
  get version() {
    return this._version;
  }
  getText(e) {
    if (e) {
      var t = this.offsetAt(e.start);
      var n = this.offsetAt(e.end);
      return this._content.substring(t, n);
    }
    return this._content;
  }
  update(e, t) {
    this._content = e.text;
    this._version = t;
    this._lineOffsets = void 0;
  }
  getLineOffsets() {
    if (void 0 === this._lineOffsets) {
      var e = [];
      var t = this._content;
      var n = !0;
      for (var r = 0; r < t.length; r++) {
        if (n) {
          e.push(r);
          n = !1;
        }
        var i = t.charAt(r);
        n = "\r" === i || "\n" === i;
        if ("\r" === i && r + 1 < t.length && "\n" === t.charAt(r + 1)) {
          r++;
        }
      }
      if (n && t.length > 0) {
        e.push(t.length);
      }
      this._lineOffsets = e;
    }
    return this._lineOffsets;
  }
  positionAt(e) {
    e = Math.max(Math.min(e, this._content.length), 0);
    var t = this.getLineOffsets();
    var n = 0, r = t.length;
    if (0 === r) {
      return ae.create(0, e);
    }
    while (n < r) {
      var i = Math.floor((n + r) / 2);
      if (t[i] > e) {
        r = i;
      } else {
        n = i + 1;
      }
    }
    var a = n - 1;
    return ae.create(a, e - t[a]);
  }
  offsetAt(e) {
    var t = this.getLineOffsets();
    if (e.line >= t.length) {
      return this._content.length;
    } else if (e.line < 0) {
      return 0;
    }
    var n = t[e.line];
    return Math.max(Math.min(n + e.character, e.line + 1 < t.length ? t[e.line + 1] : this._content.length), n);
  }
  get lineCount() {
    return this.getLineOffsets().length;
  }
}

var At;

!function(e) {
  var t = Object.prototype.toString;
  e.defined = function defined(e) {
    return void 0 !== e;
  };
  e.undefined = function undefined$1(e) {
    return void 0 === e;
  };
  e.boolean = function boolean(e) {
    return !0 === e || !1 === e;
  };
  e.string = function string(e) {
    return "[object String]" === t.call(e);
  };
  e.number = function number(e) {
    return "[object Number]" === t.call(e);
  };
  e.numberRange = function numberRange(e, n, r) {
    return "[object Number]" === t.call(e) && n <= e && e <= r;
  };
  e.integer = function integer(e) {
    return "[object Number]" === t.call(e) && -2147483648 <= e && e <= 2147483647;
  };
  e.uinteger = function uinteger(e) {
    return "[object Number]" === t.call(e) && 0 <= e && e <= 2147483647;
  };
  e.func = function func(e) {
    return "[object Function]" === t.call(e);
  };
  e.objectLiteral = function objectLiteral(e) {
    return null !== e && "object" == typeof e;
  };
  e.typedArray = function typedArray(e, t) {
    return Array.isArray(e) && e.every(t);
  };
}(At || (At = {}));

var _t;

!function(e) {
  e.Text = 1;
  e.Method = 2;
  e.Function = 3;
  e.Constructor = 4;
  e.Field = 5;
  e.Variable = 6;
  e.Class = 7;
  e.Interface = 8;
  e.Module = 9;
  e.Property = 10;
  e.Unit = 11;
  e.Value = 12;
  e.Enum = 13;
  e.Keyword = 14;
  e.Snippet = 15;
  e.Color = 16;
  e.File = 17;
  e.Reference = 18;
  e.Folder = 19;
  e.EnumMember = 20;
  e.Constant = 21;
  e.Struct = 22;
  e.Event = 23;
  e.Operator = 24;
  e.TypeParameter = 25;
}(_t || (_t = {}));

var kt = Object.assign(Object.assign({}, k), {
  ALIASED_FIELD: "AliasedField",
  ARGUMENTS: "Arguments",
  SHORT_QUERY: "ShortQuery",
  QUERY: "Query",
  MUTATION: "Mutation",
  SUBSCRIPTION: "Subscription",
  TYPE_CONDITION: "TypeCondition",
  INVALID: "Invalid",
  COMMENT: "Comment",
  SCHEMA_DEF: "SchemaDef",
  SCALAR_DEF: "ScalarDef",
  OBJECT_TYPE_DEF: "ObjectTypeDef",
  OBJECT_VALUE: "ObjectValue",
  LIST_VALUE: "ListValue",
  INTERFACE_DEF: "InterfaceDef",
  UNION_DEF: "UnionDef",
  ENUM_DEF: "EnumDef",
  ENUM_VALUE: "EnumValue",
  FIELD_DEF: "FieldDef",
  INPUT_DEF: "InputDef",
  INPUT_VALUE_DEF: "InputValueDef",
  ARGUMENTS_DEF: "ArgumentsDef",
  EXTEND_DEF: "ExtendDef",
  EXTENSION_DEFINITION: "ExtensionDefinition",
  DIRECTIVE_DEF: "DirectiveDef",
  IMPLEMENTS: "Implements",
  VARIABLE_DEFINITIONS: "VariableDefinitions",
  TYPE: "Type"
});

var Ft = {
  command: "editor.action.triggerSuggest",
  title: "Suggestions"
};

var Lt = [ k.SCHEMA_DEFINITION, k.OPERATION_TYPE_DEFINITION, k.SCALAR_TYPE_DEFINITION, k.OBJECT_TYPE_DEFINITION, k.INTERFACE_TYPE_DEFINITION, k.UNION_TYPE_DEFINITION, k.ENUM_TYPE_DEFINITION, k.INPUT_OBJECT_TYPE_DEFINITION, k.DIRECTIVE_DEFINITION, k.SCHEMA_EXTENSION, k.SCALAR_TYPE_EXTENSION, k.OBJECT_TYPE_EXTENSION, k.INTERFACE_TYPE_EXTENSION, k.UNION_TYPE_EXTENSION, k.ENUM_TYPE_EXTENSION, k.INPUT_OBJECT_TYPE_EXTENSION ];

function getAutocompleteSuggestions(e, t, n, r, i, a) {
  var o;
  var u = Object.assign(Object.assign({}, a), {
    schema: e
  });
  var s = r || getTokenAtPosition(t, n, 1);
  var c = "Invalid" === s.state.kind ? s.state.prevState : s.state;
  var l = (null == a ? void 0 : a.mode) || function getDocumentMode(e, t) {
    if (null == t ? void 0 : t.endsWith(".graphqls")) {
      return Ct.TYPE_SYSTEM;
    }
    return (e => {
      var t = !1;
      if (e) {
        try {
          G(Q(e), {
            enter(e) {
              if ("Document" === e.kind) {
                return;
              }
              if (Lt.includes(e.kind)) {
                t = !0;
                return X;
              }
              return !1;
            }
          });
        } catch (e) {
          return t;
        }
      }
      return t;
    })(e) ? Ct.TYPE_SYSTEM : Ct.EXECUTABLE;
  }(t, null == a ? void 0 : a.uri);
  if (!c) {
    return [];
  }
  var {kind: d, step: f, prevState: v} = c;
  var p = getTypeInfo(e, s.state);
  if (d === kt.DOCUMENT) {
    if (l === Ct.TYPE_SYSTEM) {
      return function getSuggestionsForTypeSystemDefinitions(e) {
        return hintList$1(e, [ {
          label: "extend",
          kind: _t.Function
        }, {
          label: "type",
          kind: _t.Function
        }, {
          label: "interface",
          kind: _t.Function
        }, {
          label: "union",
          kind: _t.Function
        }, {
          label: "input",
          kind: _t.Function
        }, {
          label: "scalar",
          kind: _t.Function
        }, {
          label: "schema",
          kind: _t.Function
        } ]);
      }(s);
    }
    return function getSuggestionsForExecutableDefinitions(e) {
      return hintList$1(e, [ {
        label: "query",
        kind: _t.Function
      }, {
        label: "mutation",
        kind: _t.Function
      }, {
        label: "subscription",
        kind: _t.Function
      }, {
        label: "fragment",
        kind: _t.Function
      }, {
        label: "{",
        kind: _t.Constructor
      } ]);
    }(s);
  }
  if (d === kt.EXTEND_DEF) {
    return function getSuggestionsForExtensionDefinitions(e) {
      return hintList$1(e, [ {
        label: "type",
        kind: _t.Function
      }, {
        label: "interface",
        kind: _t.Function
      }, {
        label: "union",
        kind: _t.Function
      }, {
        label: "input",
        kind: _t.Function
      }, {
        label: "scalar",
        kind: _t.Function
      }, {
        label: "schema",
        kind: _t.Function
      } ]);
    }(s);
  }
  if ((null === (o = null == v ? void 0 : v.prevState) || void 0 === o ? void 0 : o.kind) === kt.EXTENSION_DEFINITION && c.name) {
    return hintList$1(s, []);
  }
  if ((null == v ? void 0 : v.kind) === k.SCALAR_TYPE_EXTENSION) {
    return hintList$1(s, Object.values(e.getTypeMap()).filter(F).map(e => ({
      label: e.name,
      kind: _t.Function
    })));
  }
  if ((null == v ? void 0 : v.kind) === k.OBJECT_TYPE_EXTENSION) {
    return hintList$1(s, Object.values(e.getTypeMap()).filter(e => L(e) && !e.name.startsWith("__")).map(e => ({
      label: e.name,
      kind: _t.Function
    })));
  }
  if ((null == v ? void 0 : v.kind) === k.INTERFACE_TYPE_EXTENSION) {
    return hintList$1(s, Object.values(e.getTypeMap()).filter(O).map(e => ({
      label: e.name,
      kind: _t.Function
    })));
  }
  if ((null == v ? void 0 : v.kind) === k.UNION_TYPE_EXTENSION) {
    return hintList$1(s, Object.values(e.getTypeMap()).filter(C).map(e => ({
      label: e.name,
      kind: _t.Function
    })));
  }
  if ((null == v ? void 0 : v.kind) === k.ENUM_TYPE_EXTENSION) {
    return hintList$1(s, Object.values(e.getTypeMap()).filter(e => M(e) && !e.name.startsWith("__")).map(e => ({
      label: e.name,
      kind: _t.Function
    })));
  }
  if ((null == v ? void 0 : v.kind) === k.INPUT_OBJECT_TYPE_EXTENSION) {
    return hintList$1(s, Object.values(e.getTypeMap()).filter(x).map(e => ({
      label: e.name,
      kind: _t.Function
    })));
  }
  if (d === kt.IMPLEMENTS || d === kt.NAMED_TYPE && (null == v ? void 0 : v.kind) === kt.IMPLEMENTS) {
    return function getSuggestionsForImplements(e, t, n, r, i) {
      if (t.needsSeparator) {
        return [];
      }
      var a = n.getTypeMap();
      var o = objectValues(a).filter(O);
      var u = o.map(({name: e}) => e);
      var s = new Set;
      runOnlineParser$1(r, (e, t) => {
        var r, a, o, c, l;
        if (t.name) {
          if (t.kind === kt.INTERFACE_DEF && !u.includes(t.name)) {
            s.add(t.name);
          }
          if (t.kind === kt.NAMED_TYPE && (null === (r = t.prevState) || void 0 === r ? void 0 : r.kind) === kt.IMPLEMENTS) {
            if (i.interfaceDef) {
              if (null === (a = i.interfaceDef) || void 0 === a ? void 0 : a.getInterfaces().find(({name: e}) => e === t.name)) {
                return;
              }
              var d = n.getType(t.name);
              var f = null === (o = i.interfaceDef) || void 0 === o ? void 0 : o.toConfig();
              i.interfaceDef = new z(Object.assign(Object.assign({}, f), {
                interfaces: [ ...f.interfaces, d || new z({
                  name: t.name,
                  fields: {}
                }) ]
              }));
            } else if (i.objectTypeDef) {
              if (null === (c = i.objectTypeDef) || void 0 === c ? void 0 : c.getInterfaces().find(({name: e}) => e === t.name)) {
                return;
              }
              var v = n.getType(t.name);
              var p = null === (l = i.objectTypeDef) || void 0 === l ? void 0 : l.toConfig();
              i.objectTypeDef = new H(Object.assign(Object.assign({}, p), {
                interfaces: [ ...p.interfaces, v || new z({
                  name: t.name,
                  fields: {}
                }) ]
              }));
            }
          }
        }
      });
      var c = i.interfaceDef || i.objectTypeDef;
      var l = ((null == c ? void 0 : c.getInterfaces()) || []).map(({name: e}) => e);
      var d = o.concat([ ...s ].map(e => ({
        name: e
      }))).filter(({name: e}) => e !== (null == c ? void 0 : c.name) && !l.includes(e));
      return hintList$1(e, d.map(e => {
        var t = {
          label: e.name,
          kind: _t.Interface,
          type: e
        };
        if (null == e ? void 0 : e.description) {
          t.documentation = e.description;
        }
        return t;
      }));
    }(s, c, e, t, p);
  }
  if (d === kt.SELECTION_SET || d === kt.FIELD || d === kt.ALIASED_FIELD) {
    return function getSuggestionsForFieldNames(e, t, n) {
      var r;
      if (t.parentType) {
        var {parentType: i} = t;
        var a = [];
        if ("getFields" in i) {
          a = objectValues(i.getFields());
        }
        if (_(i)) {
          a.push(A);
        }
        if (i === (null === (r = null == n ? void 0 : n.schema) || void 0 === r ? void 0 : r.getQueryType())) {
          a.push(N, D);
        }
        return hintList$1(e, a.map((e, t) => {
          var r;
          var i = {
            sortText: String(t) + e.name,
            label: e.name,
            detail: String(e.type),
            documentation: null !== (r = e.description) && void 0 !== r ? r : void 0,
            deprecated: Boolean(e.deprecationReason),
            isDeprecated: Boolean(e.deprecationReason),
            deprecationReason: e.deprecationReason,
            kind: _t.Field,
            type: e.type
          };
          if (null == n ? void 0 : n.fillLeafsOnComplete) {
            var a = getInsertText(e);
            if (a) {
              i.insertText = e.name + a;
              i.insertTextFormat = Re.Snippet;
              i.command = Ft;
            }
          }
          return i;
        }));
      }
      return [];
    }(s, p, u);
  }
  if (d === kt.ARGUMENTS || d === kt.ARGUMENT && 0 === f) {
    var {argDefs: g} = p;
    if (g) {
      return hintList$1(s, g.map(e => {
        var t;
        return {
          label: e.name,
          insertText: e.name + ": ",
          command: Ft,
          detail: String(e.type),
          documentation: null !== (t = e.description) && void 0 !== t ? t : void 0,
          kind: _t.Variable,
          type: e.type
        };
      }));
    }
  }
  if ((d === kt.OBJECT_VALUE || d === kt.OBJECT_FIELD && 0 === f) && p.objectFieldDefs) {
    var m = objectValues(p.objectFieldDefs);
    var E = d === kt.OBJECT_VALUE ? _t.Value : _t.Field;
    return hintList$1(s, m.map(e => {
      var t;
      return {
        label: e.name,
        detail: String(e.type),
        documentation: null !== (t = e.description) && void 0 !== t ? t : void 0,
        kind: E,
        type: e.type
      };
    }));
  }
  if (d === kt.ENUM_VALUE || d === kt.LIST_VALUE && 1 === f || d === kt.OBJECT_FIELD && 2 === f || d === kt.ARGUMENT && 2 === f) {
    return function getSuggestionsForInputValues(e, t, n, r) {
      var i = P(t.inputType);
      var a = getVariableCompletions(n, r, e).filter(e => e.detail === i.name);
      if (i instanceof w) {
        return hintList$1(e, i.getValues().map(e => {
          var t;
          return {
            label: e.name,
            detail: String(i),
            documentation: null !== (t = e.description) && void 0 !== t ? t : void 0,
            deprecated: Boolean(e.deprecationReason),
            isDeprecated: Boolean(e.deprecationReason),
            deprecationReason: e.deprecationReason,
            kind: _t.EnumMember,
            type: i
          };
        }).concat(a));
      }
      if (i === j) {
        return hintList$1(e, a.concat([ {
          label: "true",
          detail: String(j),
          documentation: "Not false.",
          kind: _t.Variable,
          type: j
        }, {
          label: "false",
          detail: String(j),
          documentation: "Not true.",
          kind: _t.Variable,
          type: j
        } ]));
      }
      return a;
    }(s, p, t, e);
  }
  if (d === kt.VARIABLE && 1 === f) {
    var T = P(p.inputType);
    return hintList$1(s, getVariableCompletions(t, e, s).filter(e => e.detail === (null == T ? void 0 : T.name)));
  }
  if (d === kt.TYPE_CONDITION && 1 === f || d === kt.NAMED_TYPE && null != v && v.kind === kt.TYPE_CONDITION) {
    return function getSuggestionsForFragmentTypeConditions(e, t, n, r) {
      var i;
      if (t.parentType) {
        if (V(t.parentType)) {
          var a = Y(t.parentType);
          var o = n.getPossibleTypes(a);
          var u = Object.create(null);
          for (var s of o) {
            for (var c of s.getInterfaces()) {
              u[c.name] = c;
            }
          }
          i = o.concat(objectValues(u));
        } else {
          i = [ t.parentType ];
        }
      } else {
        i = objectValues(n.getTypeMap()).filter(e => _(e) && !e.name.startsWith("__"));
      }
      return hintList$1(e, i.map(e => {
        var t = P(e);
        return {
          label: String(e),
          documentation: (null == t ? void 0 : t.description) || "",
          kind: _t.Field
        };
      }));
    }(s, p, e);
  }
  if (d === kt.FRAGMENT_SPREAD && 1 === f) {
    return function getSuggestionsForFragmentSpread$1(e, t, n, r, i) {
      if (!r) {
        return [];
      }
      var a = n.getTypeMap();
      var o = getDefinitionState(e.state);
      var u = function getFragmentDefinitions(e) {
        var t = [];
        runOnlineParser$1(e, (e, n) => {
          if (n.kind === kt.FRAGMENT_DEFINITION && n.name && n.type) {
            t.push({
              kind: kt.FRAGMENT_DEFINITION,
              name: {
                kind: k.NAME,
                value: n.name
              },
              selectionSet: {
                kind: kt.SELECTION_SET,
                selections: []
              },
              typeCondition: {
                kind: kt.NAMED_TYPE,
                name: {
                  kind: k.NAME,
                  value: n.type
                }
              }
            });
          }
        });
        return t;
      }(r);
      if (i && i.length > 0) {
        u.push(...i);
      }
      var s = u.filter(e => a[e.typeCondition.name.value] && !(o && o.kind === kt.FRAGMENT_DEFINITION && o.name === e.name.value) && _(t.parentType) && _(a[e.typeCondition.name.value]) && $(n, t.parentType, a[e.typeCondition.name.value]));
      return hintList$1(e, s.map(e => ({
        label: e.name.value,
        detail: String(a[e.typeCondition.name.value]),
        documentation: `fragment ${e.name.value} on ${e.typeCondition.name.value}`,
        kind: _t.Field,
        type: a[e.typeCondition.name.value]
      })));
    }(s, p, e, t, Array.isArray(i) ? i : (e => {
      var t = [];
      if (e) {
        try {
          G(Q(e), {
            FragmentDefinition(e) {
              t.push(e);
            }
          });
        } catch (e) {
          return [];
        }
      }
      return t;
    })(i));
  }
  var I = unwrapType(c);
  if (l === Ct.TYPE_SYSTEM && !I.needsAdvance && d === kt.NAMED_TYPE || d === kt.LIST_TYPE) {
    if (I.kind === kt.FIELD_DEF) {
      return hintList$1(s, Object.values(e.getTypeMap()).filter(e => R(e) && !e.name.startsWith("__")).map(e => ({
        label: e.name,
        kind: _t.Function
      })));
    }
    if (I.kind === kt.INPUT_VALUE_DEF) {
      return hintList$1(s, Object.values(e.getTypeMap()).filter(e => U(e) && !e.name.startsWith("__")).map(e => ({
        label: e.name,
        kind: _t.Function
      })));
    }
  }
  if (d === kt.VARIABLE_DEFINITION && 2 === f || d === kt.LIST_TYPE && 1 === f || d === kt.NAMED_TYPE && v && (v.kind === kt.VARIABLE_DEFINITION || v.kind === kt.LIST_TYPE || v.kind === kt.NON_NULL_TYPE)) {
    return function getSuggestionsForVariableDefinition(e, t, n) {
      var r = t.getTypeMap();
      var i = objectValues(r).filter(U);
      return hintList$1(e, i.map(e => ({
        label: e.name,
        documentation: e.description,
        kind: _t.Variable
      })));
    }(s, e);
  }
  if (d === kt.DIRECTIVE) {
    return function getSuggestionsForDirective(e, t, n, r) {
      var i;
      if (null === (i = t.prevState) || void 0 === i ? void 0 : i.kind) {
        var a = n.getDirectives().filter(e => function canUseDirective(e, t) {
          if (!(null == e ? void 0 : e.kind)) {
            return !1;
          }
          var {kind: n, prevState: r} = e;
          var {locations: i} = t;
          switch (n) {
           case kt.QUERY:
            return i.includes(B.QUERY);

           case kt.MUTATION:
            return i.includes(B.MUTATION);

           case kt.SUBSCRIPTION:
            return i.includes(B.SUBSCRIPTION);

           case kt.FIELD:
           case kt.ALIASED_FIELD:
            return i.includes(B.FIELD);

           case kt.FRAGMENT_DEFINITION:
            return i.includes(B.FRAGMENT_DEFINITION);

           case kt.FRAGMENT_SPREAD:
            return i.includes(B.FRAGMENT_SPREAD);

           case kt.INLINE_FRAGMENT:
            return i.includes(B.INLINE_FRAGMENT);

           case kt.SCHEMA_DEF:
            return i.includes(B.SCHEMA);

           case kt.SCALAR_DEF:
            return i.includes(B.SCALAR);

           case kt.OBJECT_TYPE_DEF:
            return i.includes(B.OBJECT);

           case kt.FIELD_DEF:
            return i.includes(B.FIELD_DEFINITION);

           case kt.INTERFACE_DEF:
            return i.includes(B.INTERFACE);

           case kt.UNION_DEF:
            return i.includes(B.UNION);

           case kt.ENUM_DEF:
            return i.includes(B.ENUM);

           case kt.ENUM_VALUE:
            return i.includes(B.ENUM_VALUE);

           case kt.INPUT_DEF:
            return i.includes(B.INPUT_OBJECT);

           case kt.INPUT_VALUE_DEF:
            switch (null == r ? void 0 : r.kind) {
             case kt.ARGUMENTS_DEF:
              return i.includes(B.ARGUMENT_DEFINITION);

             case kt.INPUT_DEF:
              return i.includes(B.INPUT_FIELD_DEFINITION);
            }
          }
          return !1;
        }(t.prevState, e));
        return hintList$1(e, a.map(e => ({
          label: e.name,
          documentation: e.description || "",
          kind: _t.Function
        })));
      }
      return [];
    }(s, c, e);
  }
  return [];
}

var Ot = " {\n  $1\n}";

var getInsertText = e => {
  var {type: t} = e;
  if (_(t)) {
    return Ot;
  }
  if (J(t) && _(t.ofType)) {
    return Ot;
  }
  if (K(t)) {
    if (_(t.ofType)) {
      return Ot;
    }
    if (J(t.ofType) && _(t.ofType.ofType)) {
      return Ot;
    }
  }
  return null;
};

var getParentDefinition$1 = (e, t) => {
  var n, r, i, a, o, u, s, c, l, d;
  if ((null === (n = e.prevState) || void 0 === n ? void 0 : n.kind) === t) {
    return e.prevState;
  }
  if ((null === (i = null === (r = e.prevState) || void 0 === r ? void 0 : r.prevState) || void 0 === i ? void 0 : i.kind) === t) {
    return e.prevState.prevState;
  }
  if ((null === (u = null === (o = null === (a = e.prevState) || void 0 === a ? void 0 : a.prevState) || void 0 === o ? void 0 : o.prevState) || void 0 === u ? void 0 : u.kind) === t) {
    return e.prevState.prevState.prevState;
  }
  if ((null === (d = null === (l = null === (c = null === (s = e.prevState) || void 0 === s ? void 0 : s.prevState) || void 0 === c ? void 0 : c.prevState) || void 0 === l ? void 0 : l.prevState) || void 0 === d ? void 0 : d.kind) === t) {
    return e.prevState.prevState.prevState.prevState;
  }
};

function getVariableCompletions(e, t, n) {
  var r = null;
  var i;
  var a = Object.create({});
  runOnlineParser$1(e, (e, o) => {
    if ((null == o ? void 0 : o.kind) === kt.VARIABLE && o.name) {
      r = o.name;
    }
    if ((null == o ? void 0 : o.kind) === kt.NAMED_TYPE && r) {
      var u = getParentDefinition$1(o, kt.TYPE);
      if (null == u ? void 0 : u.type) {
        i = t.getType(null == u ? void 0 : u.type);
      }
    }
    if (r && i && !a[r]) {
      a[r] = {
        detail: i.toString(),
        insertText: "$" === n.string ? r : "$" + r,
        label: r,
        type: i,
        kind: _t.Variable
      };
      r = null;
      i = null;
    }
  });
  return objectValues(a);
}

function getTokenAtPosition(e, t, n = 0) {
  var r = null;
  var i = null;
  var a = null;
  var o = runOnlineParser$1(e, (e, o, u, s) => {
    if (s !== t.line || e.getCurrentPosition() + n < t.character + 1) {
      return;
    }
    r = u;
    i = Object.assign({}, o);
    a = e.current();
    return "BREAK";
  });
  return {
    start: o.start,
    end: o.end,
    string: a || o.string,
    state: i || o.state,
    style: r || o.style
  };
}

function runOnlineParser$1(n, r) {
  var i = n.split("\n");
  var a = t();
  var o = a.startState();
  var u = "";
  var s = new e("");
  for (var c = 0; c < i.length; c++) {
    s = new e(i[c]);
    while (!s.eol()) {
      if ("BREAK" === r(s, o, u = a.token(s, o), c)) {
        break;
      }
    }
    r(s, o, u, c);
    if (!o.kind) {
      o = a.startState();
    }
  }
  return {
    start: s.getStartOfToken(),
    end: s.getCurrentPosition(),
    string: s.current(),
    state: o,
    style: u
  };
}

function getTypeInfo(e, t) {
  var n;
  var r;
  var i;
  var a;
  var o;
  var u;
  var s;
  var c;
  var l;
  var d;
  var f;
  forEachState(t, t => {
    var v;
    switch (t.kind) {
     case kt.QUERY:
     case "ShortQuery":
      d = e.getQueryType();
      break;

     case kt.MUTATION:
      d = e.getMutationType();
      break;

     case kt.SUBSCRIPTION:
      d = e.getSubscriptionType();
      break;

     case kt.INLINE_FRAGMENT:
     case kt.FRAGMENT_DEFINITION:
      if (t.type) {
        d = e.getType(t.type);
      }
      break;

     case kt.FIELD:
     case kt.ALIASED_FIELD:
      if (!d || !t.name) {
        o = null;
      } else {
        o = l ? getFieldDef(e, l, t.name) : null;
        d = o ? o.type : null;
      }
      break;

     case kt.SELECTION_SET:
      l = P(d);
      break;

     case kt.DIRECTIVE:
      i = t.name ? e.getDirective(t.name) : null;
      break;

     case kt.INTERFACE_DEF:
      if (t.name) {
        s = null;
        f = new z({
          name: t.name,
          interfaces: [],
          fields: {}
        });
      }
      break;

     case kt.OBJECT_TYPE_DEF:
      if (t.name) {
        f = null;
        s = new H({
          name: t.name,
          interfaces: [],
          fields: {}
        });
      }
      break;

     case kt.ARGUMENTS:
      if (t.prevState) {
        switch (t.prevState.kind) {
         case kt.FIELD:
          r = o && o.args;
          break;

         case kt.DIRECTIVE:
          r = i && i.args;
          break;

         case kt.ALIASED_FIELD:
          var p = null === (v = t.prevState) || void 0 === v ? void 0 : v.name;
          if (!p) {
            r = null;
            break;
          }
          var g = l ? getFieldDef(e, l, p) : null;
          if (!g) {
            r = null;
            break;
          }
          r = g.args;
          break;

         default:
          r = null;
        }
      } else {
        r = null;
      }
      break;

     case kt.ARGUMENT:
      if (r) {
        for (var m = 0; m < r.length; m++) {
          if (r[m].name === t.name) {
            n = r[m];
            break;
          }
        }
      }
      u = null == n ? void 0 : n.type;
      break;

     case kt.ENUM_VALUE:
      var E = P(u);
      a = E instanceof w ? E.getValues().find(e => e.value === t.name) : null;
      break;

     case kt.LIST_VALUE:
      var T = q(u);
      u = T instanceof Z ? T.ofType : null;
      break;

     case kt.OBJECT_VALUE:
      var I = P(u);
      c = I instanceof W ? I.getFields() : null;
      break;

     case kt.OBJECT_FIELD:
      var y = t.name && c ? c[t.name] : null;
      u = null == y ? void 0 : y.type;
      break;

     case kt.NAMED_TYPE:
      if (t.name) {
        d = e.getType(t.name);
      }
    }
  });
  return {
    argDef: n,
    argDefs: r,
    directiveDef: i,
    enumValue: a,
    fieldDef: o,
    inputType: u,
    objectFieldDefs: c,
    parentType: l,
    type: d,
    interfaceDef: f,
    objectTypeDef: s
  };
}

var Ct;

!function(e) {
  e.TYPE_SYSTEM = "TYPE_SYSTEM";
  e.EXECUTABLE = "EXECUTABLE";
}(Ct || (Ct = {}));

function unwrapType(e) {
  if (e.prevState && e.kind && [ kt.NAMED_TYPE, kt.LIST_TYPE, kt.TYPE, kt.NON_NULL_TYPE ].includes(e.kind)) {
    return unwrapType(e.prevState);
  }
  return e;
}

function getHoverInformation(e, t, n, r, i) {
  var a = r || getTokenAtPosition(t, n);
  if (!e || !a || !a.state) {
    return "";
  }
  var {kind: o, step: u} = a.state;
  var s = getTypeInfo(e, a.state);
  var c = Object.assign(Object.assign({}, i), {
    schema: e
  });
  if ("Field" === o && 0 === u && s.fieldDef || "AliasedField" === o && 2 === u && s.fieldDef) {
    var l = [];
    renderMdCodeStart(l, c);
    !function renderField(e, t, n) {
      renderQualifiedField(e, t, n);
      renderTypeAnnotation(e, t, n, t.type);
    }(l, s, c);
    renderMdCodeEnd(l, c);
    renderDescription(l, c, s.fieldDef);
    return l.join("").trim();
  }
  if ("Directive" === o && 1 === u && s.directiveDef) {
    var d = [];
    renderMdCodeStart(d, c);
    renderDirective(d, s);
    renderMdCodeEnd(d, c);
    renderDescription(d, c, s.directiveDef);
    return d.join("").trim();
  }
  if ("Argument" === o && 0 === u && s.argDef) {
    var f = [];
    renderMdCodeStart(f, c);
    !function renderArg(e, t, n) {
      if (t.directiveDef) {
        renderDirective(e, t);
      } else if (t.fieldDef) {
        renderQualifiedField(e, t, n);
      }
      if (!t.argDef) {
        return;
      }
      var {name: r} = t.argDef;
      text(e, "(");
      text(e, r);
      renderTypeAnnotation(e, t, n, t.inputType);
      text(e, ")");
    }(f, s, c);
    renderMdCodeEnd(f, c);
    renderDescription(f, c, s.argDef);
    return f.join("").trim();
  }
  if ("EnumValue" === o && s.enumValue && "description" in s.enumValue) {
    var v = [];
    renderMdCodeStart(v, c);
    !function renderEnumValue(e, t, n) {
      if (!t.enumValue) {
        return;
      }
      var {name: r} = t.enumValue;
      renderType(e, t, n, t.inputType);
      text(e, ".");
      text(e, r);
    }(v, s, c);
    renderMdCodeEnd(v, c);
    renderDescription(v, c, s.enumValue);
    return v.join("").trim();
  }
  if ("NamedType" === o && s.type && "description" in s.type) {
    var p = [];
    renderMdCodeStart(p, c);
    renderType(p, s, c, s.type);
    renderMdCodeEnd(p, c);
    renderDescription(p, c, s.type);
    return p.join("").trim();
  }
  return "";
}

function renderMdCodeStart(e, t) {
  if (t.useMarkdown) {
    text(e, "```graphql\n");
  }
}

function renderMdCodeEnd(e, t) {
  if (t.useMarkdown) {
    text(e, "\n```");
  }
}

function renderQualifiedField(e, t, n) {
  if (!t.fieldDef) {
    return;
  }
  var r = t.fieldDef.name;
  if ("__" !== r.slice(0, 2)) {
    renderType(e, t, n, t.parentType);
    text(e, ".");
  }
  text(e, r);
}

function renderDirective(e, t, n) {
  if (!t.directiveDef) {
    return;
  }
  text(e, "@" + t.directiveDef.name);
}

function renderTypeAnnotation(e, t, n, r) {
  text(e, ": ");
  renderType(e, t, n, r);
}

function renderType(e, t, n, r) {
  if (!r) {
    return;
  }
  if (r instanceof ee) {
    renderType(e, t, n, r.ofType);
    text(e, "!");
  } else if (r instanceof Z) {
    text(e, "[");
    renderType(e, t, n, r.ofType);
    text(e, "]");
  } else {
    text(e, r.name);
  }
}

function renderDescription(e, t, n) {
  if (!n) {
    return;
  }
  var r = "string" == typeof n.description ? n.description : null;
  if (r) {
    text(e, "\n\n");
    text(e, r);
  }
  !function renderDeprecation(e, t, n) {
    if (!n) {
      return;
    }
    var r = n.deprecationReason || null;
    if (!r) {
      return;
    }
    text(e, "\n\n");
    text(e, "Deprecated: ");
    text(e, r);
  }(e, 0, n);
}

function text(e, t) {
  e.push(t);
}

class Cursor {
  constructor(e, t) {
    this.line = e;
    this.character = t;
  }
  setLine(e) {
    this.line = e;
  }
  setCharacter(e) {
    this.character = e;
  }
  lessThanOrEqualTo(e) {
    return this.line < e.line || this.line === e.line && this.character <= e.character;
  }
}

var getToken = (r, i) => {
  if (!n.isTemplateLiteral(r) && !n.isStringLiteralLike(r)) {
    return;
  }
  var a = r.getText().slice(1, -1).split("\n");
  var o = t();
  var u = o.startState();
  var s = r.getStart() + 1;
  var c = void 0;
  var l = void 0;
  for (var d = 0; d < a.length; d++) {
    if (c) {
      continue;
    }
    var f = s - 1;
    var v = new e(a[d] + "\n");
    while (!v.eol()) {
      var p = o.token(v, u);
      var g = v.current();
      if (f + v.getStartOfToken() + 1 <= i && f + v.getCurrentPosition() >= i) {
        c = l ? l : {
          line: d,
          start: v.getStartOfToken() + 1,
          end: v.getCurrentPosition(),
          string: g,
          state: u,
          tokenKind: p
        };
        break;
      } else if ("on" === g) {
        l = {
          line: d,
          start: v.getStartOfToken() + 1,
          end: v.getCurrentPosition(),
          string: g,
          state: u,
          tokenKind: p
        };
      } else if ("." === g || ".." === g) {
        l = {
          line: d,
          start: v.getStartOfToken() + 1,
          end: v.getCurrentPosition(),
          string: g,
          state: u,
          tokenKind: p
        };
      } else {
        l = void 0;
      }
    }
    s += a[d].length + 1;
  }
  return c;
};

function hintList(e, t) {
  return function filterAndSortList(e, t) {
    if (!t) {
      return filterNonEmpty(e, e => !e.isDeprecated);
    }
    var n = e.map(e => ({
      proximity: getProximity(normalizeText(e.label), t),
      entry: e
    }));
    return filterNonEmpty(filterNonEmpty(n, e => e.proximity <= 2), e => !e.entry.isDeprecated).sort((e, t) => (e.entry.isDeprecated ? 1 : 0) - (t.entry.isDeprecated ? 1 : 0) || e.proximity - t.proximity || e.entry.label.length - t.entry.label.length).map(e => e.entry);
  }(t, normalizeText(e.string));
}

function filterNonEmpty(e, t) {
  var n = e.filter(t);
  return 0 === n.length ? e : n;
}

function normalizeText(e) {
  return e.toLowerCase().replace(/\W/g, "");
}

function getProximity(e, t) {
  var n = function lexicalDistance(e, t) {
    var n;
    var r;
    var i = [];
    var a = e.length;
    var o = t.length;
    for (n = 0; n <= a; n++) {
      i[n] = [ n ];
    }
    for (r = 1; r <= o; r++) {
      i[0][r] = r;
    }
    for (n = 1; n <= a; n++) {
      for (r = 1; r <= o; r++) {
        var u = e[n - 1] === t[r - 1] ? 0 : 1;
        i[n][r] = Math.min(i[n - 1][r] + 1, i[n][r - 1] + 1, i[n - 1][r - 1] + u);
        if (n > 1 && r > 1 && e[n - 1] === t[r - 2] && e[n - 2] === t[r - 1]) {
          i[n][r] = Math.min(i[n][r], i[n - 2][r - 2] + u);
        }
      }
    }
    return i[a][o];
  }(t, e);
  if (e.length > t.length) {
    n -= e.length - t.length - 1;
    n += 0 === e.indexOf(t) ? 0 : .5;
  }
  return n;
}

function getGraphQLCompletions(e, t, v, p) {
  var g = p.config.templateIsCallExpression ?? !0;
  var m = p.languageService.getProgram()?.getTypeChecker();
  var E = r(p, e);
  if (!E) {
    return;
  }
  var T = i(E, t);
  if (!T) {
    return;
  }
  T = g ? a(T) : o(T);
  var I, y, S;
  if (g && u(T, m)) {
    var b = s(T, m);
    S = b && v.multi[b] ? v.multi[b]?.schema : v.current?.schema;
    var h = getToken(T.arguments[0], t);
    if (!S || !h || "." === h.string || ".." === h.string) {
      return;
    }
    I = `${T.arguments[0].getText().slice(1, -1)}\n${c(T, p).map(e => l(e)).join("\n")}`;
    y = new Cursor(h.line, h.start - 1);
  } else if (!g && d(T)) {
    var N = getToken(T.template, t);
    if (!N || !v.current || "." === N.string || ".." === N.string) {
      return;
    }
    var {combinedText: D, resolvedSpans: A} = f(T, e, p);
    var F = A.filter(e => e.original.start < t && e.original.start + e.original.length < t).reduce((e, t) => e + (t.lines - 1), 0);
    N.line = N.line + F;
    I = D;
    y = new Cursor(N.line, N.start - 1);
    S = v.current.schema;
  } else {
    return;
  }
  var [L, O] = function getSuggestionsInternal(e, t, n) {
    var r = getTokenAtPosition(t, n);
    var i = [];
    try {
      i = Q(t, {
        noLocation: !0
      }).definitions.filter(e => e.kind === k.FRAGMENT_DEFINITION);
    } catch (e) {}
    var a = "on" === r.string && "TypeCondition" === r.state.kind;
    var o = getAutocompleteSuggestions(e, t, n, a ? {
      ...r,
      state: {
        ...r.state,
        step: 1
      },
      type: null
    } : void 0);
    var u = !a ? function getSuggestionsForFragmentSpread(e, t, n, r, i) {
      if (!r) {
        return [];
      }
      var a = n.getTypeMap();
      var o = getDefinitionState(e.state);
      return hintList(e, i.filter(e => a[e.typeCondition.name.value] && !(o && o.kind === kt.FRAGMENT_DEFINITION && o.name === e.name.value) && _(t.parentType) && _(a[e.typeCondition.name.value]) && $(n, t.parentType, a[e.typeCondition.name.value])).map(e => ({
        label: e.name.value,
        detail: String(a[e.typeCondition.name.value]),
        documentation: `fragment ${e.name.value} on ${e.typeCondition.name.value}`,
        kind: _t.Field,
        type: a[e.typeCondition.name.value]
      })));
    }(r, getTypeInfo(e, r.state), e, t, i) : [];
    var s = "Invalid" === r.state.kind ? r.state.prevState : r.state;
    var c = getParentDefinition(r.state, kt.FIELD)?.name;
    if (s && c) {
      var {kind: l} = s;
      if (l === kt.ARGUMENTS || l === kt.ARGUMENT) {
        var d = new Set;
        runOnlineParser(t, (e, t) => {
          if (t.kind === kt.ARGUMENT) {
            var n = getParentDefinition(t, kt.FIELD);
            if (c && t.name && n?.name === c) {
              d.add(t.name);
            }
          }
        });
        o = o.filter(e => !d.has(e.label));
      }
      if (l === kt.SELECTION_SET || l === kt.FIELD || l === kt.ALIASED_FIELD) {
        var f = new Set;
        var v = getUsedFragments(t, c);
        runOnlineParser(t, (e, t) => {
          if (t.kind === kt.FIELD || t.kind === kt.ALIASED_FIELD) {
            var n = getParentDefinition(t, kt.FIELD);
            if (n && n.name === c && t.name) {
              f.add(t.name);
            }
          }
        });
        o = o.filter(e => !f.has(e.label));
        u = u.filter(e => !v.has(e.label));
      }
      if (l === kt.FRAGMENT_SPREAD) {
        var p = getUsedFragments(t, c);
        o = o.filter(e => !p.has(e.label));
        u = u.filter(e => !p.has(e.label));
      }
    }
    return [ o, u ];
  }(S, I, y);
  return {
    isGlobalCompletion: !1,
    isMemberCompletion: !1,
    isNewIdentifierLocation: !1,
    entries: [ ...L.map(e => ({
      ...e,
      kind: n.ScriptElementKind.variableElement,
      name: e.label,
      kindModifiers: "declare",
      sortText: e.sortText || "0",
      labelDetails: {
        detail: e.type ? " " + e.type?.toString() : void 0,
        description: e.documentation
      }
    })), ...O.map(e => ({
      ...e,
      kind: n.ScriptElementKind.variableElement,
      name: e.label,
      insertText: "..." + e.label,
      kindModifiers: "declare",
      sortText: "0",
      labelDetails: {
        description: e.documentation
      }
    })) ]
  };
}

function getUsedFragments(e, t) {
  var n = new Set;
  runOnlineParser(e, (e, r) => {
    if (r.kind === kt.FRAGMENT_SPREAD && r.name) {
      var i = getParentDefinition(r, kt.FIELD);
      if (t && i?.name === t) {
        n.add(r.name);
      }
    }
  });
  return n;
}

function getParentDefinition(e, t) {
  if (e.prevState?.kind === t) {
    return e.prevState;
  }
  if (e.prevState?.prevState?.kind === t) {
    return e.prevState.prevState;
  }
  if (e.prevState?.prevState?.prevState?.kind === t) {
    return e.prevState.prevState.prevState;
  }
  if (e.prevState?.prevState?.prevState?.prevState?.kind === t) {
    return e.prevState.prevState.prevState.prevState;
  }
}

function runOnlineParser(n, r) {
  var i = n.split("\n");
  var a = t();
  var o = a.startState();
  var u = "";
  var s = new e("");
  for (var c = 0; c < i.length; c++) {
    s = new e(i[c]);
    while (!s.eol()) {
      if ("BREAK" === r(s, o, u = a.token(s, o), c)) {
        break;
      }
    }
    r(s, o, u, c);
    if (!o.kind) {
      o = a.startState();
    }
  }
  return {
    start: s.getStartOfToken(),
    end: s.getCurrentPosition(),
    string: s.current(),
    state: o,
    style: u
  };
}

function create(e) {
  var logger = t => e.project.projectService.logger.info(`[GraphQLSP] ${t}`);
  var t = e.config;
  logger("config: " + JSON.stringify(t));
  if (!t.schema && !t.schemas) {
    logger('Missing "schema" option in configuration.');
    throw new Error("Please provide a GraphQL Schema!");
  }
  logger("Setting up the GraphQL Plugin");
  if (t.template) {
    p.add(t.template);
  }
  var c = function createBasicDecorator(e) {
    var t = Object.create(null);
    var _loop = function() {
      var r = e.languageService[n];
      t[n] = (...t) => r.apply(e.languageService, t);
    };
    for (var n of Object.keys(e.languageService)) {
      _loop();
    }
    return t;
  }(e);
  var l = ((e, t, n) => {
    var r = y(t);
    (async () => {
      var i = await S(e.project.getProjectName()) || I.dirname(e.project.getProjectName());
      var a = e.config.tadaDisablePreprocessing ?? !1;
      var o = e.config.tadaOutputLocation && I.resolve(i, e.config.tadaOutputLocation);
      n("Got root-directory to resolve schema from: " + i);
      n('Resolving schema from "schema" config: ' + JSON.stringify(t));
      try {
        n("Loading schema...");
        await r.load({
          rootPath: i
        });
      } catch (e) {
        n(`Failed to load schema: ${e}`);
      }
      if (r.current) {
        if (r.current && void 0 !== r.current.tadaOutputLocation) {
          saveTadaIntrospection(r.current.introspection, o, a, n);
        }
      } else if (r.multi) {
        Object.values(r.multi).forEach(e => {
          if (!e) {
            return;
          }
          if (e.tadaOutputLocation) {
            saveTadaIntrospection(e.introspection, I.resolve(i, e.tadaOutputLocation), a, n);
          }
        });
      }
      r.autoupdate({
        rootPath: i
      }, (e, t) => {
        if (!t) {
          return;
        }
        if (t.tadaOutputLocation) {
          var r = e.multi ? e.multi[t.name] : e.current;
          if (!r) {
            return;
          }
          saveTadaIntrospection(r.introspection, I.resolve(i, t.tadaOutputLocation), a, n);
        }
      });
    })();
    return r;
  })(e, t, logger);
  c.getSemanticDiagnostics = t => {
    var n = e.languageService.getSemanticDiagnostics(t);
    if (n.some(e => g.includes(e.code))) {
      return n;
    }
    var r = m(t, l, e);
    return r ? [ ...r, ...n ] : n;
  };
  c.getCompletionsAtPosition = (t, n, r) => {
    var i = getGraphQLCompletions(t, n, l, e);
    if (i && i.entries.length) {
      return i;
    } else {
      return e.languageService.getCompletionsAtPosition(t, n, r) || {
        isGlobalCompletion: !1,
        isMemberCompletion: !1,
        isNewIdentifierLocation: !1,
        entries: []
      };
    }
  };
  c.getEditsForRefactor = (t, n, r, i, a, o, u) => {
    var s = e.languageService.getEditsForRefactor(t, n, r, i, a, o, u);
    var c = E(t, "number" == typeof r ? r : r.pos, e);
    if (!c) {
      return s;
    }
    return {
      edits: [ {
        fileName: t,
        textChanges: [ {
          newText: c.replacement,
          span: c.span
        } ]
      } ]
    };
  };
  c.getApplicableRefactors = (t, n, r, i, a, o) => {
    var u = e.languageService.getApplicableRefactors(t, n, r, i, a, o);
    if (E(t, "number" == typeof n ? n : n.pos, e)) {
      return [ {
        name: "GraphQL",
        description: "Operations specific to gql.tada!",
        actions: [ {
          name: "Insert document-id",
          description: "Generate a document-id for your persisted-operation, by default a SHA256 hash."
        } ],
        inlineable: !0
      }, ...u ];
    } else {
      return u;
    }
  };
  c.getQuickInfoAtPosition = (t, c) => {
    var v = function getGraphQLQuickInfo(e, t, c, l) {
      var v = l.config.templateIsCallExpression ?? !0;
      var p = l.languageService.getProgram()?.getTypeChecker();
      var g = r(l, e);
      if (!g) {
        return;
      }
      var m = i(g, t);
      if (!m) {
        return;
      }
      m = v ? a(m) : o(m);
      var E, T, I;
      if (v && u(m, p)) {
        var y = l.languageService.getProgram()?.getTypeChecker();
        var S = s(m, y);
        I = S && c.multi[S] ? c.multi[S]?.schema : c.current?.schema;
        var b = getToken(m.arguments[0], t);
        if (!I || !b) {
          return;
        }
        T = m.arguments[0].getText();
        E = new Cursor(b.line, b.start - 1);
      } else if (!v && d(m)) {
        var h = getToken(m.template, t);
        if (!h || !c.current) {
          return;
        }
        var {combinedText: N, resolvedSpans: D} = f(m, e, l);
        var A = D.filter(e => e.original.start < t && e.original.start + e.original.length < t).reduce((e, t) => e + (t.lines - 1), 0);
        h.line = h.line + A;
        T = N;
        E = new Cursor(h.line, h.start - 1);
        I = c.current.schema;
      } else {
        return;
      }
      var _ = getHoverInformation(I, T, E);
      return {
        kind: n.ScriptElementKind.label,
        textSpan: {
          start: t,
          length: 1
        },
        kindModifiers: "text",
        documentation: Array.isArray(_) ? _.map(e => ({
          kind: "text",
          text: e
        })) : [ {
          kind: "text",
          text: _
        } ]
      };
    }(t, c, l, e);
    if (v) {
      return v;
    }
    return e.languageService.getQuickInfoAtPosition(t, c);
  };
  logger("proxy: " + JSON.stringify(c));
  return c;
}

var init = e => {
  v(e);
  return {
    create
  };
};

export { init as default };
//# sourceMappingURL=graphqlsp.mjs.map
