var e = require("./chunks/api-chunk.js");

var t = require("node:fs/promises");

var n = require("path");

var r = require("@gql.tada/internal");

var i = require("graphql");

var statFile = (e, n) => t.stat(e).then(n).catch(() => !1);

var swapWrite = async (e, n) => {
  if (!await statFile(e, e => e.isFile())) {
    await t.writeFile(e, n);
  } else {
    var r = e + ".tmp";
    await t.writeFile(r, n);
    try {
      await t.rename(r, e);
    } catch (e) {
      await t.unlink(r);
      throw e;
    } finally {
      await (async e => {
        try {
          var n = new Date;
          await t.utimes(e, n, n);
        } catch (e) {}
      })(e);
    }
  }
};

async function saveTadaIntrospection(e, i, a, o) {
  var s = r.minifyIntrospection(e);
  var u = r.outputIntrospectionFile(s, {
    fileType: i,
    shouldPreprocess: !a
  });
  var c = i;
  if (await statFile(c, e => e.isDirectory())) {
    c = n.join(c, "introspection.d.ts");
  } else if (!await statFile(c, e => !!e)) {
    await t.mkdir(n.dirname(c), {
      recursive: !0
    });
    if (await statFile(c, e => e.isDirectory())) {
      c = n.join(c, "introspection.d.ts");
    }
  }
  try {
    await swapWrite(c, u);
    o(`Introspection saved to path @ ${c}`);
  } catch (e) {
    o(`Failed to write introspection @ ${e}`);
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
  if (n === i.SchemaMetaFieldDef.name && e.getQueryType() === t) {
    return i.SchemaMetaFieldDef;
  }
  if (n === i.TypeMetaFieldDef.name && e.getQueryType() === t) {
    return i.TypeMetaFieldDef;
  }
  if (n === i.TypeNameMetaFieldDef.name && i.isCompositeType(t)) {
    return i.TypeNameMetaFieldDef;
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
        var s = e[n - 1] === t[r - 1] ? 0 : 1;
        i[n][r] = Math.min(i[n - 1][r] + 1, i[n][r - 1] + 1, i[n - 1][r - 1] + s);
        if (n > 1 && r > 1 && e[n - 1] === t[r - 2] && e[n - 2] === t[r - 1]) {
          i[n][r] = Math.min(i[n][r], i[n - 2][r - 2] + s);
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

var a;

!function(e) {
  e.is = function is(e) {
    return "string" == typeof e;
  };
}(a || (a = {}));

var o;

!function(e) {
  e.is = function is(e) {
    return "string" == typeof e;
  };
}(o || (o = {}));

var s;

!function(e) {
  e.MIN_VALUE = -2147483648;
  e.MAX_VALUE = 2147483647;
  e.is = function is(t) {
    return "number" == typeof t && e.MIN_VALUE <= t && t <= e.MAX_VALUE;
  };
}(s || (s = {}));

var u;

!function(e) {
  e.MIN_VALUE = 0;
  e.MAX_VALUE = 2147483647;
  e.is = function is(t) {
    return "number" == typeof t && e.MIN_VALUE <= t && t <= e.MAX_VALUE;
  };
}(u || (u = {}));

var c;

!function(e) {
  e.create = function create(e, t) {
    if (e === Number.MAX_VALUE) {
      e = u.MAX_VALUE;
    }
    if (t === Number.MAX_VALUE) {
      t = u.MAX_VALUE;
    }
    return {
      line: e,
      character: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && ke.uinteger(t.line) && ke.uinteger(t.character);
  };
}(c || (c = {}));

var l;

!function(e) {
  e.create = function create(e, t, n, r) {
    if (ke.uinteger(e) && ke.uinteger(t) && ke.uinteger(n) && ke.uinteger(r)) {
      return {
        start: c.create(e, t),
        end: c.create(n, r)
      };
    } else if (c.is(e) && c.is(t)) {
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
    return ke.objectLiteral(t) && c.is(t.start) && c.is(t.end);
  };
}(l || (l = {}));

var d;

!function(e) {
  e.create = function create(e, t) {
    return {
      uri: e,
      range: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && l.is(t.range) && (ke.string(t.uri) || ke.undefined(t.uri));
  };
}(d || (d = {}));

var f;

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
    return ke.objectLiteral(t) && l.is(t.targetRange) && ke.string(t.targetUri) && l.is(t.targetSelectionRange) && (l.is(t.originSelectionRange) || ke.undefined(t.originSelectionRange));
  };
}(f || (f = {}));

var v;

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
    return ke.objectLiteral(t) && ke.numberRange(t.red, 0, 1) && ke.numberRange(t.green, 0, 1) && ke.numberRange(t.blue, 0, 1) && ke.numberRange(t.alpha, 0, 1);
  };
}(v || (v = {}));

var p;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      color: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && l.is(t.range) && v.is(t.color);
  };
}(p || (p = {}));

var g;

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
    return ke.objectLiteral(t) && ke.string(t.label) && (ke.undefined(t.textEdit) || N.is(t)) && (ke.undefined(t.additionalTextEdits) || ke.typedArray(t.additionalTextEdits, N.is));
  };
}(g || (g = {}));

var m;

!function(e) {
  e.Comment = "comment";
  e.Imports = "imports";
  e.Region = "region";
}(m || (m = {}));

var E;

!function(e) {
  e.create = function create(e, t, n, r, i, a) {
    var o = {
      startLine: e,
      endLine: t
    };
    if (ke.defined(n)) {
      o.startCharacter = n;
    }
    if (ke.defined(r)) {
      o.endCharacter = r;
    }
    if (ke.defined(i)) {
      o.kind = i;
    }
    if (ke.defined(a)) {
      o.collapsedText = a;
    }
    return o;
  };
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && ke.uinteger(t.startLine) && ke.uinteger(t.startLine) && (ke.undefined(t.startCharacter) || ke.uinteger(t.startCharacter)) && (ke.undefined(t.endCharacter) || ke.uinteger(t.endCharacter)) && (ke.undefined(t.kind) || ke.string(t.kind));
  };
}(E || (E = {}));

var T;

!function(e) {
  e.create = function create(e, t) {
    return {
      location: e,
      message: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && d.is(t.location) && ke.string(t.message);
  };
}(T || (T = {}));

var y;

!function(e) {
  e.Error = 1;
  e.Warning = 2;
  e.Information = 3;
  e.Hint = 4;
}(y || (y = {}));

var I;

!function(e) {
  e.Unnecessary = 1;
  e.Deprecated = 2;
}(I || (I = {}));

var h;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && ke.string(t.href);
  };
}(h || (h = {}));

var S;

!function(e) {
  e.create = function create(e, t, n, r, i, a) {
    var o = {
      range: e,
      message: t
    };
    if (ke.defined(n)) {
      o.severity = n;
    }
    if (ke.defined(r)) {
      o.code = r;
    }
    if (ke.defined(i)) {
      o.source = i;
    }
    if (ke.defined(a)) {
      o.relatedInformation = a;
    }
    return o;
  };
  e.is = function is(e) {
    var t;
    var n = e;
    return ke.defined(n) && l.is(n.range) && ke.string(n.message) && (ke.number(n.severity) || ke.undefined(n.severity)) && (ke.integer(n.code) || ke.string(n.code) || ke.undefined(n.code)) && (ke.undefined(n.codeDescription) || ke.string(null === (t = n.codeDescription) || void 0 === t ? void 0 : t.href)) && (ke.string(n.source) || ke.undefined(n.source)) && (ke.undefined(n.relatedInformation) || ke.typedArray(n.relatedInformation, T.is));
  };
}(S || (S = {}));

var b;

!function(e) {
  e.create = function create(e, t, ...n) {
    var r = {
      title: e,
      command: t
    };
    if (ke.defined(n) && n.length > 0) {
      r.arguments = n;
    }
    return r;
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && ke.string(t.title) && ke.string(t.command);
  };
}(b || (b = {}));

var N;

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
    return ke.objectLiteral(t) && ke.string(t.newText) && l.is(t.range);
  };
}(N || (N = {}));

var D;

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
    return ke.objectLiteral(t) && ke.string(t.label) && (ke.boolean(t.needsConfirmation) || void 0 === t.needsConfirmation) && (ke.string(t.description) || void 0 === t.description);
  };
}(D || (D = {}));

var L;

!function(e) {
  e.is = function is(e) {
    return ke.string(e);
  };
}(L || (L = {}));

var A;

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
    return N.is(t) && (D.is(t.annotationId) || L.is(t.annotationId));
  };
}(A || (A = {}));

var F;

!function(e) {
  e.create = function create(e, t) {
    return {
      textDocument: e,
      edits: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && x.is(t.textDocument) && Array.isArray(t.edits);
  };
}(F || (F = {}));

var _;

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
    return t && "create" === t.kind && ke.string(t.uri) && (void 0 === t.options || (void 0 === t.options.overwrite || ke.boolean(t.options.overwrite)) && (void 0 === t.options.ignoreIfExists || ke.boolean(t.options.ignoreIfExists))) && (void 0 === t.annotationId || L.is(t.annotationId));
  };
}(_ || (_ = {}));

var k;

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
    return t && "rename" === t.kind && ke.string(t.oldUri) && ke.string(t.newUri) && (void 0 === t.options || (void 0 === t.options.overwrite || ke.boolean(t.options.overwrite)) && (void 0 === t.options.ignoreIfExists || ke.boolean(t.options.ignoreIfExists))) && (void 0 === t.annotationId || L.is(t.annotationId));
  };
}(k || (k = {}));

var C;

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
    return t && "delete" === t.kind && ke.string(t.uri) && (void 0 === t.options || (void 0 === t.options.recursive || ke.boolean(t.options.recursive)) && (void 0 === t.options.ignoreIfNotExists || ke.boolean(t.options.ignoreIfNotExists))) && (void 0 === t.annotationId || L.is(t.annotationId));
  };
}(C || (C = {}));

var O;

!function(e) {
  e.is = function is(e) {
    return e && (void 0 !== e.changes || void 0 !== e.documentChanges) && (void 0 === e.documentChanges || e.documentChanges.every(e => {
      if (ke.string(e.kind)) {
        return _.is(e) || k.is(e) || C.is(e);
      } else {
        return F.is(e);
      }
    }));
  };
}(O || (O = {}));

var M;

!function(e) {
  e.create = function create(e) {
    return {
      uri: e
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && ke.string(t.uri);
  };
}(M || (M = {}));

var P;

!function(e) {
  e.create = function create(e, t) {
    return {
      uri: e,
      version: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && ke.string(t.uri) && ke.integer(t.version);
  };
}(P || (P = {}));

var x;

!function(e) {
  e.create = function create(e, t) {
    return {
      uri: e,
      version: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && ke.string(t.uri) && (null === t.version || ke.integer(t.version));
  };
}(x || (x = {}));

var R;

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
    return ke.defined(t) && ke.string(t.uri) && ke.string(t.languageId) && ke.integer(t.version) && ke.string(t.text);
  };
}(R || (R = {}));

var U;

!function(e) {
  e.PlainText = "plaintext";
  e.Markdown = "markdown";
  e.is = function is(t) {
    return t === e.PlainText || t === e.Markdown;
  };
}(U || (U = {}));

var w;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(e) && U.is(t.kind) && ke.string(t.value);
  };
}(w || (w = {}));

var j;

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
}(j || (j = {}));

var V;

!function(e) {
  e.PlainText = 1;
  e.Snippet = 2;
}(V || (V = {}));

var G;

!function(e) {
  e.Deprecated = 1;
}(G || (G = {}));

var Y;

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
    return t && ke.string(t.newText) && l.is(t.insert) && l.is(t.replace);
  };
}(Y || (Y = {}));

var $;

!function(e) {
  e.asIs = 1;
  e.adjustIndentation = 2;
}($ || ($ = {}));

var Q;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return t && (ke.string(t.detail) || void 0 === t.detail) && (ke.string(t.description) || void 0 === t.description);
  };
}(Q || (Q = {}));

var B;

!function(e) {
  e.create = function create(e) {
    return {
      label: e
    };
  };
}(B || (B = {}));

var K;

!function(e) {
  e.create = function create(e, t) {
    return {
      items: e ? e : [],
      isIncomplete: !!t
    };
  };
}(K || (K = {}));

var X;

!function(e) {
  e.fromPlainText = function fromPlainText(e) {
    return e.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
  };
  e.is = function is(e) {
    var t = e;
    return ke.string(t) || ke.objectLiteral(t) && ke.string(t.language) && ke.string(t.value);
  };
}(X || (X = {}));

var J;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return !!t && ke.objectLiteral(t) && (w.is(t.contents) || X.is(t.contents) || ke.typedArray(t.contents, X.is)) && (void 0 === e.range || l.is(e.range));
  };
}(J || (J = {}));

var q;

!function(e) {
  e.create = function create(e, t) {
    return t ? {
      label: e,
      documentation: t
    } : {
      label: e
    };
  };
}(q || (q = {}));

var z;

!function(e) {
  e.create = function create(e, t, ...n) {
    var r = {
      label: e
    };
    if (ke.defined(t)) {
      r.documentation = t;
    }
    if (ke.defined(n)) {
      r.parameters = n;
    } else {
      r.parameters = [];
    }
    return r;
  };
}(z || (z = {}));

var H;

!function(e) {
  e.Text = 1;
  e.Read = 2;
  e.Write = 3;
}(H || (H = {}));

var W;

!function(e) {
  e.create = function create(e, t) {
    var n = {
      range: e
    };
    if (ke.number(t)) {
      n.kind = t;
    }
    return n;
  };
}(W || (W = {}));

var Z;

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
}(Z || (Z = {}));

var ee;

!function(e) {
  e.Deprecated = 1;
}(ee || (ee = {}));

var te;

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
}(te || (te = {}));

var ne;

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
}(ne || (ne = {}));

var re;

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
    return t && ke.string(t.name) && ke.number(t.kind) && l.is(t.range) && l.is(t.selectionRange) && (void 0 === t.detail || ke.string(t.detail)) && (void 0 === t.deprecated || ke.boolean(t.deprecated)) && (void 0 === t.children || Array.isArray(t.children)) && (void 0 === t.tags || Array.isArray(t.tags));
  };
}(re || (re = {}));

var ie;

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
}(ie || (ie = {}));

var ae;

!function(e) {
  e.Invoked = 1;
  e.Automatic = 2;
}(ae || (ae = {}));

var oe;

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
    return ke.defined(t) && ke.typedArray(t.diagnostics, S.is) && (void 0 === t.only || ke.typedArray(t.only, ke.string)) && (void 0 === t.triggerKind || t.triggerKind === ae.Invoked || t.triggerKind === ae.Automatic);
  };
}(oe || (oe = {}));

var se;

!function(e) {
  e.create = function create(e, t, n) {
    var r = {
      title: e
    };
    var i = !0;
    if ("string" == typeof t) {
      i = !1;
      r.kind = t;
    } else if (b.is(t)) {
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
    return t && ke.string(t.title) && (void 0 === t.diagnostics || ke.typedArray(t.diagnostics, S.is)) && (void 0 === t.kind || ke.string(t.kind)) && (void 0 !== t.edit || void 0 !== t.command) && (void 0 === t.command || b.is(t.command)) && (void 0 === t.isPreferred || ke.boolean(t.isPreferred)) && (void 0 === t.edit || O.is(t.edit));
  };
}(se || (se = {}));

var ue;

!function(e) {
  e.create = function create(e, t) {
    var n = {
      range: e
    };
    if (ke.defined(t)) {
      n.data = t;
    }
    return n;
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && l.is(t.range) && (ke.undefined(t.command) || b.is(t.command));
  };
}(ue || (ue = {}));

var ce;

!function(e) {
  e.create = function create(e, t) {
    return {
      tabSize: e,
      insertSpaces: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && ke.uinteger(t.tabSize) && ke.boolean(t.insertSpaces);
  };
}(ce || (ce = {}));

var le;

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
    return ke.defined(t) && l.is(t.range) && (ke.undefined(t.target) || ke.string(t.target));
  };
}(le || (le = {}));

var de;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      parent: t
    };
  };
  e.is = function is(t) {
    var n = t;
    return ke.objectLiteral(n) && l.is(n.range) && (void 0 === n.parent || e.is(n.parent));
  };
}(de || (de = {}));

var fe;

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
}(fe || (fe = {}));

var ve;

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
}(ve || (ve = {}));

var pe;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && (void 0 === t.resultId || "string" == typeof t.resultId) && Array.isArray(t.data) && (0 === t.data.length || "number" == typeof t.data[0]);
  };
}(pe || (pe = {}));

var ge;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      text: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return null != t && l.is(t.range) && ke.string(t.text);
  };
}(ge || (ge = {}));

var me;

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
    return null != t && l.is(t.range) && ke.boolean(t.caseSensitiveLookup) && (ke.string(t.variableName) || void 0 === t.variableName);
  };
}(me || (me = {}));

var Ee;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      expression: t
    };
  };
  e.is = function is(e) {
    var t = e;
    return null != t && l.is(t.range) && (ke.string(t.expression) || void 0 === t.expression);
  };
}(Ee || (Ee = {}));

var Te;

!function(e) {
  e.create = function create(e, t) {
    return {
      frameId: e,
      stoppedLocation: t
    };
  };
  e.is = function is(e) {
    return ke.defined(e) && l.is(e.stoppedLocation);
  };
}(Te || (Te = {}));

var ye;

!function(e) {
  e.Type = 1;
  e.Parameter = 2;
  e.is = function is(e) {
    return 1 === e || 2 === e;
  };
}(ye || (ye = {}));

var Ie;

!function(e) {
  e.create = function create(e) {
    return {
      value: e
    };
  };
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && (void 0 === t.tooltip || ke.string(t.tooltip) || w.is(t.tooltip)) && (void 0 === t.location || d.is(t.location)) && (void 0 === t.command || b.is(t.command));
  };
}(Ie || (Ie = {}));

var he;

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
    return ke.objectLiteral(t) && c.is(t.position) && (ke.string(t.label) || ke.typedArray(t.label, Ie.is)) && (void 0 === t.kind || ye.is(t.kind)) && void 0 === t.textEdits || ke.typedArray(t.textEdits, N.is) && (void 0 === t.tooltip || ke.string(t.tooltip) || w.is(t.tooltip)) && (void 0 === t.paddingLeft || ke.boolean(t.paddingLeft)) && (void 0 === t.paddingRight || ke.boolean(t.paddingRight));
  };
}(he || (he = {}));

var Se;

!function(e) {
  e.createSnippet = function createSnippet(e) {
    return {
      kind: "snippet",
      value: e
    };
  };
}(Se || (Se = {}));

var be;

!function(e) {
  e.create = function create(e, t, n, r) {
    return {
      insertText: e,
      filterText: t,
      range: n,
      command: r
    };
  };
}(be || (be = {}));

var Ne;

!function(e) {
  e.create = function create(e) {
    return {
      items: e
    };
  };
}(Ne || (Ne = {}));

var De;

!function(e) {
  e.Invoked = 0;
  e.Automatic = 1;
}(De || (De = {}));

var Le;

!function(e) {
  e.create = function create(e, t) {
    return {
      range: e,
      text: t
    };
  };
}(Le || (Le = {}));

var Ae;

!function(e) {
  e.create = function create(e, t) {
    return {
      triggerKind: e,
      selectedCompletionInfo: t
    };
  };
}(Ae || (Ae = {}));

var Fe;

!function(e) {
  e.is = function is(e) {
    var t = e;
    return ke.objectLiteral(t) && o.is(t.uri) && ke.string(t.name);
  };
}(Fe || (Fe = {}));

var _e;

!function(e) {
  e.create = function create(e, t, n, r) {
    return new FullTextDocument(e, t, n, r);
  };
  e.is = function is(e) {
    var t = e;
    return ke.defined(t) && ke.string(t.uri) && (ke.undefined(t.languageId) || ke.string(t.languageId)) && ke.uinteger(t.lineCount) && ke.func(t.getText) && ke.func(t.positionAt) && ke.func(t.offsetAt) ? !0 : !1;
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
      var s = e.offsetAt(o.range.start);
      var u = e.offsetAt(o.range.end);
      if (u <= i) {
        n = n.substring(0, s) + o.newText + n.substring(u, n.length);
      } else {
        throw new Error("Overlapping edit");
      }
      i = s;
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
    var s = 0;
    while (a < r.length && o < i.length) {
      if (t(r[a], i[o]) <= 0) {
        e[s++] = r[a++];
      } else {
        e[s++] = i[o++];
      }
    }
    while (a < r.length) {
      e[s++] = r[a++];
    }
    while (o < i.length) {
      e[s++] = i[o++];
    }
    return e;
  }
}(_e || (_e = {}));

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
      return c.create(0, e);
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
    return c.create(a, e - t[a]);
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

var ke;

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
}(ke || (ke = {}));

var Ce;

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
}(Ce || (Ce = {}));

var Oe = Object.assign(Object.assign({}, i.Kind), {
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

var Me = {
  command: "editor.action.triggerSuggest",
  title: "Suggestions"
};

var Pe = [ i.Kind.SCHEMA_DEFINITION, i.Kind.OPERATION_TYPE_DEFINITION, i.Kind.SCALAR_TYPE_DEFINITION, i.Kind.OBJECT_TYPE_DEFINITION, i.Kind.INTERFACE_TYPE_DEFINITION, i.Kind.UNION_TYPE_DEFINITION, i.Kind.ENUM_TYPE_DEFINITION, i.Kind.INPUT_OBJECT_TYPE_DEFINITION, i.Kind.DIRECTIVE_DEFINITION, i.Kind.SCHEMA_EXTENSION, i.Kind.SCALAR_TYPE_EXTENSION, i.Kind.OBJECT_TYPE_EXTENSION, i.Kind.INTERFACE_TYPE_EXTENSION, i.Kind.UNION_TYPE_EXTENSION, i.Kind.ENUM_TYPE_EXTENSION, i.Kind.INPUT_OBJECT_TYPE_EXTENSION ];

function getAutocompleteSuggestions(e, t, n, r, a, o) {
  var s;
  var u = Object.assign(Object.assign({}, o), {
    schema: e
  });
  var c = r || getTokenAtPosition(t, n, 1);
  var l = "Invalid" === c.state.kind ? c.state.prevState : c.state;
  var d = (null == o ? void 0 : o.mode) || function getDocumentMode(e, t) {
    if (null == t ? void 0 : t.endsWith(".graphqls")) {
      return Re.TYPE_SYSTEM;
    }
    return (e => {
      var t = !1;
      if (e) {
        try {
          i.visit(i.parse(e), {
            enter(e) {
              if ("Document" === e.kind) {
                return;
              }
              if (Pe.includes(e.kind)) {
                t = !0;
                return i.BREAK;
              }
              return !1;
            }
          });
        } catch (e) {
          return t;
        }
      }
      return t;
    })(e) ? Re.TYPE_SYSTEM : Re.EXECUTABLE;
  }(t, null == o ? void 0 : o.uri);
  if (!l) {
    return [];
  }
  var {kind: f, step: v, prevState: p} = l;
  var g = getTypeInfo(e, c.state);
  if (f === Oe.DOCUMENT) {
    if (d === Re.TYPE_SYSTEM) {
      return function getSuggestionsForTypeSystemDefinitions(e) {
        return hintList$1(e, [ {
          label: "extend",
          kind: Ce.Function
        }, {
          label: "type",
          kind: Ce.Function
        }, {
          label: "interface",
          kind: Ce.Function
        }, {
          label: "union",
          kind: Ce.Function
        }, {
          label: "input",
          kind: Ce.Function
        }, {
          label: "scalar",
          kind: Ce.Function
        }, {
          label: "schema",
          kind: Ce.Function
        } ]);
      }(c);
    }
    return function getSuggestionsForExecutableDefinitions(e) {
      return hintList$1(e, [ {
        label: "query",
        kind: Ce.Function
      }, {
        label: "mutation",
        kind: Ce.Function
      }, {
        label: "subscription",
        kind: Ce.Function
      }, {
        label: "fragment",
        kind: Ce.Function
      }, {
        label: "{",
        kind: Ce.Constructor
      } ]);
    }(c);
  }
  if (f === Oe.EXTEND_DEF) {
    return function getSuggestionsForExtensionDefinitions(e) {
      return hintList$1(e, [ {
        label: "type",
        kind: Ce.Function
      }, {
        label: "interface",
        kind: Ce.Function
      }, {
        label: "union",
        kind: Ce.Function
      }, {
        label: "input",
        kind: Ce.Function
      }, {
        label: "scalar",
        kind: Ce.Function
      }, {
        label: "schema",
        kind: Ce.Function
      } ]);
    }(c);
  }
  if ((null === (s = null == p ? void 0 : p.prevState) || void 0 === s ? void 0 : s.kind) === Oe.EXTENSION_DEFINITION && l.name) {
    return hintList$1(c, []);
  }
  if ((null == p ? void 0 : p.kind) === i.Kind.SCALAR_TYPE_EXTENSION) {
    return hintList$1(c, Object.values(e.getTypeMap()).filter(i.isScalarType).map(e => ({
      label: e.name,
      kind: Ce.Function
    })));
  }
  if ((null == p ? void 0 : p.kind) === i.Kind.OBJECT_TYPE_EXTENSION) {
    return hintList$1(c, Object.values(e.getTypeMap()).filter(e => i.isObjectType(e) && !e.name.startsWith("__")).map(e => ({
      label: e.name,
      kind: Ce.Function
    })));
  }
  if ((null == p ? void 0 : p.kind) === i.Kind.INTERFACE_TYPE_EXTENSION) {
    return hintList$1(c, Object.values(e.getTypeMap()).filter(i.isInterfaceType).map(e => ({
      label: e.name,
      kind: Ce.Function
    })));
  }
  if ((null == p ? void 0 : p.kind) === i.Kind.UNION_TYPE_EXTENSION) {
    return hintList$1(c, Object.values(e.getTypeMap()).filter(i.isUnionType).map(e => ({
      label: e.name,
      kind: Ce.Function
    })));
  }
  if ((null == p ? void 0 : p.kind) === i.Kind.ENUM_TYPE_EXTENSION) {
    return hintList$1(c, Object.values(e.getTypeMap()).filter(e => i.isEnumType(e) && !e.name.startsWith("__")).map(e => ({
      label: e.name,
      kind: Ce.Function
    })));
  }
  if ((null == p ? void 0 : p.kind) === i.Kind.INPUT_OBJECT_TYPE_EXTENSION) {
    return hintList$1(c, Object.values(e.getTypeMap()).filter(i.isInputObjectType).map(e => ({
      label: e.name,
      kind: Ce.Function
    })));
  }
  if (f === Oe.IMPLEMENTS || f === Oe.NAMED_TYPE && (null == p ? void 0 : p.kind) === Oe.IMPLEMENTS) {
    return function getSuggestionsForImplements(e, t, n, r, a) {
      if (t.needsSeparator) {
        return [];
      }
      var o = n.getTypeMap();
      var s = objectValues(o).filter(i.isInterfaceType);
      var u = s.map(({name: e}) => e);
      var c = new Set;
      runOnlineParser$1(r, (e, t) => {
        var r, o, s, l, d;
        if (t.name) {
          if (t.kind === Oe.INTERFACE_DEF && !u.includes(t.name)) {
            c.add(t.name);
          }
          if (t.kind === Oe.NAMED_TYPE && (null === (r = t.prevState) || void 0 === r ? void 0 : r.kind) === Oe.IMPLEMENTS) {
            if (a.interfaceDef) {
              if (null === (o = a.interfaceDef) || void 0 === o ? void 0 : o.getInterfaces().find(({name: e}) => e === t.name)) {
                return;
              }
              var f = n.getType(t.name);
              var v = null === (s = a.interfaceDef) || void 0 === s ? void 0 : s.toConfig();
              a.interfaceDef = new i.GraphQLInterfaceType(Object.assign(Object.assign({}, v), {
                interfaces: [ ...v.interfaces, f || new i.GraphQLInterfaceType({
                  name: t.name,
                  fields: {}
                }) ]
              }));
            } else if (a.objectTypeDef) {
              if (null === (l = a.objectTypeDef) || void 0 === l ? void 0 : l.getInterfaces().find(({name: e}) => e === t.name)) {
                return;
              }
              var p = n.getType(t.name);
              var g = null === (d = a.objectTypeDef) || void 0 === d ? void 0 : d.toConfig();
              a.objectTypeDef = new i.GraphQLObjectType(Object.assign(Object.assign({}, g), {
                interfaces: [ ...g.interfaces, p || new i.GraphQLInterfaceType({
                  name: t.name,
                  fields: {}
                }) ]
              }));
            }
          }
        }
      });
      var l = a.interfaceDef || a.objectTypeDef;
      var d = ((null == l ? void 0 : l.getInterfaces()) || []).map(({name: e}) => e);
      var f = s.concat([ ...c ].map(e => ({
        name: e
      }))).filter(({name: e}) => e !== (null == l ? void 0 : l.name) && !d.includes(e));
      return hintList$1(e, f.map(e => {
        var t = {
          label: e.name,
          kind: Ce.Interface,
          type: e
        };
        if (null == e ? void 0 : e.description) {
          t.documentation = e.description;
        }
        return t;
      }));
    }(c, l, e, t, g);
  }
  if (f === Oe.SELECTION_SET || f === Oe.FIELD || f === Oe.ALIASED_FIELD) {
    return function getSuggestionsForFieldNames(e, t, n) {
      var r;
      if (t.parentType) {
        var {parentType: a} = t;
        var o = [];
        if ("getFields" in a) {
          o = objectValues(a.getFields());
        }
        if (i.isCompositeType(a)) {
          o.push(i.TypeNameMetaFieldDef);
        }
        if (a === (null === (r = null == n ? void 0 : n.schema) || void 0 === r ? void 0 : r.getQueryType())) {
          o.push(i.SchemaMetaFieldDef, i.TypeMetaFieldDef);
        }
        return hintList$1(e, o.map((e, t) => {
          var r;
          var i = {
            sortText: String(t) + e.name,
            label: e.name,
            detail: String(e.type),
            documentation: null !== (r = e.description) && void 0 !== r ? r : void 0,
            deprecated: Boolean(e.deprecationReason),
            isDeprecated: Boolean(e.deprecationReason),
            deprecationReason: e.deprecationReason,
            kind: Ce.Field,
            type: e.type
          };
          if (null == n ? void 0 : n.fillLeafsOnComplete) {
            var a = getInsertText(e);
            if (a) {
              i.insertText = e.name + a;
              i.insertTextFormat = V.Snippet;
              i.command = Me;
            }
          }
          return i;
        }));
      }
      return [];
    }(c, g, u);
  }
  if (f === Oe.ARGUMENTS || f === Oe.ARGUMENT && 0 === v) {
    var {argDefs: m} = g;
    if (m) {
      return hintList$1(c, m.map(e => {
        var t;
        return {
          label: e.name,
          insertText: e.name + ": ",
          command: Me,
          detail: String(e.type),
          documentation: null !== (t = e.description) && void 0 !== t ? t : void 0,
          kind: Ce.Variable,
          type: e.type
        };
      }));
    }
  }
  if ((f === Oe.OBJECT_VALUE || f === Oe.OBJECT_FIELD && 0 === v) && g.objectFieldDefs) {
    var E = objectValues(g.objectFieldDefs);
    var T = f === Oe.OBJECT_VALUE ? Ce.Value : Ce.Field;
    return hintList$1(c, E.map(e => {
      var t;
      return {
        label: e.name,
        detail: String(e.type),
        documentation: null !== (t = e.description) && void 0 !== t ? t : void 0,
        kind: T,
        type: e.type
      };
    }));
  }
  if (f === Oe.ENUM_VALUE || f === Oe.LIST_VALUE && 1 === v || f === Oe.OBJECT_FIELD && 2 === v || f === Oe.ARGUMENT && 2 === v) {
    return function getSuggestionsForInputValues(e, t, n, r) {
      var a = i.getNamedType(t.inputType);
      var o = getVariableCompletions(n, r, e).filter(e => e.detail === a.name);
      if (a instanceof i.GraphQLEnumType) {
        return hintList$1(e, a.getValues().map(e => {
          var t;
          return {
            label: e.name,
            detail: String(a),
            documentation: null !== (t = e.description) && void 0 !== t ? t : void 0,
            deprecated: Boolean(e.deprecationReason),
            isDeprecated: Boolean(e.deprecationReason),
            deprecationReason: e.deprecationReason,
            kind: Ce.EnumMember,
            type: a
          };
        }).concat(o));
      }
      if (a === i.GraphQLBoolean) {
        return hintList$1(e, o.concat([ {
          label: "true",
          detail: String(i.GraphQLBoolean),
          documentation: "Not false.",
          kind: Ce.Variable,
          type: i.GraphQLBoolean
        }, {
          label: "false",
          detail: String(i.GraphQLBoolean),
          documentation: "Not true.",
          kind: Ce.Variable,
          type: i.GraphQLBoolean
        } ]));
      }
      return o;
    }(c, g, t, e);
  }
  if (f === Oe.VARIABLE && 1 === v) {
    var y = i.getNamedType(g.inputType);
    return hintList$1(c, getVariableCompletions(t, e, c).filter(e => e.detail === (null == y ? void 0 : y.name)));
  }
  if (f === Oe.TYPE_CONDITION && 1 === v || f === Oe.NAMED_TYPE && null != p && p.kind === Oe.TYPE_CONDITION) {
    return function getSuggestionsForFragmentTypeConditions(e, t, n, r) {
      var a;
      if (t.parentType) {
        if (i.isAbstractType(t.parentType)) {
          var o = i.assertAbstractType(t.parentType);
          var s = n.getPossibleTypes(o);
          var u = Object.create(null);
          for (var c of s) {
            for (var l of c.getInterfaces()) {
              u[l.name] = l;
            }
          }
          a = s.concat(objectValues(u));
        } else {
          a = [ t.parentType ];
        }
      } else {
        a = objectValues(n.getTypeMap()).filter(e => i.isCompositeType(e) && !e.name.startsWith("__"));
      }
      return hintList$1(e, a.map(e => {
        var t = i.getNamedType(e);
        return {
          label: String(e),
          documentation: (null == t ? void 0 : t.description) || "",
          kind: Ce.Field
        };
      }));
    }(c, g, e);
  }
  if (f === Oe.FRAGMENT_SPREAD && 1 === v) {
    return function getSuggestionsForFragmentSpread$1(e, t, n, r, a) {
      if (!r) {
        return [];
      }
      var o = n.getTypeMap();
      var s = getDefinitionState(e.state);
      var u = function getFragmentDefinitions(e) {
        var t = [];
        runOnlineParser$1(e, (e, n) => {
          if (n.kind === Oe.FRAGMENT_DEFINITION && n.name && n.type) {
            t.push({
              kind: Oe.FRAGMENT_DEFINITION,
              name: {
                kind: i.Kind.NAME,
                value: n.name
              },
              selectionSet: {
                kind: Oe.SELECTION_SET,
                selections: []
              },
              typeCondition: {
                kind: Oe.NAMED_TYPE,
                name: {
                  kind: i.Kind.NAME,
                  value: n.type
                }
              }
            });
          }
        });
        return t;
      }(r);
      if (a && a.length > 0) {
        u.push(...a);
      }
      var c = u.filter(e => o[e.typeCondition.name.value] && !(s && s.kind === Oe.FRAGMENT_DEFINITION && s.name === e.name.value) && i.isCompositeType(t.parentType) && i.isCompositeType(o[e.typeCondition.name.value]) && i.doTypesOverlap(n, t.parentType, o[e.typeCondition.name.value]));
      return hintList$1(e, c.map(e => ({
        label: e.name.value,
        detail: String(o[e.typeCondition.name.value]),
        documentation: `fragment ${e.name.value} on ${e.typeCondition.name.value}`,
        kind: Ce.Field,
        type: o[e.typeCondition.name.value]
      })));
    }(c, g, e, t, Array.isArray(a) ? a : (e => {
      var t = [];
      if (e) {
        try {
          i.visit(i.parse(e), {
            FragmentDefinition(e) {
              t.push(e);
            }
          });
        } catch (e) {
          return [];
        }
      }
      return t;
    })(a));
  }
  var I = unwrapType(l);
  if (d === Re.TYPE_SYSTEM && !I.needsAdvance && f === Oe.NAMED_TYPE || f === Oe.LIST_TYPE) {
    if (I.kind === Oe.FIELD_DEF) {
      return hintList$1(c, Object.values(e.getTypeMap()).filter(e => i.isOutputType(e) && !e.name.startsWith("__")).map(e => ({
        label: e.name,
        kind: Ce.Function
      })));
    }
    if (I.kind === Oe.INPUT_VALUE_DEF) {
      return hintList$1(c, Object.values(e.getTypeMap()).filter(e => i.isInputType(e) && !e.name.startsWith("__")).map(e => ({
        label: e.name,
        kind: Ce.Function
      })));
    }
  }
  if (f === Oe.VARIABLE_DEFINITION && 2 === v || f === Oe.LIST_TYPE && 1 === v || f === Oe.NAMED_TYPE && p && (p.kind === Oe.VARIABLE_DEFINITION || p.kind === Oe.LIST_TYPE || p.kind === Oe.NON_NULL_TYPE)) {
    return function getSuggestionsForVariableDefinition(e, t, n) {
      var r = t.getTypeMap();
      var a = objectValues(r).filter(i.isInputType);
      return hintList$1(e, a.map(e => ({
        label: e.name,
        documentation: e.description,
        kind: Ce.Variable
      })));
    }(c, e);
  }
  if (f === Oe.DIRECTIVE) {
    return function getSuggestionsForDirective(e, t, n, r) {
      var a;
      if (null === (a = t.prevState) || void 0 === a ? void 0 : a.kind) {
        var o = n.getDirectives().filter(e => function canUseDirective(e, t) {
          if (!(null == e ? void 0 : e.kind)) {
            return !1;
          }
          var {kind: n, prevState: r} = e;
          var {locations: a} = t;
          switch (n) {
           case Oe.QUERY:
            return a.includes(i.DirectiveLocation.QUERY);

           case Oe.MUTATION:
            return a.includes(i.DirectiveLocation.MUTATION);

           case Oe.SUBSCRIPTION:
            return a.includes(i.DirectiveLocation.SUBSCRIPTION);

           case Oe.FIELD:
           case Oe.ALIASED_FIELD:
            return a.includes(i.DirectiveLocation.FIELD);

           case Oe.FRAGMENT_DEFINITION:
            return a.includes(i.DirectiveLocation.FRAGMENT_DEFINITION);

           case Oe.FRAGMENT_SPREAD:
            return a.includes(i.DirectiveLocation.FRAGMENT_SPREAD);

           case Oe.INLINE_FRAGMENT:
            return a.includes(i.DirectiveLocation.INLINE_FRAGMENT);

           case Oe.SCHEMA_DEF:
            return a.includes(i.DirectiveLocation.SCHEMA);

           case Oe.SCALAR_DEF:
            return a.includes(i.DirectiveLocation.SCALAR);

           case Oe.OBJECT_TYPE_DEF:
            return a.includes(i.DirectiveLocation.OBJECT);

           case Oe.FIELD_DEF:
            return a.includes(i.DirectiveLocation.FIELD_DEFINITION);

           case Oe.INTERFACE_DEF:
            return a.includes(i.DirectiveLocation.INTERFACE);

           case Oe.UNION_DEF:
            return a.includes(i.DirectiveLocation.UNION);

           case Oe.ENUM_DEF:
            return a.includes(i.DirectiveLocation.ENUM);

           case Oe.ENUM_VALUE:
            return a.includes(i.DirectiveLocation.ENUM_VALUE);

           case Oe.INPUT_DEF:
            return a.includes(i.DirectiveLocation.INPUT_OBJECT);

           case Oe.INPUT_VALUE_DEF:
            switch (null == r ? void 0 : r.kind) {
             case Oe.ARGUMENTS_DEF:
              return a.includes(i.DirectiveLocation.ARGUMENT_DEFINITION);

             case Oe.INPUT_DEF:
              return a.includes(i.DirectiveLocation.INPUT_FIELD_DEFINITION);
            }
          }
          return !1;
        }(t.prevState, e));
        return hintList$1(e, o.map(e => ({
          label: e.name,
          documentation: e.description || "",
          kind: Ce.Function
        })));
      }
      return [];
    }(c, l, e);
  }
  return [];
}

var xe = " {\n  $1\n}";

var getInsertText = e => {
  var {type: t} = e;
  if (i.isCompositeType(t)) {
    return xe;
  }
  if (i.isListType(t) && i.isCompositeType(t.ofType)) {
    return xe;
  }
  if (i.isNonNullType(t)) {
    if (i.isCompositeType(t.ofType)) {
      return xe;
    }
    if (i.isListType(t.ofType) && i.isCompositeType(t.ofType.ofType)) {
      return xe;
    }
  }
  return null;
};

var getParentDefinition$1 = (e, t) => {
  var n, r, i, a, o, s, u, c, l, d;
  if ((null === (n = e.prevState) || void 0 === n ? void 0 : n.kind) === t) {
    return e.prevState;
  }
  if ((null === (i = null === (r = e.prevState) || void 0 === r ? void 0 : r.prevState) || void 0 === i ? void 0 : i.kind) === t) {
    return e.prevState.prevState;
  }
  if ((null === (s = null === (o = null === (a = e.prevState) || void 0 === a ? void 0 : a.prevState) || void 0 === o ? void 0 : o.prevState) || void 0 === s ? void 0 : s.kind) === t) {
    return e.prevState.prevState.prevState;
  }
  if ((null === (d = null === (l = null === (c = null === (u = e.prevState) || void 0 === u ? void 0 : u.prevState) || void 0 === c ? void 0 : c.prevState) || void 0 === l ? void 0 : l.prevState) || void 0 === d ? void 0 : d.kind) === t) {
    return e.prevState.prevState.prevState.prevState;
  }
};

function getVariableCompletions(e, t, n) {
  var r = null;
  var i;
  var a = Object.create({});
  runOnlineParser$1(e, (e, o) => {
    if ((null == o ? void 0 : o.kind) === Oe.VARIABLE && o.name) {
      r = o.name;
    }
    if ((null == o ? void 0 : o.kind) === Oe.NAMED_TYPE && r) {
      var s = getParentDefinition$1(o, Oe.TYPE);
      if (null == s ? void 0 : s.type) {
        i = t.getType(null == s ? void 0 : s.type);
      }
    }
    if (r && i && !a[r]) {
      a[r] = {
        detail: i.toString(),
        insertText: "$" === n.string ? r : "$" + r,
        label: r,
        type: i,
        kind: Ce.Variable
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
  var o = runOnlineParser$1(e, (e, o, s, u) => {
    if (u !== t.line || e.getCurrentPosition() + n < t.character + 1) {
      return;
    }
    r = s;
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

function runOnlineParser$1(t, n) {
  var r = t.split("\n");
  var i = e.onlineParser();
  var a = i.startState();
  var o = "";
  var s = new e.CharacterStream("");
  for (var u = 0; u < r.length; u++) {
    s = new e.CharacterStream(r[u]);
    while (!s.eol()) {
      if ("BREAK" === n(s, a, o = i.token(s, a), u)) {
        break;
      }
    }
    n(s, a, o, u);
    if (!a.kind) {
      a = i.startState();
    }
  }
  return {
    start: s.getStartOfToken(),
    end: s.getCurrentPosition(),
    string: s.current(),
    state: a,
    style: o
  };
}

function getTypeInfo(e, t) {
  var n;
  var r;
  var a;
  var o;
  var s;
  var u;
  var c;
  var l;
  var d;
  var f;
  var v;
  forEachState(t, t => {
    var p;
    switch (t.kind) {
     case Oe.QUERY:
     case "ShortQuery":
      f = e.getQueryType();
      break;

     case Oe.MUTATION:
      f = e.getMutationType();
      break;

     case Oe.SUBSCRIPTION:
      f = e.getSubscriptionType();
      break;

     case Oe.INLINE_FRAGMENT:
     case Oe.FRAGMENT_DEFINITION:
      if (t.type) {
        f = e.getType(t.type);
      }
      break;

     case Oe.FIELD:
     case Oe.ALIASED_FIELD:
      if (!f || !t.name) {
        s = null;
      } else {
        s = d ? getFieldDef(e, d, t.name) : null;
        f = s ? s.type : null;
      }
      break;

     case Oe.SELECTION_SET:
      d = i.getNamedType(f);
      break;

     case Oe.DIRECTIVE:
      a = t.name ? e.getDirective(t.name) : null;
      break;

     case Oe.INTERFACE_DEF:
      if (t.name) {
        c = null;
        v = new i.GraphQLInterfaceType({
          name: t.name,
          interfaces: [],
          fields: {}
        });
      }
      break;

     case Oe.OBJECT_TYPE_DEF:
      if (t.name) {
        v = null;
        c = new i.GraphQLObjectType({
          name: t.name,
          interfaces: [],
          fields: {}
        });
      }
      break;

     case Oe.ARGUMENTS:
      if (t.prevState) {
        switch (t.prevState.kind) {
         case Oe.FIELD:
          r = s && s.args;
          break;

         case Oe.DIRECTIVE:
          r = a && a.args;
          break;

         case Oe.ALIASED_FIELD:
          var g = null === (p = t.prevState) || void 0 === p ? void 0 : p.name;
          if (!g) {
            r = null;
            break;
          }
          var m = d ? getFieldDef(e, d, g) : null;
          if (!m) {
            r = null;
            break;
          }
          r = m.args;
          break;

         default:
          r = null;
        }
      } else {
        r = null;
      }
      break;

     case Oe.ARGUMENT:
      if (r) {
        for (var E = 0; E < r.length; E++) {
          if (r[E].name === t.name) {
            n = r[E];
            break;
          }
        }
      }
      u = null == n ? void 0 : n.type;
      break;

     case Oe.ENUM_VALUE:
      var T = i.getNamedType(u);
      o = T instanceof i.GraphQLEnumType ? T.getValues().find(e => e.value === t.name) : null;
      break;

     case Oe.LIST_VALUE:
      var y = i.getNullableType(u);
      u = y instanceof i.GraphQLList ? y.ofType : null;
      break;

     case Oe.OBJECT_VALUE:
      var I = i.getNamedType(u);
      l = I instanceof i.GraphQLInputObjectType ? I.getFields() : null;
      break;

     case Oe.OBJECT_FIELD:
      var h = t.name && l ? l[t.name] : null;
      u = null == h ? void 0 : h.type;
      break;

     case Oe.NAMED_TYPE:
      if (t.name) {
        f = e.getType(t.name);
      }
    }
  });
  return {
    argDef: n,
    argDefs: r,
    directiveDef: a,
    enumValue: o,
    fieldDef: s,
    inputType: u,
    objectFieldDefs: l,
    parentType: d,
    type: f,
    interfaceDef: v,
    objectTypeDef: c
  };
}

var Re;

!function(e) {
  e.TYPE_SYSTEM = "TYPE_SYSTEM";
  e.EXECUTABLE = "EXECUTABLE";
}(Re || (Re = {}));

function unwrapType(e) {
  if (e.prevState && e.kind && [ Oe.NAMED_TYPE, Oe.LIST_TYPE, Oe.TYPE, Oe.NON_NULL_TYPE ].includes(e.kind)) {
    return unwrapType(e.prevState);
  }
  return e;
}

function getHoverInformation(e, t, n, r, i) {
  var a = r || getTokenAtPosition(t, n);
  if (!e || !a || !a.state) {
    return "";
  }
  var {kind: o, step: s} = a.state;
  var u = getTypeInfo(e, a.state);
  var c = Object.assign(Object.assign({}, i), {
    schema: e
  });
  if ("Field" === o && 0 === s && u.fieldDef || "AliasedField" === o && 2 === s && u.fieldDef) {
    var l = [];
    renderMdCodeStart(l, c);
    !function renderField(e, t, n) {
      renderQualifiedField(e, t, n);
      renderTypeAnnotation(e, t, n, t.type);
    }(l, u, c);
    renderMdCodeEnd(l, c);
    renderDescription(l, c, u.fieldDef);
    return l.join("").trim();
  }
  if ("Directive" === o && 1 === s && u.directiveDef) {
    var d = [];
    renderMdCodeStart(d, c);
    renderDirective(d, u);
    renderMdCodeEnd(d, c);
    renderDescription(d, c, u.directiveDef);
    return d.join("").trim();
  }
  if ("Argument" === o && 0 === s && u.argDef) {
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
    }(f, u, c);
    renderMdCodeEnd(f, c);
    renderDescription(f, c, u.argDef);
    return f.join("").trim();
  }
  if ("EnumValue" === o && u.enumValue && "description" in u.enumValue) {
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
    }(v, u, c);
    renderMdCodeEnd(v, c);
    renderDescription(v, c, u.enumValue);
    return v.join("").trim();
  }
  if ("NamedType" === o && u.type && "description" in u.type) {
    var p = [];
    renderMdCodeStart(p, c);
    renderType(p, u, c, u.type);
    renderMdCodeEnd(p, c);
    renderDescription(p, c, u.type);
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
  if (r instanceof i.GraphQLNonNull) {
    renderType(e, t, n, r.ofType);
    text(e, "!");
  } else if (r instanceof i.GraphQLList) {
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

var getToken = (t, n) => {
  if (!e.ts.isTemplateLiteral(t) && !e.ts.isStringLiteralLike(t)) {
    return;
  }
  var r = t.getText().slice(1, -1).split("\n");
  var i = e.onlineParser();
  var a = i.startState();
  var o = t.getStart() + 1;
  var s = void 0;
  var u = void 0;
  for (var c = 0; c < r.length; c++) {
    if (s) {
      continue;
    }
    var l = o - 1;
    var d = new e.CharacterStream(r[c] + "\n");
    while (!d.eol()) {
      var f = i.token(d, a);
      var v = d.current();
      if (l + d.getStartOfToken() + 1 <= n && l + d.getCurrentPosition() >= n) {
        s = u ? u : {
          line: c,
          start: d.getStartOfToken() + 1,
          end: d.getCurrentPosition(),
          string: v,
          state: a,
          tokenKind: f
        };
        break;
      } else if ("on" === v) {
        u = {
          line: c,
          start: d.getStartOfToken() + 1,
          end: d.getCurrentPosition(),
          string: v,
          state: a,
          tokenKind: f
        };
      } else if ("." === v || ".." === v) {
        u = {
          line: c,
          start: d.getStartOfToken() + 1,
          end: d.getCurrentPosition(),
          string: v,
          state: a,
          tokenKind: f
        };
      } else {
        u = void 0;
      }
    }
    o += r[c].length + 1;
  }
  return s;
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
        var s = e[n - 1] === t[r - 1] ? 0 : 1;
        i[n][r] = Math.min(i[n - 1][r] + 1, i[n][r - 1] + 1, i[n - 1][r - 1] + s);
        if (n > 1 && r > 1 && e[n - 1] === t[r - 2] && e[n - 2] === t[r - 1]) {
          i[n][r] = Math.min(i[n][r], i[n - 2][r - 2] + s);
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

function getGraphQLCompletions(t, n, r, a) {
  var o = a.config.templateIsCallExpression ?? !0;
  var s = a.languageService.getProgram()?.getTypeChecker();
  var u = e.getSource(a, t);
  if (!u) {
    return;
  }
  var c = e.findNode(u, n);
  if (!c) {
    return;
  }
  c = o ? e.bubbleUpCallExpression(c) : e.bubbleUpTemplate(c);
  var l, d, f;
  if (o && e.isGraphQLCall(c, s)) {
    var v = e.getSchemaName(c, s);
    f = v && r.multi[v] ? r.multi[v]?.schema : r.current?.schema;
    var p = getToken(c.arguments[0], n);
    if (!f || !p || "." === p.string || ".." === p.string) {
      return;
    }
    l = `${c.arguments[0].getText().slice(1, -1)}\n${e.getAllFragments(c, a).map(t => e.print(t)).join("\n")}`;
    d = new Cursor(p.line, p.start - 1);
  } else if (!o && e.isGraphQLTag(c)) {
    var g = getToken(c.template, n);
    if (!g || !r.current || "." === g.string || ".." === g.string) {
      return;
    }
    var {combinedText: m, resolvedSpans: E} = e.resolveTemplate(c, t, a);
    var T = E.filter(e => e.original.start < n && e.original.start + e.original.length < n).reduce((e, t) => e + (t.lines - 1), 0);
    g.line = g.line + T;
    l = m;
    d = new Cursor(g.line, g.start - 1);
    f = r.current.schema;
  } else {
    return;
  }
  var [y, I] = function getSuggestionsInternal(e, t, n) {
    var r = getTokenAtPosition(t, n);
    var a = [];
    try {
      a = i.parse(t, {
        noLocation: !0
      }).definitions.filter(e => e.kind === i.Kind.FRAGMENT_DEFINITION);
    } catch (e) {}
    var o = "on" === r.string && "TypeCondition" === r.state.kind;
    var s = getAutocompleteSuggestions(e, t, n, o ? {
      ...r,
      state: {
        ...r.state,
        step: 1
      },
      type: null
    } : void 0);
    var u = !o ? function getSuggestionsForFragmentSpread(e, t, n, r, a) {
      if (!r) {
        return [];
      }
      var o = n.getTypeMap();
      var s = getDefinitionState(e.state);
      return hintList(e, a.filter(e => o[e.typeCondition.name.value] && !(s && s.kind === Oe.FRAGMENT_DEFINITION && s.name === e.name.value) && i.isCompositeType(t.parentType) && i.isCompositeType(o[e.typeCondition.name.value]) && i.doTypesOverlap(n, t.parentType, o[e.typeCondition.name.value])).map(e => ({
        label: e.name.value,
        detail: String(o[e.typeCondition.name.value]),
        documentation: `fragment ${e.name.value} on ${e.typeCondition.name.value}`,
        kind: Ce.Field,
        type: o[e.typeCondition.name.value]
      })));
    }(r, getTypeInfo(e, r.state), e, t, a) : [];
    var c = "Invalid" === r.state.kind ? r.state.prevState : r.state;
    var l = getParentDefinition(r.state, Oe.FIELD)?.name;
    if (c && l) {
      var {kind: d} = c;
      if (d === Oe.ARGUMENTS || d === Oe.ARGUMENT) {
        var f = new Set;
        runOnlineParser(t, (e, t) => {
          if (t.kind === Oe.ARGUMENT) {
            var n = getParentDefinition(t, Oe.FIELD);
            if (l && t.name && n?.name === l) {
              f.add(t.name);
            }
          }
        });
        s = s.filter(e => !f.has(e.label));
      }
      if (d === Oe.SELECTION_SET || d === Oe.FIELD || d === Oe.ALIASED_FIELD) {
        var v = new Set;
        var p = getUsedFragments(t, l);
        runOnlineParser(t, (e, t) => {
          if (t.kind === Oe.FIELD || t.kind === Oe.ALIASED_FIELD) {
            var n = getParentDefinition(t, Oe.FIELD);
            if (n && n.name === l && t.name) {
              v.add(t.name);
            }
          }
        });
        s = s.filter(e => !v.has(e.label));
        u = u.filter(e => !p.has(e.label));
      }
      if (d === Oe.FRAGMENT_SPREAD) {
        var g = getUsedFragments(t, l);
        s = s.filter(e => !g.has(e.label));
        u = u.filter(e => !g.has(e.label));
      }
    }
    return [ s, u ];
  }(f, l, d);
  return {
    isGlobalCompletion: !1,
    isMemberCompletion: !1,
    isNewIdentifierLocation: !1,
    entries: [ ...y.map(t => ({
      ...t,
      kind: e.ts.ScriptElementKind.variableElement,
      name: t.label,
      kindModifiers: "declare",
      sortText: t.sortText || "0",
      labelDetails: {
        detail: t.type ? " " + t.type?.toString() : void 0,
        description: t.documentation
      }
    })), ...I.map(t => ({
      ...t,
      kind: e.ts.ScriptElementKind.variableElement,
      name: t.label,
      insertText: "..." + t.label,
      kindModifiers: "declare",
      sortText: "0",
      labelDetails: {
        description: t.documentation
      }
    })) ]
  };
}

function getUsedFragments(e, t) {
  var n = new Set;
  runOnlineParser(e, (e, r) => {
    if (r.kind === Oe.FRAGMENT_SPREAD && r.name) {
      var i = getParentDefinition(r, Oe.FIELD);
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

function runOnlineParser(t, n) {
  var r = t.split("\n");
  var i = e.onlineParser();
  var a = i.startState();
  var o = "";
  var s = new e.CharacterStream("");
  for (var u = 0; u < r.length; u++) {
    s = new e.CharacterStream(r[u]);
    while (!s.eol()) {
      if ("BREAK" === n(s, a, o = i.token(s, a), u)) {
        break;
      }
    }
    n(s, a, o, u);
    if (!a.kind) {
      a = i.startState();
    }
  }
  return {
    start: s.getStartOfToken(),
    end: s.getCurrentPosition(),
    string: s.current(),
    state: a,
    style: o
  };
}

function create(t) {
  var logger = e => t.project.projectService.logger.info(`[GraphQLSP] ${e}`);
  var i = t.config;
  logger("config: " + JSON.stringify(i));
  if (!i.schema && !i.schemas) {
    logger('Missing "schema" option in configuration.');
    throw new Error("Please provide a GraphQL Schema!");
  }
  logger("Setting up the GraphQL Plugin");
  if (i.template) {
    e.templates.add(i.template);
  }
  var a = function createBasicDecorator(e) {
    var t = Object.create(null);
    var _loop = function() {
      var r = e.languageService[n];
      t[n] = (...t) => r.apply(e.languageService, t);
    };
    for (var n of Object.keys(e.languageService)) {
      _loop();
    }
    return t;
  }(t);
  var o = ((e, t, i) => {
    var a = r.loadRef(t);
    (async () => {
      var o = await r.resolveTypeScriptRootDir(e.project.getProjectName()) || n.dirname(e.project.getProjectName());
      var s = e.config.tadaDisablePreprocessing ?? !1;
      var u = e.config.tadaOutputLocation && n.resolve(o, e.config.tadaOutputLocation);
      i("Got root-directory to resolve schema from: " + o);
      i('Resolving schema from "schema" config: ' + JSON.stringify(t));
      try {
        i("Loading schema...");
        await a.load({
          rootPath: o
        });
      } catch (e) {
        i(`Failed to load schema: ${e}`);
      }
      if (a.current) {
        if (a.current && void 0 !== a.current.tadaOutputLocation) {
          saveTadaIntrospection(a.current.introspection, u, s, i);
        }
      } else if (a.multi) {
        Object.values(a.multi).forEach(e => {
          if (!e) {
            return;
          }
          if (e.tadaOutputLocation) {
            saveTadaIntrospection(e.introspection, n.resolve(o, e.tadaOutputLocation), s, i);
          }
        });
      }
      a.autoupdate({
        rootPath: o
      }, (e, t) => {
        if (!t) {
          return;
        }
        if (t.tadaOutputLocation) {
          var r = e.multi ? e.multi[t.name] : e.current;
          if (!r) {
            return;
          }
          saveTadaIntrospection(r.introspection, n.resolve(o, t.tadaOutputLocation), s, i);
        }
      });
    })();
    return a;
  })(t, i, logger);
  a.getSemanticDiagnostics = n => {
    var r = t.languageService.getSemanticDiagnostics(n);
    if (r.some(t => e.ALL_DIAGNOSTICS.includes(t.code))) {
      return r;
    }
    var i = e.getGraphQLDiagnostics(n, o, t);
    return i ? [ ...i, ...r ] : r;
  };
  a.getCompletionsAtPosition = (e, n, r) => {
    var i = getGraphQLCompletions(e, n, o, t);
    if (i && i.entries.length) {
      return i;
    } else {
      return t.languageService.getCompletionsAtPosition(e, n, r) || {
        isGlobalCompletion: !1,
        isMemberCompletion: !1,
        isNewIdentifierLocation: !1,
        entries: []
      };
    }
  };
  a.getEditsForRefactor = (n, r, i, a, o, s, u) => {
    var c = t.languageService.getEditsForRefactor(n, r, i, a, o, s, u);
    var l = e.getPersistedCodeFixAtPosition(n, "number" == typeof i ? i : i.pos, t);
    if (!l) {
      return c;
    }
    return {
      edits: [ {
        fileName: n,
        textChanges: [ {
          newText: l.replacement,
          span: l.span
        } ]
      } ]
    };
  };
  a.getApplicableRefactors = (n, r, i, a, o, s) => {
    var u = t.languageService.getApplicableRefactors(n, r, i, a, o, s);
    if (e.getPersistedCodeFixAtPosition(n, "number" == typeof r ? r : r.pos, t)) {
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
  a.getQuickInfoAtPosition = (n, r) => {
    var i = function getGraphQLQuickInfo(t, n, r, i) {
      var a = i.config.templateIsCallExpression ?? !0;
      var o = i.languageService.getProgram()?.getTypeChecker();
      var s = e.getSource(i, t);
      if (!s) {
        return;
      }
      var u = e.findNode(s, n);
      if (!u) {
        return;
      }
      u = a ? e.bubbleUpCallExpression(u) : e.bubbleUpTemplate(u);
      var c, l, d;
      if (a && e.isGraphQLCall(u, o)) {
        var f = i.languageService.getProgram()?.getTypeChecker();
        var v = e.getSchemaName(u, f);
        d = v && r.multi[v] ? r.multi[v]?.schema : r.current?.schema;
        var p = getToken(u.arguments[0], n);
        if (!d || !p) {
          return;
        }
        l = u.arguments[0].getText();
        c = new Cursor(p.line, p.start - 1);
      } else if (!a && e.isGraphQLTag(u)) {
        var g = getToken(u.template, n);
        if (!g || !r.current) {
          return;
        }
        var {combinedText: m, resolvedSpans: E} = e.resolveTemplate(u, t, i);
        var T = E.filter(e => e.original.start < n && e.original.start + e.original.length < n).reduce((e, t) => e + (t.lines - 1), 0);
        g.line = g.line + T;
        l = m;
        c = new Cursor(g.line, g.start - 1);
        d = r.current.schema;
      } else {
        return;
      }
      var y = getHoverInformation(d, l, c);
      return {
        kind: e.ts.ScriptElementKind.label,
        textSpan: {
          start: n,
          length: 1
        },
        kindModifiers: "text",
        documentation: Array.isArray(y) ? y.map(e => ({
          kind: "text",
          text: e
        })) : [ {
          kind: "text",
          text: y
        } ]
      };
    }(n, r, o, t);
    if (i) {
      return i;
    }
    return t.languageService.getQuickInfoAtPosition(n, r);
  };
  logger("proxy: " + JSON.stringify(a));
  return a;
}

module.exports = t => {
  e.init(t);
  return {
    create
  };
};
//# sourceMappingURL=graphqlsp.js.map
