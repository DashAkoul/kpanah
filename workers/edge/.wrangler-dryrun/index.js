var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// ../../node_modules/unenv/dist/runtime/_internal/utils.mjs
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
var init_utils = __esm({
  "../../node_modules/unenv/dist/runtime/_internal/utils.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    __name(createNotImplementedError, "createNotImplementedError");
    __name(notImplemented, "notImplemented");
    __name(notImplementedClass, "notImplementedClass");
  }
});

// ../../node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin, _performanceNow, nodeTiming, PerformanceEntry, PerformanceMark, PerformanceMeasure, PerformanceResourceTiming, PerformanceObserverEntryList, Performance, PerformanceObserver, performance;
var init_performance = __esm({
  "../../node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_utils();
    _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
    _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
    nodeTiming = {
      name: "node",
      entryType: "node",
      startTime: 0,
      duration: 0,
      nodeStart: 0,
      v8Start: 0,
      bootstrapComplete: 0,
      environment: 0,
      loopStart: 0,
      loopExit: 0,
      idleTime: 0,
      uvMetricsInfo: {
        loopCount: 0,
        events: 0,
        eventsWaiting: 0
      },
      detail: void 0,
      toJSON() {
        return this;
      }
    };
    PerformanceEntry = class {
      __unenv__ = true;
      detail;
      entryType = "event";
      name;
      startTime;
      constructor(name, options) {
        this.name = name;
        this.startTime = options?.startTime || _performanceNow();
        this.detail = options?.detail;
      }
      get duration() {
        return _performanceNow() - this.startTime;
      }
      toJSON() {
        return {
          name: this.name,
          entryType: this.entryType,
          startTime: this.startTime,
          duration: this.duration,
          detail: this.detail
        };
      }
    };
    __name(PerformanceEntry, "PerformanceEntry");
    PerformanceMark = /* @__PURE__ */ __name(class PerformanceMark2 extends PerformanceEntry {
      entryType = "mark";
      constructor() {
        super(...arguments);
      }
      get duration() {
        return 0;
      }
    }, "PerformanceMark");
    PerformanceMeasure = class extends PerformanceEntry {
      entryType = "measure";
    };
    __name(PerformanceMeasure, "PerformanceMeasure");
    PerformanceResourceTiming = class extends PerformanceEntry {
      entryType = "resource";
      serverTiming = [];
      connectEnd = 0;
      connectStart = 0;
      decodedBodySize = 0;
      domainLookupEnd = 0;
      domainLookupStart = 0;
      encodedBodySize = 0;
      fetchStart = 0;
      initiatorType = "";
      name = "";
      nextHopProtocol = "";
      redirectEnd = 0;
      redirectStart = 0;
      requestStart = 0;
      responseEnd = 0;
      responseStart = 0;
      secureConnectionStart = 0;
      startTime = 0;
      transferSize = 0;
      workerStart = 0;
      responseStatus = 0;
    };
    __name(PerformanceResourceTiming, "PerformanceResourceTiming");
    PerformanceObserverEntryList = class {
      __unenv__ = true;
      getEntries() {
        return [];
      }
      getEntriesByName(_name, _type) {
        return [];
      }
      getEntriesByType(type) {
        return [];
      }
    };
    __name(PerformanceObserverEntryList, "PerformanceObserverEntryList");
    Performance = class {
      __unenv__ = true;
      timeOrigin = _timeOrigin;
      eventCounts = /* @__PURE__ */ new Map();
      _entries = [];
      _resourceTimingBufferSize = 0;
      navigation = void 0;
      timing = void 0;
      timerify(_fn, _options) {
        throw createNotImplementedError("Performance.timerify");
      }
      get nodeTiming() {
        return nodeTiming;
      }
      eventLoopUtilization() {
        return {};
      }
      markResourceTiming() {
        return new PerformanceResourceTiming("");
      }
      onresourcetimingbufferfull = null;
      now() {
        if (this.timeOrigin === _timeOrigin) {
          return _performanceNow();
        }
        return Date.now() - this.timeOrigin;
      }
      clearMarks(markName) {
        this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
      }
      clearMeasures(measureName) {
        this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
      }
      clearResourceTimings() {
        this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
      }
      getEntries() {
        return this._entries;
      }
      getEntriesByName(name, type) {
        return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
      }
      getEntriesByType(type) {
        return this._entries.filter((e) => e.entryType === type);
      }
      mark(name, options) {
        const entry = new PerformanceMark(name, options);
        this._entries.push(entry);
        return entry;
      }
      measure(measureName, startOrMeasureOptions, endMark) {
        let start;
        let end;
        if (typeof startOrMeasureOptions === "string") {
          start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
          end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
        } else {
          start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
          end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
        }
        const entry = new PerformanceMeasure(measureName, {
          startTime: start,
          detail: {
            start,
            end
          }
        });
        this._entries.push(entry);
        return entry;
      }
      setResourceTimingBufferSize(maxSize) {
        this._resourceTimingBufferSize = maxSize;
      }
      addEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.addEventListener");
      }
      removeEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.removeEventListener");
      }
      dispatchEvent(event) {
        throw createNotImplementedError("Performance.dispatchEvent");
      }
      toJSON() {
        return this;
      }
    };
    __name(Performance, "Performance");
    PerformanceObserver = class {
      __unenv__ = true;
      _callback = null;
      constructor(callback) {
        this._callback = callback;
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        throw createNotImplementedError("PerformanceObserver.disconnect");
      }
      observe(options) {
        throw createNotImplementedError("PerformanceObserver.observe");
      }
      bind(fn) {
        return fn;
      }
      runInAsyncScope(fn, thisArg, ...args) {
        return fn.call(thisArg, ...args);
      }
      asyncId() {
        return 0;
      }
      triggerAsyncId() {
        return 0;
      }
      emitDestroy() {
        return this;
      }
    };
    __name(PerformanceObserver, "PerformanceObserver");
    __publicField(PerformanceObserver, "supportedEntryTypes", []);
    performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();
  }
});

// ../../node_modules/unenv/dist/runtime/node/perf_hooks.mjs
var init_perf_hooks = __esm({
  "../../node_modules/unenv/dist/runtime/node/perf_hooks.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_performance();
  }
});

// ../../node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
var init_performance2 = __esm({
  "../../node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs"() {
    init_perf_hooks();
    globalThis.performance = performance;
    globalThis.Performance = Performance;
    globalThis.PerformanceEntry = PerformanceEntry;
    globalThis.PerformanceMark = PerformanceMark;
    globalThis.PerformanceMeasure = PerformanceMeasure;
    globalThis.PerformanceObserver = PerformanceObserver;
    globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
    globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
  }
});

// ../../node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default;
var init_noop = __esm({
  "../../node_modules/unenv/dist/runtime/mock/noop.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    noop_default = Object.assign(() => {
    }, { __unenv__: true });
  }
});

// ../../node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";
var _console, _ignoreErrors, _stderr, _stdout, log, info, trace, debug, table, error, warn, createTask, clear, count, countReset, dir, dirxml, group, groupEnd, groupCollapsed, profile, profileEnd, time, timeEnd, timeLog, timeStamp, Console, _times, _stdoutErrorHandler, _stderrErrorHandler;
var init_console = __esm({
  "../../node_modules/unenv/dist/runtime/node/console.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_noop();
    init_utils();
    _console = globalThis.console;
    _ignoreErrors = true;
    _stderr = new Writable();
    _stdout = new Writable();
    log = _console?.log ?? noop_default;
    info = _console?.info ?? log;
    trace = _console?.trace ?? info;
    debug = _console?.debug ?? log;
    table = _console?.table ?? log;
    error = _console?.error ?? log;
    warn = _console?.warn ?? error;
    createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
    clear = _console?.clear ?? noop_default;
    count = _console?.count ?? noop_default;
    countReset = _console?.countReset ?? noop_default;
    dir = _console?.dir ?? noop_default;
    dirxml = _console?.dirxml ?? noop_default;
    group = _console?.group ?? noop_default;
    groupEnd = _console?.groupEnd ?? noop_default;
    groupCollapsed = _console?.groupCollapsed ?? noop_default;
    profile = _console?.profile ?? noop_default;
    profileEnd = _console?.profileEnd ?? noop_default;
    time = _console?.time ?? noop_default;
    timeEnd = _console?.timeEnd ?? noop_default;
    timeLog = _console?.timeLog ?? noop_default;
    timeStamp = _console?.timeStamp ?? noop_default;
    Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
    _times = /* @__PURE__ */ new Map();
    _stdoutErrorHandler = noop_default;
    _stderrErrorHandler = noop_default;
  }
});

// ../../node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole, assert, clear2, context, count2, countReset2, createTask2, debug2, dir2, dirxml2, error2, group2, groupCollapsed2, groupEnd2, info2, log2, profile2, profileEnd2, table2, time2, timeEnd2, timeLog2, timeStamp2, trace2, warn2, console_default;
var init_console2 = __esm({
  "../../node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_console();
    workerdConsole = globalThis["console"];
    ({
      assert,
      clear: clear2,
      context: (
        // @ts-expect-error undocumented public API
        context
      ),
      count: count2,
      countReset: countReset2,
      createTask: (
        // @ts-expect-error undocumented public API
        createTask2
      ),
      debug: debug2,
      dir: dir2,
      dirxml: dirxml2,
      error: error2,
      group: group2,
      groupCollapsed: groupCollapsed2,
      groupEnd: groupEnd2,
      info: info2,
      log: log2,
      profile: profile2,
      profileEnd: profileEnd2,
      table: table2,
      time: time2,
      timeEnd: timeEnd2,
      timeLog: timeLog2,
      timeStamp: timeStamp2,
      trace: trace2,
      warn: warn2
    } = workerdConsole);
    Object.assign(workerdConsole, {
      Console,
      _ignoreErrors,
      _stderr,
      _stderrErrorHandler,
      _stdout,
      _stdoutErrorHandler,
      _times
    });
    console_default = workerdConsole;
  }
});

// ../../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console = __esm({
  "../../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console"() {
    init_console2();
    globalThis.console = console_default;
  }
});

// ../../node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime;
var init_hrtime = __esm({
  "../../node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
      const now = Date.now();
      const seconds = Math.trunc(now / 1e3);
      const nanos = now % 1e3 * 1e6;
      if (startTime) {
        let diffSeconds = seconds - startTime[0];
        let diffNanos = nanos - startTime[0];
        if (diffNanos < 0) {
          diffSeconds = diffSeconds - 1;
          diffNanos = 1e9 + diffNanos;
        }
        return [diffSeconds, diffNanos];
      }
      return [seconds, nanos];
    }, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
      return BigInt(Date.now() * 1e6);
    }, "bigint") });
  }
});

// ../../node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
import { Socket } from "node:net";
var ReadStream;
var init_read_stream = __esm({
  "../../node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    ReadStream = class extends Socket {
      fd;
      constructor(fd) {
        super();
        this.fd = fd;
      }
      isRaw = false;
      setRawMode(mode) {
        this.isRaw = mode;
        return this;
      }
      isTTY = false;
    };
    __name(ReadStream, "ReadStream");
  }
});

// ../../node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
import { Socket as Socket2 } from "node:net";
var WriteStream;
var init_write_stream = __esm({
  "../../node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    WriteStream = class extends Socket2 {
      fd;
      constructor(fd) {
        super();
        this.fd = fd;
      }
      clearLine(dir3, callback) {
        callback && callback();
        return false;
      }
      clearScreenDown(callback) {
        callback && callback();
        return false;
      }
      cursorTo(x, y, callback) {
        callback && typeof callback === "function" && callback();
        return false;
      }
      moveCursor(dx, dy, callback) {
        callback && callback();
        return false;
      }
      getColorDepth(env2) {
        return 1;
      }
      hasColors(count3, env2) {
        return false;
      }
      getWindowSize() {
        return [this.columns, this.rows];
      }
      columns = 80;
      rows = 24;
      isTTY = false;
    };
    __name(WriteStream, "WriteStream");
  }
});

// ../../node_modules/unenv/dist/runtime/node/tty.mjs
var init_tty = __esm({
  "../../node_modules/unenv/dist/runtime/node/tty.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_read_stream();
    init_write_stream();
  }
});

// ../../node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";
var Process;
var init_process = __esm({
  "../../node_modules/unenv/dist/runtime/node/internal/process/process.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_tty();
    init_utils();
    Process = class extends EventEmitter {
      env;
      hrtime;
      nextTick;
      constructor(impl) {
        super();
        this.env = impl.env;
        this.hrtime = impl.hrtime;
        this.nextTick = impl.nextTick;
        for (const prop of [...Object.getOwnPropertyNames(Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
          const value = this[prop];
          if (typeof value === "function") {
            this[prop] = value.bind(this);
          }
        }
      }
      emitWarning(warning, type, code) {
        console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
      }
      emit(...args) {
        return super.emit(...args);
      }
      listeners(eventName) {
        return super.listeners(eventName);
      }
      #stdin;
      #stdout;
      #stderr;
      get stdin() {
        return this.#stdin ??= new ReadStream(0);
      }
      get stdout() {
        return this.#stdout ??= new WriteStream(1);
      }
      get stderr() {
        return this.#stderr ??= new WriteStream(2);
      }
      #cwd = "/";
      chdir(cwd2) {
        this.#cwd = cwd2;
      }
      cwd() {
        return this.#cwd;
      }
      arch = "";
      platform = "";
      argv = [];
      argv0 = "";
      execArgv = [];
      execPath = "";
      title = "";
      pid = 200;
      ppid = 100;
      get version() {
        return "";
      }
      get versions() {
        return {};
      }
      get allowedNodeEnvironmentFlags() {
        return /* @__PURE__ */ new Set();
      }
      get sourceMapsEnabled() {
        return false;
      }
      get debugPort() {
        return 0;
      }
      get throwDeprecation() {
        return false;
      }
      get traceDeprecation() {
        return false;
      }
      get features() {
        return {};
      }
      get release() {
        return {};
      }
      get connected() {
        return false;
      }
      get config() {
        return {};
      }
      get moduleLoadList() {
        return [];
      }
      constrainedMemory() {
        return 0;
      }
      availableMemory() {
        return 0;
      }
      uptime() {
        return 0;
      }
      resourceUsage() {
        return {};
      }
      ref() {
      }
      unref() {
      }
      umask() {
        throw createNotImplementedError("process.umask");
      }
      getBuiltinModule() {
        return void 0;
      }
      getActiveResourcesInfo() {
        throw createNotImplementedError("process.getActiveResourcesInfo");
      }
      exit() {
        throw createNotImplementedError("process.exit");
      }
      reallyExit() {
        throw createNotImplementedError("process.reallyExit");
      }
      kill() {
        throw createNotImplementedError("process.kill");
      }
      abort() {
        throw createNotImplementedError("process.abort");
      }
      dlopen() {
        throw createNotImplementedError("process.dlopen");
      }
      setSourceMapsEnabled() {
        throw createNotImplementedError("process.setSourceMapsEnabled");
      }
      loadEnvFile() {
        throw createNotImplementedError("process.loadEnvFile");
      }
      disconnect() {
        throw createNotImplementedError("process.disconnect");
      }
      cpuUsage() {
        throw createNotImplementedError("process.cpuUsage");
      }
      setUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
      }
      hasUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
      }
      initgroups() {
        throw createNotImplementedError("process.initgroups");
      }
      openStdin() {
        throw createNotImplementedError("process.openStdin");
      }
      assert() {
        throw createNotImplementedError("process.assert");
      }
      binding() {
        throw createNotImplementedError("process.binding");
      }
      permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
      report = {
        directory: "",
        filename: "",
        signal: "SIGUSR2",
        compact: false,
        reportOnFatalError: false,
        reportOnSignal: false,
        reportOnUncaughtException: false,
        getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
        writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
      };
      finalization = {
        register: /* @__PURE__ */ notImplemented("process.finalization.register"),
        unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
        registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
      };
      memoryUsage = Object.assign(() => ({
        arrayBuffers: 0,
        rss: 0,
        external: 0,
        heapTotal: 0,
        heapUsed: 0
      }), { rss: () => 0 });
      mainModule = void 0;
      domain = void 0;
      send = void 0;
      exitCode = void 0;
      channel = void 0;
      getegid = void 0;
      geteuid = void 0;
      getgid = void 0;
      getgroups = void 0;
      getuid = void 0;
      setegid = void 0;
      seteuid = void 0;
      setgid = void 0;
      setgroups = void 0;
      setuid = void 0;
      _events = void 0;
      _eventsCount = void 0;
      _exiting = void 0;
      _maxListeners = void 0;
      _debugEnd = void 0;
      _debugProcess = void 0;
      _fatalException = void 0;
      _getActiveHandles = void 0;
      _getActiveRequests = void 0;
      _kill = void 0;
      _preload_modules = void 0;
      _rawDebug = void 0;
      _startProfilerIdleNotifier = void 0;
      _stopProfilerIdleNotifier = void 0;
      _tickCallback = void 0;
      _disconnect = void 0;
      _handleQueue = void 0;
      _pendingMessage = void 0;
      _channel = void 0;
      _send = void 0;
      _linkedBinding = void 0;
    };
    __name(Process, "Process");
  }
});

// ../../node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess, getBuiltinModule, exit, platform, nextTick, unenvProcess, abort, addListener, allowedNodeEnvironmentFlags, hasUncaughtExceptionCaptureCallback, setUncaughtExceptionCaptureCallback, loadEnvFile, sourceMapsEnabled, arch, argv, argv0, chdir, config, connected, constrainedMemory, availableMemory, cpuUsage, cwd, debugPort, dlopen, disconnect, emit, emitWarning, env, eventNames, execArgv, execPath, finalization, features, getActiveResourcesInfo, getMaxListeners, hrtime3, kill, listeners, listenerCount, memoryUsage, on, off, once, pid, ppid, prependListener, prependOnceListener, rawListeners, release, removeAllListeners, removeListener, report, resourceUsage, setMaxListeners, setSourceMapsEnabled, stderr, stdin, stdout, title, throwDeprecation, traceDeprecation, umask, uptime, version, versions, domain, initgroups, moduleLoadList, reallyExit, openStdin, assert2, binding, send, exitCode, channel, getegid, geteuid, getgid, getgroups, getuid, setegid, seteuid, setgid, setgroups, setuid, permission, mainModule, _events, _eventsCount, _exiting, _maxListeners, _debugEnd, _debugProcess, _fatalException, _getActiveHandles, _getActiveRequests, _kill, _preload_modules, _rawDebug, _startProfilerIdleNotifier, _stopProfilerIdleNotifier, _tickCallback, _disconnect, _handleQueue, _pendingMessage, _channel, _send, _linkedBinding, _process, process_default;
var init_process2 = __esm({
  "../../node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_hrtime();
    init_process();
    globalProcess = globalThis["process"];
    getBuiltinModule = globalProcess.getBuiltinModule;
    ({ exit, platform, nextTick } = getBuiltinModule(
      "node:process"
    ));
    unenvProcess = new Process({
      env: globalProcess.env,
      hrtime,
      nextTick
    });
    ({
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      finalization,
      features,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      on,
      off,
      once,
      pid,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert: assert2,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    } = unenvProcess);
    _process = {
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exit,
      finalization,
      features,
      getBuiltinModule,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      nextTick,
      on,
      off,
      once,
      pid,
      platform,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      // @ts-expect-error old API
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert: assert2,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    };
    process_default = _process;
  }
});

// ../../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process = __esm({
  "../../node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process"() {
    init_process2();
    globalThis.process = process_default;
  }
});

// ../../packages/shared/src/types/index.ts
var init_types = __esm({
  "../../packages/shared/src/types/index.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
  }
});

// ../../node_modules/zod/v3/helpers/util.js
var util, objectUtil, ZodParsedType, getParsedType;
var init_util = __esm({
  "../../node_modules/zod/v3/helpers/util.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    (function(util2) {
      util2.assertEqual = (_) => {
      };
      function assertIs(_arg) {
      }
      __name(assertIs, "assertIs");
      util2.assertIs = assertIs;
      function assertNever(_x) {
        throw new Error();
      }
      __name(assertNever, "assertNever");
      util2.assertNever = assertNever;
      util2.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
          obj[item] = item;
        }
        return obj;
      };
      util2.getValidEnumValues = (obj) => {
        const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
          filtered[k] = obj[k];
        }
        return util2.objectValues(filtered);
      };
      util2.objectValues = (obj) => {
        return util2.objectKeys(obj).map(function(e) {
          return obj[e];
        });
      };
      util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
        const keys = [];
        for (const key in object) {
          if (Object.prototype.hasOwnProperty.call(object, key)) {
            keys.push(key);
          }
        }
        return keys;
      };
      util2.find = (arr, checker) => {
        for (const item of arr) {
          if (checker(item))
            return item;
        }
        return void 0;
      };
      util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
      function joinValues(array, separator = " | ") {
        return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
      }
      __name(joinValues, "joinValues");
      util2.joinValues = joinValues;
      util2.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      };
    })(util || (util = {}));
    (function(objectUtil2) {
      objectUtil2.mergeShapes = (first, second) => {
        return {
          ...first,
          ...second
          // second overwrites first
        };
      };
    })(objectUtil || (objectUtil = {}));
    ZodParsedType = util.arrayToEnum([
      "string",
      "nan",
      "number",
      "integer",
      "float",
      "boolean",
      "date",
      "bigint",
      "symbol",
      "function",
      "undefined",
      "null",
      "array",
      "object",
      "unknown",
      "promise",
      "void",
      "never",
      "map",
      "set"
    ]);
    getParsedType = /* @__PURE__ */ __name((data) => {
      const t = typeof data;
      switch (t) {
        case "undefined":
          return ZodParsedType.undefined;
        case "string":
          return ZodParsedType.string;
        case "number":
          return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
          return ZodParsedType.boolean;
        case "function":
          return ZodParsedType.function;
        case "bigint":
          return ZodParsedType.bigint;
        case "symbol":
          return ZodParsedType.symbol;
        case "object":
          if (Array.isArray(data)) {
            return ZodParsedType.array;
          }
          if (data === null) {
            return ZodParsedType.null;
          }
          if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
            return ZodParsedType.promise;
          }
          if (typeof Map !== "undefined" && data instanceof Map) {
            return ZodParsedType.map;
          }
          if (typeof Set !== "undefined" && data instanceof Set) {
            return ZodParsedType.set;
          }
          if (typeof Date !== "undefined" && data instanceof Date) {
            return ZodParsedType.date;
          }
          return ZodParsedType.object;
        default:
          return ZodParsedType.unknown;
      }
    }, "getParsedType");
  }
});

// ../../node_modules/zod/v3/ZodError.js
var ZodIssueCode, quotelessJson, ZodError;
var init_ZodError = __esm({
  "../../node_modules/zod/v3/ZodError.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_util();
    ZodIssueCode = util.arrayToEnum([
      "invalid_type",
      "invalid_literal",
      "custom",
      "invalid_union",
      "invalid_union_discriminator",
      "invalid_enum_value",
      "unrecognized_keys",
      "invalid_arguments",
      "invalid_return_type",
      "invalid_date",
      "invalid_string",
      "too_small",
      "too_big",
      "invalid_intersection_types",
      "not_multiple_of",
      "not_finite"
    ]);
    quotelessJson = /* @__PURE__ */ __name((obj) => {
      const json = JSON.stringify(obj, null, 2);
      return json.replace(/"([^"]+)":/g, "$1:");
    }, "quotelessJson");
    ZodError = class extends Error {
      get errors() {
        return this.issues;
      }
      constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
          this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
          this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(this, actualProto);
        } else {
          this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
      }
      format(_mapper) {
        const mapper = _mapper || function(issue) {
          return issue.message;
        };
        const fieldErrors = { _errors: [] };
        const processError = /* @__PURE__ */ __name((error3) => {
          for (const issue of error3.issues) {
            if (issue.code === "invalid_union") {
              issue.unionErrors.map(processError);
            } else if (issue.code === "invalid_return_type") {
              processError(issue.returnTypeError);
            } else if (issue.code === "invalid_arguments") {
              processError(issue.argumentsError);
            } else if (issue.path.length === 0) {
              fieldErrors._errors.push(mapper(issue));
            } else {
              let curr = fieldErrors;
              let i = 0;
              while (i < issue.path.length) {
                const el = issue.path[i];
                const terminal = i === issue.path.length - 1;
                if (!terminal) {
                  curr[el] = curr[el] || { _errors: [] };
                } else {
                  curr[el] = curr[el] || { _errors: [] };
                  curr[el]._errors.push(mapper(issue));
                }
                curr = curr[el];
                i++;
              }
            }
          }
        }, "processError");
        processError(this);
        return fieldErrors;
      }
      static assert(value) {
        if (!(value instanceof ZodError)) {
          throw new Error(`Not a ZodError: ${value}`);
        }
      }
      toString() {
        return this.message;
      }
      get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
      }
      get isEmpty() {
        return this.issues.length === 0;
      }
      flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
          if (sub.path.length > 0) {
            const firstEl = sub.path[0];
            fieldErrors[firstEl] = fieldErrors[firstEl] || [];
            fieldErrors[firstEl].push(mapper(sub));
          } else {
            formErrors.push(mapper(sub));
          }
        }
        return { formErrors, fieldErrors };
      }
      get formErrors() {
        return this.flatten();
      }
    };
    __name(ZodError, "ZodError");
    ZodError.create = (issues) => {
      const error3 = new ZodError(issues);
      return error3;
    };
  }
});

// ../../node_modules/zod/v3/locales/en.js
var errorMap, en_default;
var init_en = __esm({
  "../../node_modules/zod/v3/locales/en.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_ZodError();
    init_util();
    errorMap = /* @__PURE__ */ __name((issue, _ctx) => {
      let message;
      switch (issue.code) {
        case ZodIssueCode.invalid_type:
          if (issue.received === ZodParsedType.undefined) {
            message = "Required";
          } else {
            message = `Expected ${issue.expected}, received ${issue.received}`;
          }
          break;
        case ZodIssueCode.invalid_literal:
          message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
          break;
        case ZodIssueCode.unrecognized_keys:
          message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
          break;
        case ZodIssueCode.invalid_union:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_union_discriminator:
          message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
          break;
        case ZodIssueCode.invalid_enum_value:
          message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
          break;
        case ZodIssueCode.invalid_arguments:
          message = `Invalid function arguments`;
          break;
        case ZodIssueCode.invalid_return_type:
          message = `Invalid function return type`;
          break;
        case ZodIssueCode.invalid_date:
          message = `Invalid date`;
          break;
        case ZodIssueCode.invalid_string:
          if (typeof issue.validation === "object") {
            if ("includes" in issue.validation) {
              message = `Invalid input: must include "${issue.validation.includes}"`;
              if (typeof issue.validation.position === "number") {
                message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
              }
            } else if ("startsWith" in issue.validation) {
              message = `Invalid input: must start with "${issue.validation.startsWith}"`;
            } else if ("endsWith" in issue.validation) {
              message = `Invalid input: must end with "${issue.validation.endsWith}"`;
            } else {
              util.assertNever(issue.validation);
            }
          } else if (issue.validation !== "regex") {
            message = `Invalid ${issue.validation}`;
          } else {
            message = "Invalid";
          }
          break;
        case ZodIssueCode.too_small:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "bigint")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.too_big:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "bigint")
            message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.custom:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_intersection_types:
          message = `Intersection results could not be merged`;
          break;
        case ZodIssueCode.not_multiple_of:
          message = `Number must be a multiple of ${issue.multipleOf}`;
          break;
        case ZodIssueCode.not_finite:
          message = "Number must be finite";
          break;
        default:
          message = _ctx.defaultError;
          util.assertNever(issue);
      }
      return { message };
    }, "errorMap");
    en_default = errorMap;
  }
});

// ../../node_modules/zod/v3/errors.js
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var overrideErrorMap;
var init_errors = __esm({
  "../../node_modules/zod/v3/errors.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_en();
    overrideErrorMap = en_default;
    __name(setErrorMap, "setErrorMap");
    __name(getErrorMap, "getErrorMap");
  }
});

// ../../node_modules/zod/v3/helpers/parseUtil.js
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var makeIssue, EMPTY_PATH, ParseStatus, INVALID, DIRTY, OK, isAborted, isDirty, isValid, isAsync;
var init_parseUtil = __esm({
  "../../node_modules/zod/v3/helpers/parseUtil.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_en();
    makeIssue = /* @__PURE__ */ __name((params) => {
      const { data, path, errorMaps, issueData } = params;
      const fullPath = [...path, ...issueData.path || []];
      const fullIssue = {
        ...issueData,
        path: fullPath
      };
      if (issueData.message !== void 0) {
        return {
          ...issueData,
          path: fullPath,
          message: issueData.message
        };
      }
      let errorMessage = "";
      const maps = errorMaps.filter((m) => !!m).slice().reverse();
      for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
      }
      return {
        ...issueData,
        path: fullPath,
        message: errorMessage
      };
    }, "makeIssue");
    EMPTY_PATH = [];
    __name(addIssueToContext, "addIssueToContext");
    ParseStatus = class {
      constructor() {
        this.value = "valid";
      }
      dirty() {
        if (this.value === "valid")
          this.value = "dirty";
      }
      abort() {
        if (this.value !== "aborted")
          this.value = "aborted";
      }
      static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
          if (s.status === "aborted")
            return INVALID;
          if (s.status === "dirty")
            status.dirty();
          arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
      }
      static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value
          });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
      }
      static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
          const { key, value } = pair;
          if (key.status === "aborted")
            return INVALID;
          if (value.status === "aborted")
            return INVALID;
          if (key.status === "dirty")
            status.dirty();
          if (value.status === "dirty")
            status.dirty();
          if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
            finalObject[key.value] = value.value;
          }
        }
        return { status: status.value, value: finalObject };
      }
    };
    __name(ParseStatus, "ParseStatus");
    INVALID = Object.freeze({
      status: "aborted"
    });
    DIRTY = /* @__PURE__ */ __name((value) => ({ status: "dirty", value }), "DIRTY");
    OK = /* @__PURE__ */ __name((value) => ({ status: "valid", value }), "OK");
    isAborted = /* @__PURE__ */ __name((x) => x.status === "aborted", "isAborted");
    isDirty = /* @__PURE__ */ __name((x) => x.status === "dirty", "isDirty");
    isValid = /* @__PURE__ */ __name((x) => x.status === "valid", "isValid");
    isAsync = /* @__PURE__ */ __name((x) => typeof Promise !== "undefined" && x instanceof Promise, "isAsync");
  }
});

// ../../node_modules/zod/v3/helpers/typeAliases.js
var init_typeAliases = __esm({
  "../../node_modules/zod/v3/helpers/typeAliases.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
  }
});

// ../../node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
var init_errorUtil = __esm({
  "../../node_modules/zod/v3/helpers/errorUtil.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    (function(errorUtil2) {
      errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
      errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
    })(errorUtil || (errorUtil = {}));
  }
});

// ../../node_modules/zod/v3/types.js
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = /* @__PURE__ */ __name((iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  }, "customMap");
  return { errorMap: customMap, description };
}
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var ParseInputLazyPath, handleResult, ZodType, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType, stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring, onumber, oboolean, coerce, NEVER;
var init_types2 = __esm({
  "../../node_modules/zod/v3/types.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_ZodError();
    init_errors();
    init_errorUtil();
    init_parseUtil();
    init_util();
    ParseInputLazyPath = class {
      constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
      }
      get path() {
        if (!this._cachedPath.length) {
          if (Array.isArray(this._key)) {
            this._cachedPath.push(...this._path, ...this._key);
          } else {
            this._cachedPath.push(...this._path, this._key);
          }
        }
        return this._cachedPath;
      }
    };
    __name(ParseInputLazyPath, "ParseInputLazyPath");
    handleResult = /* @__PURE__ */ __name((ctx, result) => {
      if (isValid(result)) {
        return { success: true, data: result.value };
      } else {
        if (!ctx.common.issues.length) {
          throw new Error("Validation failed but no issues detected.");
        }
        return {
          success: false,
          get error() {
            if (this._error)
              return this._error;
            const error3 = new ZodError(ctx.common.issues);
            this._error = error3;
            return this._error;
          }
        };
      }
    }, "handleResult");
    __name(processCreateParams, "processCreateParams");
    ZodType = class {
      get description() {
        return this._def.description;
      }
      _getType(input) {
        return getParsedType(input.data);
      }
      _getOrReturnCtx(input, ctx) {
        return ctx || {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        };
      }
      _processInputParams(input) {
        return {
          status: new ParseStatus(),
          ctx: {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
          }
        };
      }
      _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
          throw new Error("Synchronous parse encountered promise.");
        }
        return result;
      }
      _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
      }
      parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      safeParse(data, params) {
        const ctx = {
          common: {
            issues: [],
            async: params?.async ?? false,
            contextualErrorMap: params?.errorMap
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
      }
      "~validate"(data) {
        const ctx = {
          common: {
            issues: [],
            async: !!this["~standard"].async
          },
          path: [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        if (!this["~standard"].async) {
          try {
            const result = this._parseSync({ data, path: [], parent: ctx });
            return isValid(result) ? {
              value: result.value
            } : {
              issues: ctx.common.issues
            };
          } catch (err) {
            if (err?.message?.toLowerCase()?.includes("encountered")) {
              this["~standard"].async = true;
            }
            ctx.common = {
              issues: [],
              async: true
            };
          }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        });
      }
      async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      async safeParseAsync(data, params) {
        const ctx = {
          common: {
            issues: [],
            contextualErrorMap: params?.errorMap,
            async: true
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
      }
      refine(check, message) {
        const getIssueProperties = /* @__PURE__ */ __name((val) => {
          if (typeof message === "string" || typeof message === "undefined") {
            return { message };
          } else if (typeof message === "function") {
            return message(val);
          } else {
            return message;
          }
        }, "getIssueProperties");
        return this._refinement((val, ctx) => {
          const result = check(val);
          const setError = /* @__PURE__ */ __name(() => ctx.addIssue({
            code: ZodIssueCode.custom,
            ...getIssueProperties(val)
          }), "setError");
          if (typeof Promise !== "undefined" && result instanceof Promise) {
            return result.then((data) => {
              if (!data) {
                setError();
                return false;
              } else {
                return true;
              }
            });
          }
          if (!result) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
          if (!check(val)) {
            ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
            return false;
          } else {
            return true;
          }
        });
      }
      _refinement(refinement) {
        return new ZodEffects({
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "refinement", refinement }
        });
      }
      superRefine(refinement) {
        return this._refinement(refinement);
      }
      constructor(def) {
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
          version: 1,
          vendor: "zod",
          validate: (data) => this["~validate"](data)
        };
      }
      optional() {
        return ZodOptional.create(this, this._def);
      }
      nullable() {
        return ZodNullable.create(this, this._def);
      }
      nullish() {
        return this.nullable().optional();
      }
      array() {
        return ZodArray.create(this);
      }
      promise() {
        return ZodPromise.create(this, this._def);
      }
      or(option) {
        return ZodUnion.create([this, option], this._def);
      }
      and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
      }
      transform(transform) {
        return new ZodEffects({
          ...processCreateParams(this._def),
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "transform", transform }
        });
      }
      default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
          ...processCreateParams(this._def),
          innerType: this,
          defaultValue: defaultValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodDefault
        });
      }
      brand() {
        return new ZodBranded({
          typeName: ZodFirstPartyTypeKind.ZodBranded,
          type: this,
          ...processCreateParams(this._def)
        });
      }
      catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
          ...processCreateParams(this._def),
          innerType: this,
          catchValue: catchValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodCatch
        });
      }
      describe(description) {
        const This = this.constructor;
        return new This({
          ...this._def,
          description
        });
      }
      pipe(target) {
        return ZodPipeline.create(this, target);
      }
      readonly() {
        return ZodReadonly.create(this);
      }
      isOptional() {
        return this.safeParse(void 0).success;
      }
      isNullable() {
        return this.safeParse(null).success;
      }
    };
    __name(ZodType, "ZodType");
    cuidRegex = /^c[^\s-]{8,}$/i;
    cuid2Regex = /^[0-9a-z]+$/;
    ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
    uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    nanoidRegex = /^[a-z0-9_-]{21}$/i;
    jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
    emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
    _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
    ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
    dateRegex = new RegExp(`^${dateRegexSource}$`);
    __name(timeRegexSource, "timeRegexSource");
    __name(timeRegex, "timeRegex");
    __name(datetimeRegex, "datetimeRegex");
    __name(isValidIP, "isValidIP");
    __name(isValidJWT, "isValidJWT");
    __name(isValidCidr, "isValidCidr");
    ZodString = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.length < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.length > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "length") {
            const tooBig = input.data.length > check.value;
            const tooSmall = input.data.length < check.value;
            if (tooBig || tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              if (tooBig) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              } else if (tooSmall) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              }
              status.dirty();
            }
          } else if (check.kind === "email") {
            if (!emailRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "email",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "emoji") {
            if (!emojiRegex) {
              emojiRegex = new RegExp(_emojiRegex, "u");
            }
            if (!emojiRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "emoji",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "uuid") {
            if (!uuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "uuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "nanoid") {
            if (!nanoidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "nanoid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid") {
            if (!cuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid2") {
            if (!cuid2Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid2",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ulid") {
            if (!ulidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ulid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "url") {
            try {
              new URL(input.data);
            } catch {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "regex") {
            check.regex.lastIndex = 0;
            const testResult = check.regex.test(input.data);
            if (!testResult) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "regex",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "trim") {
            input.data = input.data.trim();
          } else if (check.kind === "includes") {
            if (!input.data.includes(check.value, check.position)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { includes: check.value, position: check.position },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "toLowerCase") {
            input.data = input.data.toLowerCase();
          } else if (check.kind === "toUpperCase") {
            input.data = input.data.toUpperCase();
          } else if (check.kind === "startsWith") {
            if (!input.data.startsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { startsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "endsWith") {
            if (!input.data.endsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { endsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "datetime") {
            const regex = datetimeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "datetime",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "date") {
            const regex = dateRegex;
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "date",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "time") {
            const regex = timeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "time",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "duration") {
            if (!durationRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "duration",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ip") {
            if (!isValidIP(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ip",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "jwt") {
            if (!isValidJWT(input.data, check.alg)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "jwt",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cidr") {
            if (!isValidCidr(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cidr",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64") {
            if (!base64Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64url") {
            if (!base64urlRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
          validation,
          code: ZodIssueCode.invalid_string,
          ...errorUtil.errToObj(message)
        });
      }
      _addCheck(check) {
        return new ZodString({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
      }
      url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
      }
      emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
      }
      uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
      }
      nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
      }
      cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
      }
      cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
      }
      ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
      }
      base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
      }
      base64url(message) {
        return this._addCheck({
          kind: "base64url",
          ...errorUtil.errToObj(message)
        });
      }
      jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
      }
      ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
      }
      cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
      }
      datetime(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "datetime",
            precision: null,
            offset: false,
            local: false,
            message: options
          });
        }
        return this._addCheck({
          kind: "datetime",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          offset: options?.offset ?? false,
          local: options?.local ?? false,
          ...errorUtil.errToObj(options?.message)
        });
      }
      date(message) {
        return this._addCheck({ kind: "date", message });
      }
      time(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "time",
            precision: null,
            message: options
          });
        }
        return this._addCheck({
          kind: "time",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          ...errorUtil.errToObj(options?.message)
        });
      }
      duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
      }
      regex(regex, message) {
        return this._addCheck({
          kind: "regex",
          regex,
          ...errorUtil.errToObj(message)
        });
      }
      includes(value, options) {
        return this._addCheck({
          kind: "includes",
          value,
          position: options?.position,
          ...errorUtil.errToObj(options?.message)
        });
      }
      startsWith(value, message) {
        return this._addCheck({
          kind: "startsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      endsWith(value, message) {
        return this._addCheck({
          kind: "endsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      min(minLength, message) {
        return this._addCheck({
          kind: "min",
          value: minLength,
          ...errorUtil.errToObj(message)
        });
      }
      max(maxLength, message) {
        return this._addCheck({
          kind: "max",
          value: maxLength,
          ...errorUtil.errToObj(message)
        });
      }
      length(len, message) {
        return this._addCheck({
          kind: "length",
          value: len,
          ...errorUtil.errToObj(message)
        });
      }
      /**
       * Equivalent to `.min(1)`
       */
      nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
      }
      trim() {
        return new ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "trim" }]
        });
      }
      toLowerCase() {
        return new ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toLowerCase" }]
        });
      }
      toUpperCase() {
        return new ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toUpperCase" }]
        });
      }
      get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
      }
      get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
      }
      get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
      }
      get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
      }
      get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
      }
      get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
      }
      get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
      }
      get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
      }
      get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
      }
      get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
      }
      get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
      }
      get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
      }
      get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
      }
      get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
      }
      get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
      }
      get isBase64url() {
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
      }
      get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    __name(ZodString, "ZodString");
    ZodString.create = (params) => {
      return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    __name(floatSafeRemainder, "floatSafeRemainder");
    ZodNumber = class extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
      }
      _parse(input) {
        if (this._def.coerce) {
          input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.number,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "int") {
            if (!util.isInteger(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: "integer",
                received: "float",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (floatSafeRemainder(input.data, check.value) !== 0) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "finite") {
            if (!Number.isFinite(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_finite,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new ZodNumber({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      int(message) {
        return this._addCheck({
          kind: "int",
          message: errorUtil.toString(message)
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      finite(message) {
        return this._addCheck({
          kind: "finite",
          message: errorUtil.toString(message)
        });
      }
      safe(message) {
        return this._addCheck({
          kind: "min",
          inclusive: true,
          value: Number.MIN_SAFE_INTEGER,
          message: errorUtil.toString(message)
        })._addCheck({
          kind: "max",
          inclusive: true,
          value: Number.MAX_SAFE_INTEGER,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
      get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
      }
      get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
            return true;
          } else if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          } else if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return Number.isFinite(min) && Number.isFinite(max);
      }
    };
    __name(ZodNumber, "ZodNumber");
    ZodNumber.create = (params) => {
      return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodBigInt = class extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
      }
      _parse(input) {
        if (this._def.coerce) {
          try {
            input.data = BigInt(input.data);
          } catch {
            return this._getInvalidInput(input);
          }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
          return this._getInvalidInput(input);
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                type: "bigint",
                minimum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                type: "bigint",
                maximum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (input.data % check.value !== BigInt(0)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx.parsedType
        });
        return INVALID;
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new ZodBigInt({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    __name(ZodBigInt, "ZodBigInt");
    ZodBigInt.create = (params) => {
      return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodBoolean = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.boolean,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    __name(ZodBoolean, "ZodBoolean");
    ZodBoolean.create = (params) => {
      return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodDate = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.date,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_date
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.getTime() < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                message: check.message,
                inclusive: true,
                exact: false,
                minimum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.getTime() > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                message: check.message,
                inclusive: true,
                exact: false,
                maximum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return {
          status: status.value,
          value: new Date(input.data.getTime())
        };
      }
      _addCheck(check) {
        return new ZodDate({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      min(minDate, message) {
        return this._addCheck({
          kind: "min",
          value: minDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      max(maxDate, message) {
        return this._addCheck({
          kind: "max",
          value: maxDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min != null ? new Date(min) : null;
      }
      get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max != null ? new Date(max) : null;
      }
    };
    __name(ZodDate, "ZodDate");
    ZodDate.create = (params) => {
      return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params)
      });
    };
    ZodSymbol = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.symbol,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    __name(ZodSymbol, "ZodSymbol");
    ZodSymbol.create = (params) => {
      return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params)
      });
    };
    ZodUndefined = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.undefined,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    __name(ZodUndefined, "ZodUndefined");
    ZodUndefined.create = (params) => {
      return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params)
      });
    };
    ZodNull = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.null,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    __name(ZodNull, "ZodNull");
    ZodNull.create = (params) => {
      return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params)
      });
    };
    ZodAny = class extends ZodType {
      constructor() {
        super(...arguments);
        this._any = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    __name(ZodAny, "ZodAny");
    ZodAny.create = (params) => {
      return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params)
      });
    };
    ZodUnknown = class extends ZodType {
      constructor() {
        super(...arguments);
        this._unknown = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    __name(ZodUnknown, "ZodUnknown");
    ZodUnknown.create = (params) => {
      return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params)
      });
    };
    ZodNever = class extends ZodType {
      _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.never,
          received: ctx.parsedType
        });
        return INVALID;
      }
    };
    __name(ZodNever, "ZodNever");
    ZodNever.create = (params) => {
      return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params)
      });
    };
    ZodVoid = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.void,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    __name(ZodVoid, "ZodVoid");
    ZodVoid.create = (params) => {
      return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params)
      });
    };
    ZodArray = class extends ZodType {
      _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (def.exactLength !== null) {
          const tooBig = ctx.data.length > def.exactLength.value;
          const tooSmall = ctx.data.length < def.exactLength.value;
          if (tooBig || tooSmall) {
            addIssueToContext(ctx, {
              code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
              minimum: tooSmall ? def.exactLength.value : void 0,
              maximum: tooBig ? def.exactLength.value : void 0,
              type: "array",
              inclusive: true,
              exact: true,
              message: def.exactLength.message
            });
            status.dirty();
          }
        }
        if (def.minLength !== null) {
          if (ctx.data.length < def.minLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.minLength.message
            });
            status.dirty();
          }
        }
        if (def.maxLength !== null) {
          if (ctx.data.length > def.maxLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.maxLength.message
            });
            status.dirty();
          }
        }
        if (ctx.common.async) {
          return Promise.all([...ctx.data].map((item, i) => {
            return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
          })).then((result2) => {
            return ParseStatus.mergeArray(status, result2);
          });
        }
        const result = [...ctx.data].map((item, i) => {
          return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
      }
      get element() {
        return this._def.type;
      }
      min(minLength, message) {
        return new ZodArray({
          ...this._def,
          minLength: { value: minLength, message: errorUtil.toString(message) }
        });
      }
      max(maxLength, message) {
        return new ZodArray({
          ...this._def,
          maxLength: { value: maxLength, message: errorUtil.toString(message) }
        });
      }
      length(len, message) {
        return new ZodArray({
          ...this._def,
          exactLength: { value: len, message: errorUtil.toString(message) }
        });
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    __name(ZodArray, "ZodArray");
    ZodArray.create = (schema, params) => {
      return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params)
      });
    };
    __name(deepPartialify, "deepPartialify");
    ZodObject = class extends ZodType {
      constructor() {
        super(...arguments);
        this._cached = null;
        this.nonstrict = this.passthrough;
        this.augment = this.extend;
      }
      _getCached() {
        if (this._cached !== null)
          return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
      }
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
          for (const key in ctx.data) {
            if (!shapeKeys.includes(key)) {
              extraKeys.push(key);
            }
          }
        }
        const pairs = [];
        for (const key of shapeKeys) {
          const keyValidator = shape[key];
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (this._def.catchall instanceof ZodNever) {
          const unknownKeys = this._def.unknownKeys;
          if (unknownKeys === "passthrough") {
            for (const key of extraKeys) {
              pairs.push({
                key: { status: "valid", value: key },
                value: { status: "valid", value: ctx.data[key] }
              });
            }
          } else if (unknownKeys === "strict") {
            if (extraKeys.length > 0) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.unrecognized_keys,
                keys: extraKeys
              });
              status.dirty();
            }
          } else if (unknownKeys === "strip") {
          } else {
            throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
          }
        } else {
          const catchall = this._def.catchall;
          for (const key of extraKeys) {
            const value = ctx.data[key];
            pairs.push({
              key: { status: "valid", value: key },
              value: catchall._parse(
                new ParseInputLazyPath(ctx, value, ctx.path, key)
                //, ctx.child(key), value, getParsedType(value)
              ),
              alwaysSet: key in ctx.data
            });
          }
        }
        if (ctx.common.async) {
          return Promise.resolve().then(async () => {
            const syncPairs = [];
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              syncPairs.push({
                key,
                value,
                alwaysSet: pair.alwaysSet
              });
            }
            return syncPairs;
          }).then((syncPairs) => {
            return ParseStatus.mergeObjectSync(status, syncPairs);
          });
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get shape() {
        return this._def.shape();
      }
      strict(message) {
        errorUtil.errToObj;
        return new ZodObject({
          ...this._def,
          unknownKeys: "strict",
          ...message !== void 0 ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === "unrecognized_keys")
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError
                };
              return {
                message: defaultError
              };
            }
          } : {}
        });
      }
      strip() {
        return new ZodObject({
          ...this._def,
          unknownKeys: "strip"
        });
      }
      passthrough() {
        return new ZodObject({
          ...this._def,
          unknownKeys: "passthrough"
        });
      }
      // const AugmentFactory =
      //   <Def extends ZodObjectDef>(def: Def) =>
      //   <Augmentation extends ZodRawShape>(
      //     augmentation: Augmentation
      //   ): ZodObject<
      //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
      //     Def["unknownKeys"],
      //     Def["catchall"]
      //   > => {
      //     return new ZodObject({
      //       ...def,
      //       shape: () => ({
      //         ...def.shape(),
      //         ...augmentation,
      //       }),
      //     }) as any;
      //   };
      extend(augmentation) {
        return new ZodObject({
          ...this._def,
          shape: () => ({
            ...this._def.shape(),
            ...augmentation
          })
        });
      }
      /**
       * Prior to zod@1.0.12 there was a bug in the
       * inferred type of merged objects. Please
       * upgrade if you are experiencing issues.
       */
      merge(merging) {
        const merged = new ZodObject({
          unknownKeys: merging._def.unknownKeys,
          catchall: merging._def.catchall,
          shape: () => ({
            ...this._def.shape(),
            ...merging._def.shape()
          }),
          typeName: ZodFirstPartyTypeKind.ZodObject
        });
        return merged;
      }
      // merge<
      //   Incoming extends AnyZodObject,
      //   Augmentation extends Incoming["shape"],
      //   NewOutput extends {
      //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
      //       ? Augmentation[k]["_output"]
      //       : k extends keyof Output
      //       ? Output[k]
      //       : never;
      //   },
      //   NewInput extends {
      //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
      //       ? Augmentation[k]["_input"]
      //       : k extends keyof Input
      //       ? Input[k]
      //       : never;
      //   }
      // >(
      //   merging: Incoming
      // ): ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"],
      //   NewOutput,
      //   NewInput
      // > {
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      setKey(key, schema) {
        return this.augment({ [key]: schema });
      }
      // merge<Incoming extends AnyZodObject>(
      //   merging: Incoming
      // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
      // ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"]
      // > {
      //   // const mergedShape = objectUtil.mergeShapes(
      //   //   this._def.shape(),
      //   //   merging._def.shape()
      //   // );
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      catchall(index) {
        return new ZodObject({
          ...this._def,
          catchall: index
        });
      }
      pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
          if (mask[key] && this.shape[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (!mask[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      /**
       * @deprecated
       */
      deepPartial() {
        return deepPartialify(this);
      }
      partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          const fieldSchema = this.shape[key];
          if (mask && !mask[key]) {
            newShape[key] = fieldSchema;
          } else {
            newShape[key] = fieldSchema.optional();
          }
        }
        return new ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (mask && !mask[key]) {
            newShape[key] = this.shape[key];
          } else {
            const fieldSchema = this.shape[key];
            let newField = fieldSchema;
            while (newField instanceof ZodOptional) {
              newField = newField._def.innerType;
            }
            newShape[key] = newField;
          }
        }
        return new ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      keyof() {
        return createZodEnum(util.objectKeys(this.shape));
      }
    };
    __name(ZodObject, "ZodObject");
    ZodObject.create = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.strictCreate = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.lazycreate = (shape, params) => {
      return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodUnion = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
          for (const result of results) {
            if (result.result.status === "valid") {
              return result.result;
            }
          }
          for (const result of results) {
            if (result.result.status === "dirty") {
              ctx.common.issues.push(...result.ctx.common.issues);
              return result.result;
            }
          }
          const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
        __name(handleResults, "handleResults");
        if (ctx.common.async) {
          return Promise.all(options.map(async (option) => {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            return {
              result: await option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              }),
              ctx: childCtx
            };
          })).then(handleResults);
        } else {
          let dirty = void 0;
          const issues = [];
          for (const option of options) {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            const result = option._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            });
            if (result.status === "valid") {
              return result;
            } else if (result.status === "dirty" && !dirty) {
              dirty = { result, ctx: childCtx };
            }
            if (childCtx.common.issues.length) {
              issues.push(childCtx.common.issues);
            }
          }
          if (dirty) {
            ctx.common.issues.push(...dirty.ctx.common.issues);
            return dirty.result;
          }
          const unionErrors = issues.map((issues2) => new ZodError(issues2));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
      }
      get options() {
        return this._def.options;
      }
    };
    __name(ZodUnion, "ZodUnion");
    ZodUnion.create = (types, params) => {
      return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params)
      });
    };
    getDiscriminator = /* @__PURE__ */ __name((type) => {
      if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
      } else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
      } else if (type instanceof ZodLiteral) {
        return [type.value];
      } else if (type instanceof ZodEnum) {
        return type.options;
      } else if (type instanceof ZodNativeEnum) {
        return util.objectValues(type.enum);
      } else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
      } else if (type instanceof ZodUndefined) {
        return [void 0];
      } else if (type instanceof ZodNull) {
        return [null];
      } else if (type instanceof ZodOptional) {
        return [void 0, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
      } else {
        return [];
      }
    }, "getDiscriminator");
    ZodDiscriminatedUnion = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union_discriminator,
            options: Array.from(this.optionsMap.keys()),
            path: [discriminator]
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        } else {
          return option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      get discriminator() {
        return this._def.discriminator;
      }
      get options() {
        return this._def.options;
      }
      get optionsMap() {
        return this._def.optionsMap;
      }
      /**
       * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
       * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
       * have a different value for each object in the union.
       * @param discriminator the name of the discriminator property
       * @param types an array of object schemas
       * @param params
       */
      static create(discriminator, options, params) {
        const optionsMap = /* @__PURE__ */ new Map();
        for (const type of options) {
          const discriminatorValues = getDiscriminator(type.shape[discriminator]);
          if (!discriminatorValues.length) {
            throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
          }
          for (const value of discriminatorValues) {
            if (optionsMap.has(value)) {
              throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
            }
            optionsMap.set(value, type);
          }
        }
        return new ZodDiscriminatedUnion({
          typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
          discriminator,
          options,
          optionsMap,
          ...processCreateParams(params)
        });
      }
    };
    __name(ZodDiscriminatedUnion, "ZodDiscriminatedUnion");
    __name(mergeValues, "mergeValues");
    ZodIntersection = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = /* @__PURE__ */ __name((parsedLeft, parsedRight) => {
          if (isAborted(parsedLeft) || isAborted(parsedRight)) {
            return INVALID;
          }
          const merged = mergeValues(parsedLeft.value, parsedRight.value);
          if (!merged.valid) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_intersection_types
            });
            return INVALID;
          }
          if (isDirty(parsedLeft) || isDirty(parsedRight)) {
            status.dirty();
          }
          return { status: status.value, value: merged.data };
        }, "handleParsed");
        if (ctx.common.async) {
          return Promise.all([
            this._def.left._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }),
            this._def.right._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            })
          ]).then(([left, right]) => handleParsed(left, right));
        } else {
          return handleParsed(this._def.left._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }), this._def.right._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }));
        }
      }
    };
    __name(ZodIntersection, "ZodIntersection");
    ZodIntersection.create = (left, right, params) => {
      return new ZodIntersection({
        left,
        right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params)
      });
    };
    ZodTuple = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          status.dirty();
        }
        const items = [...ctx.data].map((item, itemIndex) => {
          const schema = this._def.items[itemIndex] || this._def.rest;
          if (!schema)
            return null;
          return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        }).filter((x) => !!x);
        if (ctx.common.async) {
          return Promise.all(items).then((results) => {
            return ParseStatus.mergeArray(status, results);
          });
        } else {
          return ParseStatus.mergeArray(status, items);
        }
      }
      get items() {
        return this._def.items;
      }
      rest(rest) {
        return new ZodTuple({
          ...this._def,
          rest
        });
      }
    };
    __name(ZodTuple, "ZodTuple");
    ZodTuple.create = (schemas, params) => {
      if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
      }
      return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params)
      });
    };
    ZodRecord = class extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
          pairs.push({
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
            value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (ctx.common.async) {
          return ParseStatus.mergeObjectAsync(status, pairs);
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get element() {
        return this._def.valueType;
      }
      static create(first, second, third) {
        if (second instanceof ZodType) {
          return new ZodRecord({
            keyType: first,
            valueType: second,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(third)
          });
        }
        return new ZodRecord({
          keyType: ZodString.create(),
          valueType: first,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(second)
        });
      }
    };
    __name(ZodRecord, "ZodRecord");
    ZodMap = class extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.map,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
          return {
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
            value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
          };
        });
        if (ctx.common.async) {
          const finalMap = /* @__PURE__ */ new Map();
          return Promise.resolve().then(async () => {
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              if (key.status === "aborted" || value.status === "aborted") {
                return INVALID;
              }
              if (key.status === "dirty" || value.status === "dirty") {
                status.dirty();
              }
              finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
          });
        } else {
          const finalMap = /* @__PURE__ */ new Map();
          for (const pair of pairs) {
            const key = pair.key;
            const value = pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        }
      }
    };
    __name(ZodMap, "ZodMap");
    ZodMap.create = (keyType, valueType, params) => {
      return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params)
      });
    };
    ZodSet = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.set,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
          if (ctx.data.size < def.minSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.minSize.message
            });
            status.dirty();
          }
        }
        if (def.maxSize !== null) {
          if (ctx.data.size > def.maxSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.maxSize.message
            });
            status.dirty();
          }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements2) {
          const parsedSet = /* @__PURE__ */ new Set();
          for (const element of elements2) {
            if (element.status === "aborted")
              return INVALID;
            if (element.status === "dirty")
              status.dirty();
            parsedSet.add(element.value);
          }
          return { status: status.value, value: parsedSet };
        }
        __name(finalizeSet, "finalizeSet");
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
          return Promise.all(elements).then((elements2) => finalizeSet(elements2));
        } else {
          return finalizeSet(elements);
        }
      }
      min(minSize, message) {
        return new ZodSet({
          ...this._def,
          minSize: { value: minSize, message: errorUtil.toString(message) }
        });
      }
      max(maxSize, message) {
        return new ZodSet({
          ...this._def,
          maxSize: { value: maxSize, message: errorUtil.toString(message) }
        });
      }
      size(size, message) {
        return this.min(size, message).max(size, message);
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    __name(ZodSet, "ZodSet");
    ZodSet.create = (valueType, params) => {
      return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params)
      });
    };
    ZodFunction = class extends ZodType {
      constructor() {
        super(...arguments);
        this.validate = this.implement;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.function,
            received: ctx.parsedType
          });
          return INVALID;
        }
        function makeArgsIssue(args, error3) {
          return makeIssue({
            data: args,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_arguments,
              argumentsError: error3
            }
          });
        }
        __name(makeArgsIssue, "makeArgsIssue");
        function makeReturnsIssue(returns, error3) {
          return makeIssue({
            data: returns,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_return_type,
              returnTypeError: error3
            }
          });
        }
        __name(makeReturnsIssue, "makeReturnsIssue");
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
          const me = this;
          return OK(async function(...args) {
            const error3 = new ZodError([]);
            const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
              error3.addIssue(makeArgsIssue(args, e));
              throw error3;
            });
            const result = await Reflect.apply(fn, this, parsedArgs);
            const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
              error3.addIssue(makeReturnsIssue(result, e));
              throw error3;
            });
            return parsedReturns;
          });
        } else {
          const me = this;
          return OK(function(...args) {
            const parsedArgs = me._def.args.safeParse(args, params);
            if (!parsedArgs.success) {
              throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
            }
            const result = Reflect.apply(fn, this, parsedArgs.data);
            const parsedReturns = me._def.returns.safeParse(result, params);
            if (!parsedReturns.success) {
              throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
            }
            return parsedReturns.data;
          });
        }
      }
      parameters() {
        return this._def.args;
      }
      returnType() {
        return this._def.returns;
      }
      args(...items) {
        return new ZodFunction({
          ...this._def,
          args: ZodTuple.create(items).rest(ZodUnknown.create())
        });
      }
      returns(returnType) {
        return new ZodFunction({
          ...this._def,
          returns: returnType
        });
      }
      implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      static create(args, returns, params) {
        return new ZodFunction({
          args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
          returns: returns || ZodUnknown.create(),
          typeName: ZodFirstPartyTypeKind.ZodFunction,
          ...processCreateParams(params)
        });
      }
    };
    __name(ZodFunction, "ZodFunction");
    ZodLazy = class extends ZodType {
      get schema() {
        return this._def.getter();
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
      }
    };
    __name(ZodLazy, "ZodLazy");
    ZodLazy.create = (getter, params) => {
      return new ZodLazy({
        getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params)
      });
    };
    ZodLiteral = class extends ZodType {
      _parse(input) {
        if (input.data !== this._def.value) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_literal,
            expected: this._def.value
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
      get value() {
        return this._def.value;
      }
    };
    __name(ZodLiteral, "ZodLiteral");
    ZodLiteral.create = (value, params) => {
      return new ZodLiteral({
        value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params)
      });
    };
    __name(createZodEnum, "createZodEnum");
    ZodEnum = class extends ZodType {
      _parse(input) {
        if (typeof input.data !== "string") {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get options() {
        return this._def.values;
      }
      get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      extract(values, newDef = this._def) {
        return ZodEnum.create(values, {
          ...this._def,
          ...newDef
        });
      }
      exclude(values, newDef = this._def) {
        return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
          ...this._def,
          ...newDef
        });
      }
    };
    __name(ZodEnum, "ZodEnum");
    ZodEnum.create = createZodEnum;
    ZodNativeEnum = class extends ZodType {
      _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get enum() {
        return this._def.values;
      }
    };
    __name(ZodNativeEnum, "ZodNativeEnum");
    ZodNativeEnum.create = (values, params) => {
      return new ZodNativeEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params)
      });
    };
    ZodPromise = class extends ZodType {
      unwrap() {
        return this._def.type;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.promise,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
          return this._def.type.parseAsync(data, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
          });
        }));
      }
    };
    __name(ZodPromise, "ZodPromise");
    ZodPromise.create = (schema, params) => {
      return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params)
      });
    };
    ZodEffects = class extends ZodType {
      innerType() {
        return this._def.schema;
      }
      sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
          addIssue: (arg) => {
            addIssueToContext(ctx, arg);
            if (arg.fatal) {
              status.abort();
            } else {
              status.dirty();
            }
          },
          get path() {
            return ctx.path;
          }
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
          const processed = effect.transform(ctx.data, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(processed).then(async (processed2) => {
              if (status.value === "aborted")
                return INVALID;
              const result = await this._def.schema._parseAsync({
                data: processed2,
                path: ctx.path,
                parent: ctx
              });
              if (result.status === "aborted")
                return INVALID;
              if (result.status === "dirty")
                return DIRTY(result.value);
              if (status.value === "dirty")
                return DIRTY(result.value);
              return result;
            });
          } else {
            if (status.value === "aborted")
              return INVALID;
            const result = this._def.schema._parseSync({
              data: processed,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          }
        }
        if (effect.type === "refinement") {
          const executeRefinement = /* @__PURE__ */ __name((acc) => {
            const result = effect.refinement(acc, checkCtx);
            if (ctx.common.async) {
              return Promise.resolve(result);
            }
            if (result instanceof Promise) {
              throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
            }
            return acc;
          }, "executeRefinement");
          if (ctx.common.async === false) {
            const inner = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            executeRefinement(inner.value);
            return { status: status.value, value: inner.value };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
              if (inner.status === "aborted")
                return INVALID;
              if (inner.status === "dirty")
                status.dirty();
              return executeRefinement(inner.value).then(() => {
                return { status: status.value, value: inner.value };
              });
            });
          }
        }
        if (effect.type === "transform") {
          if (ctx.common.async === false) {
            const base = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (!isValid(base))
              return INVALID;
            const result = effect.transform(base.value, checkCtx);
            if (result instanceof Promise) {
              throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
            }
            return { status: status.value, value: result };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
              if (!isValid(base))
                return INVALID;
              return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                status: status.value,
                value: result
              }));
            });
          }
        }
        util.assertNever(effect);
      }
    };
    __name(ZodEffects, "ZodEffects");
    ZodEffects.create = (schema, effect, params) => {
      return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params)
      });
    };
    ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
      return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params)
      });
    };
    ZodOptional = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
          return OK(void 0);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    __name(ZodOptional, "ZodOptional");
    ZodOptional.create = (type, params) => {
      return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params)
      });
    };
    ZodNullable = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
          return OK(null);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    __name(ZodNullable, "ZodNullable");
    ZodNullable.create = (type, params) => {
      return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params)
      });
    };
    ZodDefault = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
          data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      removeDefault() {
        return this._def.innerType;
      }
    };
    __name(ZodDefault, "ZodDefault");
    ZodDefault.create = (type, params) => {
      return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params)
      });
    };
    ZodCatch = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const newCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          }
        };
        const result = this._def.innerType._parse({
          data: newCtx.data,
          path: newCtx.path,
          parent: {
            ...newCtx
          }
        });
        if (isAsync(result)) {
          return result.then((result2) => {
            return {
              status: "valid",
              value: result2.status === "valid" ? result2.value : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data
              })
            };
          });
        } else {
          return {
            status: "valid",
            value: result.status === "valid" ? result.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        }
      }
      removeCatch() {
        return this._def.innerType;
      }
    };
    __name(ZodCatch, "ZodCatch");
    ZodCatch.create = (type, params) => {
      return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params)
      });
    };
    ZodNaN = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.nan,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
    };
    __name(ZodNaN, "ZodNaN");
    ZodNaN.create = (params) => {
      return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params)
      });
    };
    BRAND = Symbol("zod_brand");
    ZodBranded = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      unwrap() {
        return this._def.type;
      }
    };
    __name(ZodBranded, "ZodBranded");
    ZodPipeline = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
          const handleAsync = /* @__PURE__ */ __name(async () => {
            const inResult = await this._def.in._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inResult.status === "aborted")
              return INVALID;
            if (inResult.status === "dirty") {
              status.dirty();
              return DIRTY(inResult.value);
            } else {
              return this._def.out._parseAsync({
                data: inResult.value,
                path: ctx.path,
                parent: ctx
              });
            }
          }, "handleAsync");
          return handleAsync();
        } else {
          const inResult = this._def.in._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return {
              status: "dirty",
              value: inResult.value
            };
          } else {
            return this._def.out._parseSync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        }
      }
      static create(a, b) {
        return new ZodPipeline({
          in: a,
          out: b,
          typeName: ZodFirstPartyTypeKind.ZodPipeline
        });
      }
    };
    __name(ZodPipeline, "ZodPipeline");
    ZodReadonly = class extends ZodType {
      _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = /* @__PURE__ */ __name((data) => {
          if (isValid(data)) {
            data.value = Object.freeze(data.value);
          }
          return data;
        }, "freeze");
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    __name(ZodReadonly, "ZodReadonly");
    ZodReadonly.create = (type, params) => {
      return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params)
      });
    };
    __name(cleanParams, "cleanParams");
    __name(custom, "custom");
    late = {
      object: ZodObject.lazycreate
    };
    (function(ZodFirstPartyTypeKind2) {
      ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
      ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
      ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
      ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
      ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
      ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
      ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
      ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
      ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
      ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
      ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
      ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
      ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
      ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
      ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
      ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
      ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
      ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
      ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
      ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
      ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
      ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
      ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
      ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
      ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
      ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
      ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
      ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
      ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
      ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
      ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
      ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
      ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
      ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
      ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
      ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
    })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
    instanceOfType = /* @__PURE__ */ __name((cls, params = {
      message: `Input not instance of ${cls.name}`
    }) => custom((data) => data instanceof cls, params), "instanceOfType");
    stringType = ZodString.create;
    numberType = ZodNumber.create;
    nanType = ZodNaN.create;
    bigIntType = ZodBigInt.create;
    booleanType = ZodBoolean.create;
    dateType = ZodDate.create;
    symbolType = ZodSymbol.create;
    undefinedType = ZodUndefined.create;
    nullType = ZodNull.create;
    anyType = ZodAny.create;
    unknownType = ZodUnknown.create;
    neverType = ZodNever.create;
    voidType = ZodVoid.create;
    arrayType = ZodArray.create;
    objectType = ZodObject.create;
    strictObjectType = ZodObject.strictCreate;
    unionType = ZodUnion.create;
    discriminatedUnionType = ZodDiscriminatedUnion.create;
    intersectionType = ZodIntersection.create;
    tupleType = ZodTuple.create;
    recordType = ZodRecord.create;
    mapType = ZodMap.create;
    setType = ZodSet.create;
    functionType = ZodFunction.create;
    lazyType = ZodLazy.create;
    literalType = ZodLiteral.create;
    enumType = ZodEnum.create;
    nativeEnumType = ZodNativeEnum.create;
    promiseType = ZodPromise.create;
    effectsType = ZodEffects.create;
    optionalType = ZodOptional.create;
    nullableType = ZodNullable.create;
    preprocessType = ZodEffects.createWithPreprocess;
    pipelineType = ZodPipeline.create;
    ostring = /* @__PURE__ */ __name(() => stringType().optional(), "ostring");
    onumber = /* @__PURE__ */ __name(() => numberType().optional(), "onumber");
    oboolean = /* @__PURE__ */ __name(() => booleanType().optional(), "oboolean");
    coerce = {
      string: (arg) => ZodString.create({ ...arg, coerce: true }),
      number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
      boolean: (arg) => ZodBoolean.create({
        ...arg,
        coerce: true
      }),
      bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
      date: (arg) => ZodDate.create({ ...arg, coerce: true })
    };
    NEVER = INVALID;
  }
});

// ../../node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});
var init_external = __esm({
  "../../node_modules/zod/v3/external.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_errors();
    init_parseUtil();
    init_typeAliases();
    init_util();
    init_types2();
    init_ZodError();
  }
});

// ../../node_modules/zod/index.js
var init_zod = __esm({
  "../../node_modules/zod/index.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_external();
    init_external();
  }
});

// ../../packages/shared/src/schemas/index.ts
function validateWithDetail(schema, input) {
  const result = schema.safeParse(input);
  if (result.success)
    return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
    )
  };
}
var nonEmpty, skillLevelSchema, lessonKindSchema, uiLanguageSchema, targetLanguageSchema, planTypeSchema, substitutionSchema, patternDrillItemSchema, microExerciseSchema, patternDrillPartSchema, dialogueLineSchema, applicationQuestionSchema, realApplicationPartSchema, generatedLessonSchema, generatedCycleSchema, weakTermSchema, skillDeltaSchema, cycleGenerationInputSchema, authRequestSchema, onboardingRequestSchema, updateProfileSchema, completeLessonSchema, telemetryBatchSchema, purchasePlanSchema, adminGiftSchema, aiProtocolSchema, aiVendorPresetSchema, createAiProviderSchema, updateAiProviderSchema, reorderAiProvidersSchema, testAiProviderSchema, telegramSuccessfulPaymentSchema, telegramInitDataUserSchema;
var init_schemas = __esm({
  "../../packages/shared/src/schemas/index.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_zod();
    nonEmpty = /* @__PURE__ */ __name((max) => external_exports.string().trim().min(1).max(max), "nonEmpty");
    skillLevelSchema = external_exports.enum(["ZERO", "A1", "A2", "B1", "B2", "C1"]);
    lessonKindSchema = external_exports.enum([
      "TEACHING",
      "HIDDEN_ASSESSMENT",
      "CONSOLIDATION"
    ]);
    uiLanguageSchema = external_exports.enum(["fa", "en", "ar", "tr", "ru"]);
    targetLanguageSchema = external_exports.enum(["en", "de", "fr", "es", "tr", "ar"]);
    planTypeSchema = external_exports.enum([
      "TRIAL",
      "2_WEEKS",
      "1_MONTH",
      "3_MONTHS",
      "6_MONTHS",
      "1_YEAR"
    ]);
    substitutionSchema = external_exports.object({
      base: nonEmpty(300),
      slots: external_exports.array(nonEmpty(80)).min(2).max(8)
    });
    patternDrillItemSchema = external_exports.object({
      term: nonEmpty(120),
      meaning: nonEmpty(200),
      pronunciation: external_exports.string().max(120).optional(),
      example: nonEmpty(400),
      exampleTranslation: external_exports.string().max(400).optional(),
      substitution: substitutionSchema.optional(),
      /**
       * box به‌صورت literal union تعریف می‌شود تا خروجی infer شده با
       * LeitnerBox در types مطابق باشد. مدل این مقدار را تعیین نمی‌کند،
       * بلکه موتور تطبیقی ما آن را هنگام رندر تزریق می‌کند.
       */
      box: external_exports.union([
        external_exports.literal(1),
        external_exports.literal(2),
        external_exports.literal(3),
        external_exports.literal(4),
        external_exports.literal(5)
      ]).optional()
    });
    microExerciseSchema = external_exports.object({
      id: nonEmpty(40),
      kind: external_exports.enum(["FILL_BLANK", "REORDER", "MATCH", "CHOOSE"]),
      prompt: nonEmpty(500),
      options: external_exports.array(nonEmpty(200)).min(2).max(6).optional(),
      correctIndex: external_exports.number().int().min(0).max(5).optional(),
      answer: external_exports.string().max(200).optional(),
      explanation: external_exports.string().max(500).optional()
    }).refine(
      (e) => e.kind === "CHOOSE" || e.kind === "MATCH" ? e.options !== void 0 && e.correctIndex !== void 0 : true,
      { message: "CHOOSE/MATCH exercises require options and correctIndex" }
    );
    patternDrillPartSchema = external_exports.object({
      type: external_exports.literal("PATTERN_DRILL"),
      explanation: nonEmpty(1200),
      pattern: external_exports.string().max(300).optional(),
      patternTranslation: external_exports.string().max(300).optional(),
      items: external_exports.array(patternDrillItemSchema).min(3).max(12),
      microExercises: external_exports.array(microExerciseSchema).max(6).optional()
    });
    dialogueLineSchema = external_exports.object({
      speaker: nonEmpty(60),
      text: nonEmpty(400),
      translation: external_exports.string().max(400).optional()
    });
    applicationQuestionSchema = external_exports.object({
      id: nonEmpty(40),
      prompt: nonEmpty(600),
      options: external_exports.array(nonEmpty(300)).min(2).max(5),
      correctIndex: external_exports.number().int().min(0).max(4),
      explanation: external_exports.string().max(600).optional(),
      linkedTerm: external_exports.string().max(120).optional()
    }).refine((q) => q.correctIndex < q.options.length, {
      message: "correctIndex out of range"
    });
    realApplicationPartSchema = external_exports.object({
      type: external_exports.literal("REAL_APPLICATION"),
      scenario: nonEmpty(600),
      scenarioTranslation: external_exports.string().max(600).optional(),
      dialogue: external_exports.array(dialogueLineSchema).max(20).optional(),
      questions: external_exports.array(applicationQuestionSchema).min(2).max(10)
    });
    generatedLessonSchema = external_exports.object({
      dayNumber: external_exports.number().int().min(1).max(7),
      title: nonEmpty(150),
      titleFa: nonEmpty(150),
      kind: lessonKindSchema,
      part1: patternDrillPartSchema,
      part2: realApplicationPartSchema
    }).refine(
      (l) => l.dayNumber !== 7 || l.kind === "CONSOLIDATION",
      { message: "Day 7 must be CONSOLIDATION" }
    ).refine(
      (l) => l.dayNumber !== 6 || l.kind === "HIDDEN_ASSESSMENT",
      { message: "Day 6 must be HIDDEN_ASSESSMENT" }
    );
    generatedCycleSchema = external_exports.object({
      title: nonEmpty(150),
      titleFa: nonEmpty(150),
      focusSummary: nonEmpty(600),
      lessons: external_exports.array(generatedLessonSchema).length(7)
    }).refine(
      (c) => {
        const days = c.lessons.map((l) => l.dayNumber).sort((a, b) => a - b);
        return days.every((d, i) => d === i + 1);
      },
      { message: "Cycle must contain exactly days 1..7, each once" }
    );
    weakTermSchema = external_exports.object({
      term: nonEmpty(120),
      box: external_exports.number().int().min(1).max(5),
      lapses: external_exports.number().int().min(0),
      failRate: external_exports.number().min(0).max(1)
    });
    skillDeltaSchema = external_exports.object({
      accuracyPct: external_exports.number().min(0).max(100),
      averageResponseMs: external_exports.number().min(0),
      maxPauseMs: external_exports.number().min(0),
      totalAnswers: external_exports.number().int().min(0),
      weakTerms: external_exports.array(weakTermSchema).max(60),
      masteredTerms: external_exports.array(external_exports.string()).max(120),
      strongestAreas: external_exports.array(external_exports.string()).max(10),
      weakestAreas: external_exports.array(external_exports.string()).max(10),
      paceAnswersPerMinute: external_exports.number().min(0),
      hiddenAssessmentScore: external_exports.number().min(0).max(100).nullable()
    });
    cycleGenerationInputSchema = external_exports.object({
      user: external_exports.object({
        id: external_exports.string().uuid(),
        skillLevel: skillLevelSchema,
        learningGoal: external_exports.string().max(200).nullable(),
        uiLanguage: uiLanguageSchema,
        targetLanguage: targetLanguageSchema
      }),
      cycleNumber: external_exports.number().int().min(1),
      delta: skillDeltaSchema,
      previousCycleSummary: external_exports.string().max(2e3).nullable()
    });
    authRequestSchema = external_exports.object({
      initData: external_exports.string().min(10)
    });
    onboardingRequestSchema = external_exports.object({
      uiLanguage: uiLanguageSchema,
      targetLanguage: targetLanguageSchema,
      skillLevel: skillLevelSchema,
      learningGoal: nonEmpty(100)
    });
    updateProfileSchema = external_exports.object({
      uiLanguage: uiLanguageSchema.optional(),
      targetLanguage: targetLanguageSchema.optional(),
      learningGoal: external_exports.string().max(200).optional(),
      timezone: external_exports.string().max(64).optional()
    });
    completeLessonSchema = external_exports.object({
      lessonId: external_exports.string().uuid(),
      durationSeconds: external_exports.number().int().min(0).max(86400),
      answers: external_exports.array(
        external_exports.object({
          itemId: nonEmpty(60),
          isCorrect: external_exports.boolean(),
          responseMs: external_exports.number().int().min(0).max(6e5),
          linkedTerm: external_exports.string().max(120).optional(),
          usedHint: external_exports.boolean().optional()
        })
      ).max(200)
    });
    telemetryBatchSchema = external_exports.object({
      lessonId: external_exports.string().uuid().optional(),
      events: external_exports.array(
        external_exports.object({
          eventType: external_exports.enum([
            "ANSWER",
            "PAUSE",
            "SKIP",
            "REPLAY",
            "HINT_USED",
            "LESSON_START",
            "LESSON_END",
            "SESSION_START",
            "SESSION_END"
          ]),
          itemId: external_exports.string().max(60).optional(),
          isCorrect: external_exports.boolean().optional(),
          responseMs: external_exports.number().int().min(0).max(6e5).optional(),
          pauseMs: external_exports.number().int().min(0).max(6e5).optional(),
          payload: external_exports.record(external_exports.unknown()).optional()
        })
      ).min(1).max(200)
    });
    purchasePlanSchema = external_exports.object({
      planId: external_exports.string().min(1).max(40)
    });
    adminGiftSchema = external_exports.object({
      telegramId: external_exports.number().int().positive(),
      planType: planTypeSchema,
      note: external_exports.string().max(500).optional(),
      extend: external_exports.boolean().default(false)
    });
    aiProtocolSchema = external_exports.enum(["gemini", "openai_compatible", "anthropic"]);
    aiVendorPresetSchema = external_exports.enum([
      "gemini",
      "deepseek",
      "openai",
      "anthropic",
      "groq",
      "openrouter",
      "together",
      "custom"
    ]);
    createAiProviderSchema = external_exports.object({
      label: external_exports.string().min(1).max(80),
      protocol: aiProtocolSchema,
      vendor: external_exports.string().min(1).max(40),
      model: external_exports.string().min(1).max(120),
      baseUrl: external_exports.string().url().max(300).nullish(),
      apiKey: external_exports.string().min(8).max(500),
      priority: external_exports.number().int().min(1).max(999).default(100),
      isActive: external_exports.boolean().default(true),
      temperature: external_exports.number().min(0).max(2).nullish(),
      maxOutputTokens: external_exports.number().int().min(256).max(2e5).nullish(),
      supportsJsonSchema: external_exports.boolean().default(false),
      note: external_exports.string().max(500).nullish()
    }).refine(
      (v) => v.protocol !== "openai_compatible" || Boolean(v.baseUrl) || v.vendor === "deepseek",
      {
        message: 'baseUrl is required for openai_compatible providers unless vendor is "deepseek"',
        path: ["baseUrl"]
      }
    );
    updateAiProviderSchema = external_exports.object({
      label: external_exports.string().min(1).max(80).optional(),
      protocol: aiProtocolSchema.optional(),
      vendor: external_exports.string().min(1).max(40).optional(),
      model: external_exports.string().min(1).max(120).optional(),
      baseUrl: external_exports.string().url().max(300).nullish(),
      apiKey: external_exports.string().min(8).max(500).optional(),
      priority: external_exports.number().int().min(1).max(999).optional(),
      isActive: external_exports.boolean().optional(),
      temperature: external_exports.number().min(0).max(2).nullish(),
      maxOutputTokens: external_exports.number().int().min(256).max(2e5).nullish(),
      supportsJsonSchema: external_exports.boolean().optional(),
      note: external_exports.string().max(500).nullish()
    });
    reorderAiProvidersSchema = external_exports.object({
      order: external_exports.array(external_exports.string().uuid()).min(1).max(50)
    });
    testAiProviderSchema = external_exports.object({
      providerId: external_exports.string().uuid().optional(),
      /** Ad-hoc credentials for testing before saving. */
      draft: createAiProviderSchema.optional()
    });
    telegramSuccessfulPaymentSchema = external_exports.object({
      telegram_payment_charge_id: external_exports.string().min(1),
      provider_payment_charge_id: external_exports.string().optional(),
      currency: external_exports.string(),
      total_amount: external_exports.number().int().min(1),
      invoice_payload: external_exports.string()
    });
    telegramInitDataUserSchema = external_exports.object({
      id: external_exports.number().int().positive(),
      first_name: external_exports.string(),
      last_name: external_exports.string().optional(),
      username: external_exports.string().optional(),
      language_code: external_exports.string().optional(),
      is_premium: external_exports.boolean().optional(),
      photo_url: external_exports.string().optional()
    });
    __name(validateWithDetail, "validateWithDetail");
  }
});

// ../../packages/shared/src/constants/index.ts
function languageFromTelegramCode(code) {
  if (!code)
    return DEFAULT_UI_LANGUAGE;
  const base = code.split("-")[0]?.toLowerCase() ?? "";
  const supported = ["fa", "en", "ar", "tr", "ru"];
  return supported.includes(base) ? base : DEFAULT_UI_LANGUAGE;
}
var CYCLE_LENGTH_DAYS, FREE_TRIAL_DAYS, CYCLE_STALL_DAYS, LEITNER_BOXES, CYCLE_SCHEDULE, LEITNER_INTERVALS_DAYS, ECONOMY, PLAN_DEFINITIONS, PLAN_DURATION_DAYS, DEFAULT_UI_LANGUAGE, SECURITY, PROMPT_INJECTION_PATTERNS;
var init_constants = __esm({
  "../../packages/shared/src/constants/index.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    CYCLE_LENGTH_DAYS = 7;
    FREE_TRIAL_DAYS = 7;
    CYCLE_STALL_DAYS = 12;
    LEITNER_BOXES = 5;
    CYCLE_SCHEDULE = {
      1: "TEACHING",
      2: "TEACHING",
      3: "TEACHING",
      4: "TEACHING",
      5: "TEACHING",
      6: "HIDDEN_ASSESSMENT",
      7: "CONSOLIDATION"
    };
    LEITNER_INTERVALS_DAYS = {
      1: 0,
      2: 1,
      3: 3,
      4: 7,
      5: 21
    };
    ECONOMY = {
      rewardPerLesson: 10,
      rewardPerfectDay: 25,
      rewardStreak7: 100,
      penaltyNone: 0
    };
    PLAN_DEFINITIONS = [
      {
        id: "2_weeks",
        planType: "2_WEEKS",
        titleFa: "\u06F2 \u0647\u0641\u062A\u0647\u200C\u0627\u06CC",
        titleEn: "2 Weeks",
        durationDays: 14,
        priceIrr: 4e5,
        priceStars: 100,
        discountPercent: 20,
        badge: null
      },
      {
        id: "1_month",
        planType: "1_MONTH",
        titleFa: "\u06F1 \u0645\u0627\u0647\u0647",
        titleEn: "1 Month",
        durationDays: 30,
        priceIrr: 75e4,
        priceStars: 175,
        discountPercent: 20,
        badge: "POPULAR"
      },
      {
        id: "3_months",
        planType: "3_MONTHS",
        titleFa: "\u06F3 \u0645\u0627\u0647\u0647",
        titleEn: "3 Months",
        durationDays: 90,
        priceIrr: 18e5,
        priceStars: 400,
        discountPercent: 20,
        badge: null
      },
      {
        id: "6_months",
        planType: "6_MONTHS",
        titleFa: "\u06F6 \u0645\u0627\u0647\u0647",
        titleEn: "6 Months",
        durationDays: 180,
        priceIrr: 32e5,
        priceStars: 700,
        discountPercent: 20,
        badge: null
      },
      {
        id: "1_year",
        planType: "1_YEAR",
        titleFa: "\u06F1 \u0633\u0627\u0644\u0647",
        titleEn: "1 Year",
        durationDays: 365,
        priceIrr: 55e5,
        priceStars: 1150,
        discountPercent: 20,
        badge: "BEST_VALUE"
      }
    ];
    PLAN_DURATION_DAYS = {
      TRIAL: FREE_TRIAL_DAYS,
      "2_WEEKS": 14,
      "1_MONTH": 30,
      "3_MONTHS": 90,
      "6_MONTHS": 180,
      "1_YEAR": 365
    };
    DEFAULT_UI_LANGUAGE = "fa";
    __name(languageFromTelegramCode, "languageFromTelegramCode");
    SECURITY = {
      jwtTtlSeconds: 15 * 60,
      initDataMaxAgeSeconds: 24 * 60 * 60,
      rateLimitPerMinute: 60,
      rateLimitPerDay: 2e3,
      maxPromptLength: 1e3
    };
    PROMPT_INJECTION_PATTERNS = [
      /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
      /disregard\s+(all\s+)?(previous|above|prior)/i,
      /forget\s+(everything|all|your)\s+(instructions?|rules?|prompts?)/i,
      /you\s+are\s+now\s+(a|an)\s+/i,
      /system\s*prompt/i,
      /reveal\s+(your\s+)?(instructions?|prompt|rules)/i,
      /act\s+as\s+(a\s+)?(developer|admin|root|system)/i,
      /<\s*\|?\s*(im_start|system|assistant)\s*\|?\s*>/i,
      /\[\s*(system|INST)\s*\]/i,
      /###\s*(system|instruction)/i,
      /jailbreak/i,
      /DAN\s+mode/i,
      /pretend\s+(to\s+be|you\s+are)/i
    ];
  }
});

// ../../packages/shared/src/engine/index.ts
function applyLeitnerReview(input) {
  const { isCorrect, responseMs } = input;
  let { box, ease, repetitions, lapses } = input;
  ease = clamp(ease || 2.5, 1.3, 3.2);
  if (!isCorrect) {
    box = 1;
    lapses += 1;
    repetitions = 0;
    ease = clamp(ease - 0.25, 1.3, 3.2);
  } else {
    const fast = responseMs > 0 && responseMs < 4e3;
    const slow = responseMs >= 9e3;
    const step = fast && box >= 2 ? 2 : 1;
    box = Math.min(LEITNER_BOXES, box + step);
    repetitions += 1;
    if (fast)
      ease = clamp(ease + 0.08, 1.3, 3.2);
    else if (slow)
      ease = clamp(ease - 0.05, 1.3, 3.2);
  }
  const baseInterval = LEITNER_INTERVALS_DAYS[box] ?? 0;
  const intervalDays = Math.max(0, Math.round(baseInterval * (ease / 2.5)));
  return {
    box,
    ease: round2(ease),
    repetitions,
    lapses,
    intervalDays,
    mastered: box >= LEITNER_BOXES
  };
}
function nextReviewDate(intervalDays, from = /* @__PURE__ */ new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + Math.max(intervalDays, 0));
  return d;
}
function buildSkillDelta(input) {
  const answers = input.events.filter((e) => e.eventType === "ANSWER");
  const totalAnswers = answers.length;
  const correct = answers.filter((a) => a.isCorrect === true).length;
  const responseTimes = answers.map((a) => a.responseMs ?? 0).filter((v) => v > 0);
  const averageResponseMs = responseTimes.length ? Math.round(sum(responseTimes) / responseTimes.length) : 0;
  const pauses = input.events.map((e) => e.pauseMs ?? 0).filter((v) => v > 0);
  const maxPauseMs = pauses.length ? Math.max(...pauses) : 0;
  const areaStats = /* @__PURE__ */ new Map();
  for (const a of answers) {
    const area = a.itemId ? input.areaByItemId?.[a.itemId] : void 0;
    if (!area)
      continue;
    const cur = areaStats.get(area) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect)
      cur.correct += 1;
    areaStats.set(area, cur);
  }
  const rankedAreas = [...areaStats.entries()].map(([area, s]) => ({ area, rate: s.total ? s.correct / s.total : 0 })).sort((a, b) => b.rate - a.rate);
  const totalResponseMs = sum(responseTimes);
  const weakTerms = input.lexical.filter((l) => l.box <= 2 || l.lapses > 0).map((l) => {
    const total = l.successCount + l.failCount;
    return {
      term: l.term,
      box: l.box,
      lapses: l.lapses,
      failRate: total > 0 ? round2(l.failCount / total) : 0
    };
  }).sort((a, b) => b.failRate - a.failRate || a.box - b.box).slice(0, 60);
  const masteredTerms = input.lexical.filter((l) => l.box >= LEITNER_BOXES).map((l) => l.term).slice(0, 120);
  return {
    accuracyPct: totalAnswers ? round2(correct / totalAnswers * 100) : 0,
    averageResponseMs,
    maxPauseMs,
    totalAnswers,
    weakTerms,
    masteredTerms,
    strongestAreas: rankedAreas.slice(0, 5).map((a) => a.area),
    weakestAreas: rankedAreas.slice(-5).reverse().map((a) => a.area),
    paceAnswersPerMinute: totalResponseMs > 0 ? round2(answers.length * 6e4 / totalResponseMs) : 0,
    hiddenAssessmentScore: input.hiddenAssessmentScore ?? null
  };
}
function lessonKindForDay(dayNumber) {
  return CYCLE_SCHEDULE[dayNumber] ?? "TEACHING";
}
function buildCycleDays(input) {
  const { cycleStatus, completedDays, lessonTitles } = input;
  const completedSet = new Set(completedDays);
  let currentDay = null;
  for (let d = 1; d <= CYCLE_LENGTH_DAYS; d++) {
    if (!completedSet.has(d)) {
      currentDay = d;
      break;
    }
  }
  return Array.from({ length: CYCLE_LENGTH_DAYS }, (_, i) => {
    const dayNumber = i + 1;
    const isCompleted = completedSet.has(dayNumber);
    let status;
    if (isCompleted)
      status = "COMPLETED";
    else if (cycleStatus === "ACTIVE" && dayNumber === currentDay)
      status = "AVAILABLE";
    else
      status = "LOCKED";
    return {
      dayNumber,
      title: lessonTitles[dayNumber] ?? `Day ${dayNumber}`,
      kind: lessonKindForDay(dayNumber),
      status,
      isCompleted,
      isActive: dayNumber === currentDay && cycleStatus === "ACTIVE",
      isLocked: status === "LOCKED"
    };
  });
}
function shouldGenerateNextCycle(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const stallDays = input.stallDays ?? CYCLE_STALL_DAYS;
  if (input.hasGeneratingCycle) {
    return { shouldGenerate: false, reason: "ALREADY_GENERATING" };
  }
  if (!input.cycleStartedAt) {
    return { shouldGenerate: false, reason: "CYCLE_NOT_STARTED" };
  }
  const days = new Set(input.completedDays);
  const allComplete = Array.from(
    { length: CYCLE_LENGTH_DAYS },
    (_, i) => i + 1
  ).every((d) => days.has(d));
  if (input.cycleStatus === "ACTIVE" && allComplete) {
    return { shouldGenerate: true, reason: "CYCLE_COMPLETE" };
  }
  const daysElapsed = diffInDays(input.cycleStartedAt, now);
  if (input.cycleStatus === "ACTIVE" && daysElapsed > stallDays) {
    return { shouldGenerate: false, reason: "CALENDAR_PAUSED_STALL" };
  }
  return { shouldGenerate: false, reason: "CYCLE_IN_PROGRESS" };
}
function evaluateAccess(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const trialDays = input.freeTrialDays ?? 7;
  if (input.hasActiveSubscription) {
    return {
      hasAccess: true,
      isTrial: false,
      trialDaysLeft: 0,
      reason: "SUBSCRIPTION"
    };
  }
  if (!input.trialStartedAt) {
    return {
      hasAccess: true,
      isTrial: true,
      trialDaysLeft: trialDays,
      reason: "TRIAL"
    };
  }
  const used = diffInDays(input.trialStartedAt, now);
  const left = Math.max(0, trialDays - used);
  if (left > 0) {
    return { hasAccess: true, isTrial: true, trialDaysLeft: left, reason: "TRIAL" };
  }
  return {
    hasAccess: false,
    isTrial: false,
    trialDaysLeft: 0,
    reason: "TRIAL_EXPIRED"
  };
}
function daysRemaining(expiresAt, now = /* @__PURE__ */ new Date()) {
  const ms = expiresAt.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 864e5);
}
function computeStreak(lastActiveDate, currentStreak, now = /* @__PURE__ */ new Date()) {
  if (!lastActiveDate)
    return { streak: 1, isNewDay: true };
  const gap = diffInDays(lastActiveDate, now);
  if (gap === 0)
    return { streak: currentStreak || 1, isNewDay: false };
  if (gap === 1)
    return { streak: (currentStreak || 0) + 1, isNewDay: true };
  return { streak: 1, isNewDay: true };
}
function scoreLesson(input) {
  const total = input.answers.length;
  if (total === 0) {
    return { score: 0, accuracy: 0, speedBonus: 0, isPerfect: false };
  }
  const correct = input.answers.filter((a) => a.isCorrect).length;
  const accuracy = round2(correct / total * 100);
  const fast = input.answers.filter(
    (a) => a.isCorrect && a.responseMs > 0 && a.responseMs < 5e3
  ).length;
  const speedBonus = round2(fast / total * 100);
  const hintPenalty = Math.min(20, input.usedHints * 4);
  const score = clamp(
    Math.round(accuracy * 0.7 + speedBonus * 0.3 - hintPenalty),
    0,
    100
  );
  return {
    score,
    accuracy,
    speedBonus,
    isPerfect: score >= 95 && input.usedHints === 0
  };
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
function diffInDays(from, to) {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / 864e5);
}
var init_engine = __esm({
  "../../packages/shared/src/engine/index.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_constants();
    __name(applyLeitnerReview, "applyLeitnerReview");
    __name(nextReviewDate, "nextReviewDate");
    __name(buildSkillDelta, "buildSkillDelta");
    __name(lessonKindForDay, "lessonKindForDay");
    __name(buildCycleDays, "buildCycleDays");
    __name(shouldGenerateNextCycle, "shouldGenerateNextCycle");
    __name(evaluateAccess, "evaluateAccess");
    __name(daysRemaining, "daysRemaining");
    __name(computeStreak, "computeStreak");
    __name(scoreLesson, "scoreLesson");
    __name(clamp, "clamp");
    __name(round2, "round2");
    __name(sum, "sum");
    __name(diffInDays, "diffInDays");
  }
});

// ../../packages/shared/src/index.ts
var init_src = __esm({
  "../../packages/shared/src/index.ts"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_types();
    init_schemas();
    init_constants();
    init_engine();
  }
});

// src/lib/provider-vault.ts
async function deriveKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt"
  ]);
}
function bytesToBase64(bytes) {
  let binary = "";
  for (const b of bytes)
    binary += String.fromCharCode(b);
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1)
    out[i] = binary.charCodeAt(i);
  return out;
}
async function encryptProviderKey(plaintext, masterSecret) {
  const key = await deriveKey(masterSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext)
    )
  );
  return `${FORMAT_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}
async function decryptProviderKey(stored, masterSecret) {
  try {
    if (!stored.startsWith(FORMAT_PREFIX))
      return null;
    const parts = stored.slice(FORMAT_PREFIX.length).split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1])
      return null;
    const iv = base64ToBytes(parts[0]);
    const ciphertext = base64ToBytes(parts[1]);
    const key = await deriveKey(masterSecret);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
function keyHint(plaintext) {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4)
    return "\u2022\u2022\u2022\u2022";
  return `\u2022\u2022\u2022\u2022${trimmed.slice(-4)}`;
}
async function resolveProviderKey(storedKey, envKey, masterSecret) {
  if (storedKey === FROM_ENV_MARKER) {
    return envKey ?? null;
  }
  if (!masterSecret)
    return null;
  return decryptProviderKey(storedKey, masterSecret);
}
var FORMAT_PREFIX, FROM_ENV_MARKER;
var init_provider_vault = __esm({
  "src/lib/provider-vault.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    FORMAT_PREFIX = "v1.";
    FROM_ENV_MARKER = "__FROM_ENV__";
    __name(deriveKey, "deriveKey");
    __name(bytesToBase64, "bytesToBase64");
    __name(base64ToBytes, "base64ToBytes");
    __name(encryptProviderKey, "encryptProviderKey");
    __name(decryptProviderKey, "decryptProviderKey");
    __name(keyHint, "keyHint");
    __name(resolveProviderKey, "resolveProviderKey");
  }
});

// src/services/ai-engine.ts
var ai_engine_exports = {};
__export(ai_engine_exports, {
  AiEngine: () => AiEngine,
  resolveProvider: () => resolveProvider,
  resolveProviderChain: () => resolveProviderChain
});
async function resolveProvider(row, env2) {
  const envKeyByName = {
    gemini: env2.GEMINI_API_KEY,
    deepseek: env2.DEEPSEEK_API_KEY,
    anthropic: env2.ANTHROPIC_API_KEY
  };
  const apiKey = row.api_key_encrypted === FROM_ENV_MARKER ? envKeyByName[row.vendor] ?? env2[`${row.vendor.toUpperCase()}_API_KEY`] : await resolveProviderKey(
    row.api_key_encrypted,
    void 0,
    env2.PROVIDER_ENCRYPTION_KEY
  );
  if (!apiKey)
    return null;
  const protocol = row.protocol;
  if (!["gemini", "openai_compatible", "anthropic"].includes(protocol))
    return null;
  return {
    id: row.id,
    label: row.label,
    protocol,
    vendor: row.vendor,
    model: row.model,
    baseUrl: row.base_url,
    apiKey,
    temperature: row.temperature === null ? null : Number(row.temperature),
    maxOutputTokens: row.max_output_tokens,
    supportsJsonSchema: row.supports_json_schema
  };
}
async function resolveProviderChain(rows, env2) {
  const ordered = [...rows].sort((a, b) => {
    if (a.priority !== b.priority)
      return a.priority - b.priority;
    return a.label.localeCompare(b.label);
  });
  const resolved = [];
  for (const row of ordered) {
    const provider = await resolveProvider(row, env2);
    if (provider)
      resolved.push(provider);
  }
  return resolved;
}
function buildSystemPrompt(input) {
  const uiLang = input.user.uiLanguage;
  const target = input.user.targetLanguage;
  return [
    `You are an expert adaptive language tutor building a 7-day micro-cycle.`,
    `Learner's native/UI language: ${uiLang}. Language being taught: ${target}.`,
    `Skill level: ${input.user.skillLevel}. Goal: ${input.user.learningGoal ?? "general fluency"}.`,
    ``,
    `PEDAGOGY \u2014 follow exactly:`,
    `- Days 1-5 are TEACHING. Part 1 = pattern-first induction using Substitution Drills.`,
    `  NEVER state grammar rules as formulas. Instead give a base sentence and interchangeable`,
    `  slots so the learner induces the pattern themselves.`,
    `  Part 2 = REAL_APPLICATION: the same pattern in a concrete real-world scenario.`,
    `- Day 6 is HIDDEN_ASSESSMENT. It MUST look and feel like a normal teaching day.`,
    `  Do NOT mention testing, exams, scores, or evaluation anywhere in user-visible text.`,
    `  Assess what days 1-5 taught using fresh contexts.`,
    `- Day 7 is CONSOLIDATION. Revisit ONLY the learner's weak terms with NEW examples`,
    `  (never repeat the original example sentence). End with encouragement.`,
    ``,
    `SPACED REPETITION:`,
    `- The learner has a 5-box Leitner system. Prioritise terms with box 1-2 or high lapse counts.`,
    `- Terms with box 5 are mastered: use them as scaffolding, do not re-teach them.`,
    ``,
    `LANGUAGE RULES:`,
    `- "meaning", "explanation", "scenario", "prompt" and translations are written in ${uiLang}.`,
    `- "term", "example", "options" content to be learned is in ${target}.`,
    `- "title" is in ${target}; "titleFa" is the same idea rendered in ${uiLang}.`,
    ``,
    `CALIBRATION:`,
    `- accuracy ${input.delta.accuracyPct}%, avg response ${input.delta.averageResponseMs}ms.`,
    `- If accuracy < 60%: smaller vocabulary per day, more repetition, shorter sentences.`,
    `- If accuracy > 90% and responses are fast: push complexity up a notch.`,
    ``,
    `Output ONE JSON object matching the provided schema. No markdown, no commentary.`
  ].join("\n");
}
function buildUserPrompt(input) {
  const d = input.delta;
  const lines = [];
  lines.push(`Build cycle #${input.cycleNumber} for this learner.`);
  lines.push("");
  lines.push(`PERFORMANCE SNAPSHOT:`);
  lines.push(`- answers: ${d.totalAnswers}, accuracy: ${d.accuracyPct}%`);
  lines.push(`- avg response time: ${d.averageResponseMs}ms, longest pause: ${d.maxPauseMs}ms`);
  lines.push(`- pace: ${d.paceAnswersPerMinute} answers/min`);
  if (d.hiddenAssessmentScore !== null) {
    lines.push(`- day-6 assessment result: ${d.hiddenAssessmentScore}%`);
  }
  if (d.weakTerms.length > 0) {
    lines.push("");
    lines.push(`WEAK TERMS \u2014 must appear in days 1-5 AND again in day 7 with new examples:`);
    for (const w of d.weakTerms.slice(0, 25)) {
      lines.push(`  \u2022 ${w.term} (box ${w.box}, ${w.lapses} lapses, fail rate ${Math.round(w.failRate * 100)}%)`);
    }
  }
  if (d.masteredTerms.length > 0) {
    lines.push("");
    lines.push(`MASTERED (scaffold only, do not re-teach): ${d.masteredTerms.slice(0, 30).join(", ")}`);
  }
  if (d.weakestAreas.length > 0) {
    lines.push("");
    lines.push(`WEAKEST AREAS \u2014 allocate most time here: ${d.weakestAreas.join(", ")}`);
  }
  if (d.strongestAreas.length > 0) {
    lines.push(`STRONGEST AREAS \u2014 can move faster: ${d.strongestAreas.join(", ")}`);
  }
  if (input.previousCycleSummary) {
    lines.push("");
    lines.push(`PREVIOUS CYCLE (do not duplicate its content or scenario):`);
    lines.push(input.previousCycleSummary);
  }
  lines.push("");
  lines.push(`Produce exactly 7 lessons: dayNumber 1..7, kind per the pedagogy rules,`);
  lines.push(`each with part1 (PATTERN_DRILL, 3-8 items) and part2 (REAL_APPLICATION, 2-6 questions).`);
  return lines.join("\n");
}
function buildRepairPrompt(originalPrompt, errors) {
  return [
    originalPrompt,
    "",
    "\u2500\u2500\u2500",
    "YOUR PREVIOUS RESPONSE FAILED SCHEMA VALIDATION.",
    "Fix these exact problems and return the corrected JSON object:",
    ...errors.slice(0, 12).map((e) => `  \u2717 ${e}`),
    "",
    "Return ONLY the corrected JSON object. Nothing else."
  ].join("\n");
}
function buildJsonSchema() {
  const str = /* @__PURE__ */ __name((description) => ({ type: "string", ...description ? { description } : {} }), "str");
  const patternDrillItem = {
    type: "object",
    properties: {
      term: str("The target-language word or phrase"),
      meaning: str("Meaning in the learner UI language"),
      pronunciation: str("Optional romanisation"),
      example: str("Example sentence in the target language"),
      exampleTranslation: str("Translation into the learner UI language"),
      substitution: {
        type: "object",
        properties: {
          base: str("Base sentence with a slot"),
          slots: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 }
        },
        required: ["base", "slots"]
      }
    },
    required: ["term", "meaning", "example"]
  };
  const patternDrillPart = {
    type: "object",
    properties: {
      type: { type: "string", enum: ["PATTERN_DRILL"] },
      explanation: str("Inductive explanation in the UI language \u2014 no grammar formulas"),
      pattern: str("Optional pattern template"),
      patternTranslation: str(),
      items: { type: "array", items: patternDrillItem, minItems: 3, maxItems: 12 },
      microExercises: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            id: str(),
            kind: { type: "string", enum: ["FILL_BLANK", "REORDER", "MATCH", "CHOOSE"] },
            prompt: str(),
            options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
            correctIndex: { type: "integer", minimum: 0, maximum: 5 },
            answer: str(),
            explanation: str()
          },
          required: ["id", "kind", "prompt"]
        }
      }
    },
    required: ["type", "explanation", "items"]
  };
  const realApplicationPart = {
    type: "object",
    properties: {
      type: { type: "string", enum: ["REAL_APPLICATION"] },
      scenario: str("Real-world scenario in the UI language"),
      scenarioTranslation: str(),
      dialogue: {
        type: "array",
        minItems: 0,
        maxItems: 20,
        items: {
          type: "object",
          properties: { speaker: str(), text: str(), translation: str() },
          required: ["speaker", "text"]
        }
      },
      questions: {
        type: "array",
        minItems: 2,
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            id: str(),
            prompt: str(),
            options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
            correctIndex: { type: "integer", minimum: 0, maximum: 4 },
            explanation: str(),
            linkedTerm: str("Term to record in the Leitner box")
          },
          required: ["id", "prompt", "options", "correctIndex"]
        }
      }
    },
    required: ["type", "scenario", "questions"]
  };
  const lesson = {
    type: "object",
    properties: {
      dayNumber: { type: "integer", minimum: 1, maximum: 7 },
      title: str("Target-language title"),
      titleFa: str("Title in the learner UI language"),
      kind: { type: "string", enum: ["TEACHING", "HIDDEN_ASSESSMENT", "CONSOLIDATION"] },
      part1: patternDrillPart,
      part2: realApplicationPart
    },
    required: ["dayNumber", "title", "titleFa", "kind", "part1", "part2"]
  };
  return {
    type: "object",
    properties: {
      title: str("Cycle title in the target language"),
      titleFa: str("Cycle title in the learner UI language"),
      focusSummary: str("One-paragraph summary in the UI language"),
      lessons: { type: "array", items: lesson, minItems: 7, maxItems: 7 }
    },
    required: ["title", "titleFa", "focusSummary", "lessons"]
  };
}
function enforceSchedule(cycle) {
  return {
    ...cycle,
    lessons: cycle.lessons.map((lesson) => {
      const expectedKind = CYCLE_SCHEDULE[lesson.dayNumber];
      return expectedKind ? { ...lesson, kind: expectedKind } : lesson;
    })
  };
}
function extractJson(text) {
  const trimmed = text.trim();
  const direct = tryParse(trimmed);
  if (direct !== void 0)
    return direct;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    const parsed = tryParse(fence[1].trim());
    if (parsed !== void 0)
      return parsed;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const parsed = tryParse(trimmed.slice(first, last + 1));
    if (parsed !== void 0)
      return parsed;
  }
  return null;
}
function tryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return void 0;
  }
}
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
var AiEngine;
var init_ai_engine = __esm({
  "src/services/ai-engine.ts"() {
    "use strict";
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_src();
    init_provider_vault();
    AiEngine = class {
      /**
       * @param env          Worker bindings (for decryption + env fallbacks)
       * @param providers    Active providers ordered by priority, decrypted.
       *                     Built by `loadProviders()` in the repository layer.
       */
      constructor(env2, providers = []) {
        this.env = env2;
        this.providers = providers;
      }
      get hasAnyProvider() {
        return this.providers.length > 0;
      }
      /** Provider labels in the order they will be tried, for logging. */
      get providerChain() {
        return this.providers.map((p) => `${p.label} (${p.model})`);
      }
      // ───────────────────────────────────────────────────────────────────
      // Public: generate a full 7-day cycle
      // ───────────────────────────────────────────────────────────────────
      async generateCycle(input) {
        const started = Date.now();
        const attempts = [];
        const systemPrompt = buildSystemPrompt(input);
        const userPrompt = buildUserPrompt(input);
        const jsonSchema = buildJsonSchema();
        for (const provider of this.providers) {
          const first = await this.attempt(provider, systemPrompt, userPrompt, jsonSchema, "initial");
          attempts.push(first.attempt);
          if (first.cycle) {
            return {
              cycle: first.cycle,
              attempts,
              model: `${provider.vendor}:${provider.model}`,
              totalMs: Date.now() - started
            };
          }
          const repairPrompt = buildRepairPrompt(userPrompt, first.errors ?? []);
          const second = await this.attempt(provider, systemPrompt, repairPrompt, jsonSchema, "repair");
          attempts.push(second.attempt);
          if (second.cycle) {
            return {
              cycle: second.cycle,
              attempts,
              model: `${provider.vendor}:${provider.model}:repaired`,
              totalMs: Date.now() - started
            };
          }
        }
        return { cycle: null, attempts, model: null, totalMs: Date.now() - started };
      }
      // ───────────────────────────────────────────────────────────────────
      // Single provider attempt + validation
      // ───────────────────────────────────────────────────────────────────
      async attempt(provider, systemPrompt, userPrompt, jsonSchema, phase) {
        const t0 = Date.now();
        const base = {
          provider: provider.label,
          providerId: provider.id,
          model: provider.model
        };
        try {
          const { text, tokensUsed } = await this.callProvider(
            provider,
            systemPrompt,
            userPrompt,
            jsonSchema
          );
          const parsed = extractJson(text);
          if (parsed === null) {
            return {
              cycle: null,
              errors: ["Response was not valid JSON. Return ONLY the JSON object."],
              attempt: {
                ...base,
                ok: false,
                ms: Date.now() - t0,
                error: "invalid_json",
                tokensUsed
              }
            };
          }
          const validation = validateWithDetail(generatedCycleSchema, parsed);
          if (!validation.success) {
            return {
              cycle: null,
              errors: validation.errors,
              attempt: {
                ...base,
                ok: false,
                ms: Date.now() - t0,
                error: `schema: ${validation.errors?.[0] ?? ""}`.slice(0, 200),
                tokensUsed
              }
            };
          }
          return {
            cycle: enforceSchedule(validation.data),
            attempt: { ...base, ok: true, ms: Date.now() - t0, tokensUsed }
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            cycle: null,
            errors: [`Provider error: ${message}`],
            attempt: {
              ...base,
              ok: false,
              ms: Date.now() - t0,
              error: message.slice(0, 200)
            }
          };
        }
      }
      // ───────────────────────────────────────────────────────────────────
      // Protocol dispatch
      // ───────────────────────────────────────────────────────────────────
      callProvider(provider, systemPrompt, userPrompt, jsonSchema) {
        switch (provider.protocol) {
          case "gemini":
            return this.callGemini(provider, systemPrompt, userPrompt, jsonSchema);
          case "openai_compatible":
            return this.callOpenAiCompatible(provider, systemPrompt, userPrompt);
          case "anthropic":
            return this.callAnthropic(provider, systemPrompt, userPrompt);
          default: {
            const never = provider.protocol;
            return Promise.reject(new Error(`Unsupported protocol: ${String(never)}`));
          }
        }
      }
      // ───────────────────────────────────────────────────────────────────
      // Providers
      // ───────────────────────────────────────────────────────────────────
      async callGemini(provider, systemPrompt, userPrompt, jsonSchema) {
        const base = provider.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
        const url = `${base.replace(/\/$/, "")}/models/${provider.model}:generateContent`;
        const generationConfig = {
          temperature: provider.temperature ?? 0.8,
          topP: 0.95,
          maxOutputTokens: provider.maxOutputTokens ?? 32768
        };
        if (provider.supportsJsonSchema) {
          generationConfig.responseMimeType = "application/json";
          generationConfig.responseSchema = jsonSchema;
        } else {
          generationConfig.responseMimeType = "application/json";
        }
        const res = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": provider.apiKey
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig,
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
              ]
            })
          },
          9e4
        );
        if (!res.ok) {
          throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
        const json = await res.json();
        const candidate = json.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
          throw new Error(`Gemini stopped: ${candidate.finishReason}`);
        }
        const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (!text)
          throw new Error("Gemini returned empty content");
        return { text, tokensUsed: json.usageMetadata?.totalTokenCount };
      }
      async callOpenAiCompatible(provider, systemPrompt, userPrompt) {
        const base = provider.baseUrl ?? "https://api.deepseek.com";
        const url = `${base.replace(/\/$/, "")}/chat/completions`;
        const res = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: provider.temperature ?? 0.8,
              max_tokens: provider.maxOutputTokens ?? 8192,
              response_format: { type: "json_object" }
            })
          },
          9e4
        );
        if (!res.ok) {
          throw new Error(
            `${provider.vendor} ${res.status}: ${(await res.text()).slice(0, 300)}`
          );
        }
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content ?? "";
        if (!text)
          throw new Error(`${provider.vendor} returned empty content`);
        return { text, tokensUsed: json.usage?.total_tokens };
      }
      async callAnthropic(provider, systemPrompt, userPrompt) {
        const base = provider.baseUrl ?? "https://api.anthropic.com";
        const url = `${base.replace(/\/$/, "")}/v1/messages`;
        const res = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": provider.apiKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: provider.model,
              max_tokens: provider.maxOutputTokens ?? 8192,
              temperature: provider.temperature ?? 0.8,
              system: systemPrompt,
              messages: [
                {
                  role: "user",
                  content: `${userPrompt}

Return ONLY a single valid JSON object. No prose, no markdown fences.`
                }
              ]
            })
          },
          9e4
        );
        if (!res.ok) {
          throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
        const json = await res.json();
        const text = json.content?.map((c) => c.text ?? "").join("") ?? "";
        if (!text)
          throw new Error("Anthropic returned empty content");
        return {
          text,
          tokensUsed: json.usage ? (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0) : void 0
        };
      }
    };
    __name(AiEngine, "AiEngine");
    __name(resolveProvider, "resolveProvider");
    __name(resolveProviderChain, "resolveProviderChain");
    __name(buildSystemPrompt, "buildSystemPrompt");
    __name(buildUserPrompt, "buildUserPrompt");
    __name(buildRepairPrompt, "buildRepairPrompt");
    __name(buildJsonSchema, "buildJsonSchema");
    __name(enforceSchedule, "enforceSchedule");
    __name(extractJson, "extractJson");
    __name(tryParse, "tryParse");
    __name(fetchWithTimeout, "fetchWithTimeout");
  }
});

// src/index.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/config.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DEFAULT_ENV = {
  AI_PRIMARY_MODEL: "gemini-2.5-flash",
  AI_FALLBACK_MODELS: "deepseek-chat,claude-3-5-sonnet-latest",
  ENABLE_PAYLOAD_ENCRYPTION: "false",
  RATE_LIMIT_PER_MINUTE: "60",
  RATE_LIMIT_PER_DAY: "2000",
  FREE_TRIAL_DAYS: "7",
  CYCLE_STALL_DAYS: "12",
  GATE_PATH: "/kpanah56/8fjg7rfb/v1/gate"
};
function withDefaults(env2) {
  const merged = { ...DEFAULT_ENV, ...env2 };
  merged.GATE_PATH = normalizePath(merged.GATE_PATH || DEFAULT_ENV.GATE_PATH);
  return merged;
}
__name(withDefaults, "withDefaults");
function normalizePath(p) {
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}
__name(normalizePath, "normalizePath");
function isEncryptionEnabled(env2) {
  return String(env2.ENABLE_PAYLOAD_ENCRYPTION ?? "false").toLowerCase() === "true";
}
__name(isEncryptionEnabled, "isEncryptionEnabled");
function numberEnv(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
__name(numberEnv, "numberEnv");

// src/lib/response.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function newRequestId() {
  return crypto.randomUUID();
}
__name(newRequestId, "newRequestId");
async function jsonSuccess(data, requestId, env2, init) {
  const payload = { ok: true, data, requestId, ts: Date.now() };
  return respond(payload, 200, env2, init);
}
__name(jsonSuccess, "jsonSuccess");
async function jsonError(code, message, requestId, env2, status = 400, userMessageKey) {
  const payload = {
    ok: false,
    error: { code, message, userMessageKey },
    requestId,
    ts: Date.now()
  };
  return respond(payload, status, env2, void 0, true);
}
__name(jsonError, "jsonError");
async function respond(payload, status, env2, init, isError = false) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cache-Control", "no-store");
  let body;
  if (isEncryptionEnabled(env2) && env2.PAYLOAD_ENCRYPTION_KEY) {
    body = JSON.stringify(await encryptPayload(payload, env2.PAYLOAD_ENCRYPTION_KEY));
    headers.set("X-Payload-Encrypted", "1");
  } else {
    body = JSON.stringify(payload);
  }
  return new Response(body, { status, headers });
}
__name(respond, "respond");
async function encryptPayload(payload, secret) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(payload))
    )
  );
  return { alg: "A256GCM", iv: toB64(iv), ct: toB64(ct) };
}
__name(encryptPayload, "encryptPayload");
function toB64(bytes) {
  let s = "";
  for (const b of bytes)
    s += String.fromCharCode(b);
  return btoa(s);
}
__name(toB64, "toB64");
async function readJson(request) {
  try {
    const text = await request.text();
    if (!text)
      return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
__name(readJson, "readJson");
function getBearerToken(request) {
  const auth = request.headers.get("Authorization");
  if (!auth)
    return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token)
    return null;
  return token;
}
__name(getBearerToken, "getBearerToken");
function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
}
__name(getClientIp, "getClientIp");
function clientOrigin(request) {
  return request.headers.get("Origin");
}
__name(clientOrigin, "clientOrigin");

// src/middleware/auth.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/lib/jwt.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/lib/telegram-auth.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();
async function validateInitData(initData, botToken, options = {}) {
  const maxAge = options.maxAgeSeconds ?? 86400;
  if (!initData || typeof initData !== "string") {
    return { ok: false, error: "initData is empty" };
  }
  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, error: "initData is not valid urlencoded data" };
  }
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, error: "hash parameter missing" };
  }
  const entries = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash" || key === "signature")
      continue;
    entries.push([key, value]);
  }
  entries.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    new TextEncoder().encode(botToken)
  );
  const expectedHash = bytesToHex(
    await hmacSha256(secretKey, new TextEncoder().encode(dataCheckString))
  );
  if (!timingSafeEqualHex(expectedHash, hash.toLowerCase())) {
    return { ok: false, error: "hash mismatch \u2014 initData was not signed by this bot" };
  }
  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : void 0;
  if (authDate !== void 0) {
    if (!Number.isFinite(authDate)) {
      return { ok: false, error: "auth_date is not a number" };
    }
    const ageSeconds = Math.floor(Date.now() / 1e3) - authDate;
    if (ageSeconds > maxAge) {
      return { ok: false, error: `initData expired (age ${ageSeconds}s)` };
    }
    if (ageSeconds < -300) {
      return { ok: false, error: "auth_date is in the future" };
    }
  }
  const userRaw = params.get("user");
  if (!userRaw) {
    return { ok: false, error: "user parameter missing" };
  }
  let userJson;
  try {
    userJson = JSON.parse(userRaw);
  } catch {
    return { ok: false, error: "user parameter is not valid JSON" };
  }
  const parsedUser = telegramInitDataUserSchema.safeParse(userJson);
  if (!parsedUser.success) {
    return {
      ok: false,
      error: `user payload invalid: ${parsedUser.error.issues[0]?.message ?? "unknown"}`
    };
  }
  return {
    ok: true,
    user: parsedUser.data,
    authDate,
    queryId: params.get("query_id") ?? void 0,
    startParam: params.get("start_param") ?? void 0
  };
}
__name(validateInitData, "validateInitData");
async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}
__name(hmacSha256, "hmacSha256");
function bytesToHex(bytes) {
  let out = "";
  for (const b of bytes)
    out += b.toString(16).padStart(2, "0");
  return out;
}
__name(bytesToHex, "bytesToHex");
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
__name(timingSafeEqualHex, "timingSafeEqualHex");
function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes)
    binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - padded.length % 4);
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlDecode, "base64UrlDecode");

// src/lib/jwt.ts
function encodeSegment(obj) {
  return base64UrlEncode(JSON.stringify(obj));
}
__name(encodeSegment, "encodeSegment");
function decodeSegment(segment) {
  try {
    const bytes = base64UrlDecode(segment);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
__name(decodeSegment, "decodeSegment");
async function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1e3);
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const signingInput = `${encodeSegment(header)}.${encodeSegment(body)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput))
  );
  return `${signingInput}.${base64UrlEncode(sig)}`;
}
__name(signJwt, "signJwt");
async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3)
    return { ok: false, error: "malformed" };
  const [headerSeg, payloadSeg, sigSeg] = parts;
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigSeg),
      new TextEncoder().encode(signingInput)
    );
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!valid)
    return { ok: false, error: "bad_signature" };
  const payload = decodeSegment(payloadSeg);
  if (!payload)
    return { ok: false, error: "malformed" };
  const now = Math.floor(Date.now() / 1e3);
  if (typeof payload.exp === "number" && payload.exp < now) {
    return { ok: false, error: "expired" };
  }
  return { ok: true, payload };
}
__name(verifyJwt, "verifyJwt");

// src/middleware/auth.ts
function resolveRoute(url) {
  const action = url.searchParams.get("action") ?? "";
  const internal = url.searchParams.get("internal") ?? "";
  const path = url.pathname;
  if (path.endsWith("/telegram/webhook")) {
    return { action: "telegram-webhook", routeClass: "PUBLIC" };
  }
  if (path.endsWith("/telegram/admin-webhook")) {
    return { action: "telegram-admin-webhook", routeClass: "PUBLIC" };
  }
  if (path.endsWith("/internal/queue")) {
    return { action: internal || "queue", routeClass: "INTERNAL" };
  }
  return { action, routeClass: routeClassForAction(action) };
}
__name(resolveRoute, "resolveRoute");
function routeClassForAction(action) {
  switch (action) {
    case "auth":
    case "health":
    case "plans":
      return "PUBLIC";
    case "admin-users":
    case "admin-user-detail":
    case "admin-gift":
    case "admin-revoke":
    case "admin-stats":
    case "admin-ai-providers":
    case "admin-ai-provider-create":
    case "admin-ai-provider-update":
    case "admin-ai-provider-delete":
    case "admin-ai-provider-reorder":
    case "admin-ai-provider-test":
      return "ADMIN";
    default:
      return "AUTHENTICATED";
  }
}
__name(routeClassForAction, "routeClassForAction");
async function authenticate(request, env2, requestId, routeClass) {
  const base = { env: env2, requestId };
  if (routeClass === "PUBLIC") {
    return { context: base };
  }
  if (routeClass === "INTERNAL") {
    const ok = await verifyQStash(request, env2);
    if (!ok) {
      return {
        context: base,
        error: await jsonError(
          "UNAUTHORIZED",
          "Invalid queue signature",
          requestId,
          env2,
          401
        )
      };
    }
    return { context: base };
  }
  const token = getBearerToken(request);
  if (!token) {
    return {
      context: base,
      error: await jsonError(
        "UNAUTHORIZED",
        "Missing bearer token",
        requestId,
        env2,
        401,
        "errors.session_expired"
      )
    };
  }
  const verified = await verifyJwt(token, env2.JWT_SECRET);
  if (!verified.ok) {
    const code = verified.error === "expired" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
    return {
      context: base,
      error: await jsonError(
        code,
        `Token rejected: ${verified.error}`,
        requestId,
        env2,
        401,
        "errors.session_expired"
      )
    };
  }
  const claims = verified.payload;
  if (routeClass === "ADMIN") {
    const isAdmin2 = await isAdminUser(claims.telegramId, env2);
    if (!isAdmin2) {
      return {
        context: base,
        error: await jsonError(
          "UNAUTHORIZED",
          "Admin privileges required",
          requestId,
          env2,
          403
        )
      };
    }
  }
  return {
    context: { ...base, claims, telegramId: claims.telegramId, userId: claims.userId }
  };
}
__name(authenticate, "authenticate");
async function isAdminUser(telegramId, env2) {
  const ids = (env2.TELEGRAM_ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  return ids.includes(telegramId);
}
__name(isAdminUser, "isAdminUser");
async function verifyQStash(request, env2) {
  const signature = request.headers.get("Upstash-Signature");
  if (!signature)
    return false;
  const keys = [env2.QSTASH_CURRENT_SIGNING_KEY, env2.QSTASH_NEXT_SIGNING_KEY].filter(
    (k) => Boolean(k)
  );
  if (keys.length === 0)
    return false;
  const body = await request.clone().text();
  for (const key of keys) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const parts = signature.split(".");
      if (parts.length !== 3)
        continue;
      const signingInput = `${parts[0]}.${parts[1]}`;
      const valid = await crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        base64UrlToBytes(parts[2]),
        new TextEncoder().encode(signingInput)
      );
      if (!valid)
        continue;
      const payload = JSON.parse(
        new TextDecoder().decode(base64UrlToBytes(parts[1]))
      );
      if (typeof payload.body === "string") {
        const expected = await sha256HexBase64(payload.body);
        const actual = await sha256HexBase64(body);
        if (expected !== actual)
          continue;
      }
      return true;
    } catch {
      continue;
    }
  }
  return false;
}
__name(verifyQStash, "verifyQStash");
function base64UrlToBytes(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - padded.length % 4);
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlToBytes, "base64UrlToBytes");
async function sha256HexBase64(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  let bin = "";
  for (const b of new Uint8Array(digest))
    bin += String.fromCharCode(b);
  return btoa(bin);
}
__name(sha256HexBase64, "sha256HexBase64");

// src/middleware/rate-limit.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var memoryStore = /* @__PURE__ */ new Map();
var lastSweep = 0;
async function enforceRateLimit(request, context2) {
  const { env: env2, requestId } = context2;
  const perMinute = numberEnv(env2.RATE_LIMIT_PER_MINUTE, 60);
  const perDay = numberEnv(env2.RATE_LIMIT_PER_DAY, 2e3);
  const ip = getClientIp(request);
  const userId = context2.telegramId ? String(context2.telegramId) : null;
  const minuteKey = `rl:min:${ip}`;
  const dayKey = userId ? `rl:day:${userId}` : `rl:day:ip:${ip}`;
  const minute = await bump(env2, minuteKey, 60, perMinute);
  if (!minute.allowed) {
    return rateLimited(env2, requestId, minute, "minute");
  }
  const day = await bump(env2, dayKey, 86400, perDay);
  if (!day.allowed) {
    return rateLimited(env2, requestId, day, "day");
  }
  return null;
}
__name(enforceRateLimit, "enforceRateLimit");
async function bump(env2, key, windowSeconds, limit) {
  if (env2.RATE_LIMIT_KV) {
    return bumpKV(env2.RATE_LIMIT_KV, key, windowSeconds, limit);
  }
  return bumpMemory(key, windowSeconds, limit);
}
__name(bump, "bump");
async function bumpKV(kv, key, windowSeconds, limit) {
  const now = Date.now();
  const raw = await kv.get(key);
  let counter = null;
  if (raw) {
    try {
      counter = JSON.parse(raw);
    } catch {
      counter = null;
    }
  }
  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, resetAt: now + windowSeconds * 1e3 };
  }
  counter.count += 1;
  const ttl = Math.max(1, Math.ceil((counter.resetAt - now) / 1e3) + 5);
  await kv.put(key, JSON.stringify(counter), { expirationTtl: ttl });
  return {
    allowed: counter.count <= limit,
    remaining: Math.max(0, limit - counter.count),
    resetAt: counter.resetAt,
    limit
  };
}
__name(bumpKV, "bumpKV");
function bumpMemory(key, windowSeconds, limit) {
  const now = Date.now();
  if (now - lastSweep > 6e4) {
    for (const [k, v] of memoryStore) {
      if (v.resetAt <= now)
        memoryStore.delete(k);
    }
    lastSweep = now;
  }
  let counter = memoryStore.get(key);
  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, resetAt: now + windowSeconds * 1e3 };
  }
  counter.count += 1;
  memoryStore.set(key, counter);
  return {
    allowed: counter.count <= limit,
    remaining: Math.max(0, limit - counter.count),
    resetAt: counter.resetAt,
    limit
  };
}
__name(bumpMemory, "bumpMemory");
async function rateLimited(env2, requestId, result, window) {
  const res = await jsonError(
    "RATE_LIMITED",
    `Rate limit exceeded (${window})`,
    requestId,
    env2,
    429,
    "errors.too_many_requests"
  );
  res.headers.set("Retry-After", String(Math.ceil((result.resetAt - Date.now()) / 1e3)));
  res.headers.set("X-RateLimit-Limit", String(result.limit));
  res.headers.set("X-RateLimit-Remaining", "0");
  return res;
}
__name(rateLimited, "rateLimited");

// src/middleware/content-filter.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();
function scanPayloadForInjection(value, options = {}) {
  const strict = options.strict ?? false;
  const strings = collectStrings(value);
  for (const s of strings) {
    if (s.length > SECURITY.maxPromptLength) {
      return { allowed: false, reason: "too_long", detail: s.slice(0, 80) };
    }
    if (/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/.test(s)) {
      return { allowed: false, reason: "blocked_pattern", detail: "invisible chars" };
    }
    if (strict) {
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(s)) {
          return { allowed: false, reason: "injection", detail: String(pattern) };
        }
      }
    }
  }
  return { allowed: true };
}
__name(scanPayloadForInjection, "scanPayloadForInjection");
function collectStrings(value, depth = 0) {
  if (depth > 6)
    return [];
  if (typeof value === "string")
    return [value];
  if (Array.isArray(value)) {
    return value.flatMap((v) => collectStrings(v, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(
      (v) => collectStrings(v, depth + 1)
    );
  }
  return [];
}
__name(collectStrings, "collectStrings");

// src/routes/auth.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();
init_src();

// src/services/repository.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();

// src/services/supabase.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var SupabaseClient = class {
  baseUrl;
  serviceKey;
  constructor(env2) {
    this.baseUrl = `${env2.SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
    this.serviceKey = env2.SUPABASE_SERVICE_ROLE_KEY;
  }
  headers(extra = {}) {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      "Content-Type": "application/json",
      ...extra
    };
  }
  // ── SELECT ────────────────────────────────────────────────────────
  async select(table3, query = {}, options = {}) {
    const url = new URL(`${this.baseUrl}/${table3}`);
    for (const [k, v] of Object.entries(query))
      url.searchParams.set(k, v);
    const headers = this.headers(
      options.single ? { Accept: "application/vnd.pgrst.object+json" } : {}
    );
    const res = await fetch(url.toString(), { method: "GET", headers });
    if (!options.single && (res.status === 200 || res.status === 206)) {
      return await res.json();
    }
    if (options.single && res.status === 200) {
      return await res.json();
    }
    if (res.status === 404 || res.status === 406 || res.status === 200) {
      return null;
    }
    throw new SupabaseError(res.status, await res.text(), `${table3} select`);
  }
  // ── INSERT ────────────────────────────────────────────────────────
  async insert(table3, rows, options = {}) {
    const url = new URL(`${this.baseUrl}/${table3}`);
    const prefer = [];
    if (options.returning !== false)
      prefer.push("return=representation");
    if (options.upsertOn) {
      prefer.push("resolution=merge-duplicates");
      url.searchParams.set("on_conflict", options.upsertOn);
    }
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: this.headers({ Prefer: prefer.join(",") }),
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `${table3} insert`);
    }
    if (options.returning === false)
      return null;
    const json = await res.json();
    return Array.isArray(rows) ? json : json[0] ?? null;
  }
  // ── UPDATE ────────────────────────────────────────────────────────
  async update(table3, match, patch, options = {}) {
    const url = new URL(`${this.baseUrl}/${table3}`);
    for (const [k, v] of Object.entries(match))
      url.searchParams.set(k, `eq.${v}`);
    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: this.headers({ Prefer: "return=representation" }),
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `${table3} update`);
    }
    const json = await res.json();
    if (json.length === 0)
      return null;
    return options.single ? json[0] : json[0];
  }
  // ── DELETE ────────────────────────────────────────────────────────
  async delete(table3, match) {
    const url = new URL(`${this.baseUrl}/${table3}`);
    for (const [k, v] of Object.entries(match))
      url.searchParams.set(k, `eq.${v}`);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.headers({ Prefer: "return=minimal" })
    });
    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `${table3} delete`);
    }
  }
  // ── RPC ───────────────────────────────────────────────────────────
  async rpc(fn, args = {}) {
    const res = await fetch(`${this.baseUrl}/rpc/${fn}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(args)
    });
    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `rpc ${fn}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  // ── COUNT ─────────────────────────────────────────────────────────
  async count(table3, query = {}) {
    const url = new URL(`${this.baseUrl}/${table3}`);
    url.searchParams.set("select", "id");
    for (const [k, v] of Object.entries(query))
      url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
      method: "HEAD",
      headers: this.headers({ Prefer: "count=exact", Range: "0-0" })
    });
    const range = res.headers.get("Content-Range");
    if (!range)
      return 0;
    const total = range.split("/")[1];
    return total ? Number(total) : 0;
  }
};
__name(SupabaseClient, "SupabaseClient");
var SupabaseError = class extends Error {
  constructor(status, body, op) {
    const isNotFound = status === 404 || body.includes("PGRST116");
    super(`Supabase ${op} failed [${status}]${isNotFound ? " (not found)" : ""}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
    this.op = op;
    this.name = "SupabaseError";
  }
  get isNotFound() {
    return this.status === 404 || this.body.includes("PGRST116");
  }
  get isConflict() {
    return this.status === 409;
  }
};
__name(SupabaseError, "SupabaseError");

// src/services/repository.ts
var ContentRepository = class {
  constructor(db, env2) {
    this.db = db;
    this.env = env2;
  }
  // ── USERS ─────────────────────────────────────────────────────────
  async findUserByTelegramId(telegramId) {
    try {
      const row = await this.db.select(
        "users",
        { telegram_id: `eq.${telegramId}`, select: "*" },
        { single: true }
      );
      return row ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound)
        return null;
      throw err;
    }
  }
  async findUserById(id) {
    try {
      const row = await this.db.select(
        "users",
        { id: `eq.${id}`, select: "*" },
        { single: true }
      );
      return row ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound)
        return null;
      throw err;
    }
  }
  async upsertUser(input) {
    const existing = await this.findUserByTelegramId(input.telegramId);
    if (existing) {
      const patch = {
        first_name: input.firstName,
        last_name: input.lastName ?? null,
        username: input.username ?? null,
        photo_url: input.photoUrl ?? null
      };
      if (existing.language_source === "TELEGRAM") {
        patch.ui_language = input.uiLanguage;
      }
      return await this.db.update(
        "users",
        { id: existing.id },
        patch,
        { single: true }
      );
    }
    const created = await this.db.insert("users", {
      telegram_id: input.telegramId,
      first_name: input.firstName,
      last_name: input.lastName ?? null,
      username: input.username ?? null,
      photo_url: input.photoUrl ?? null,
      ui_language: input.uiLanguage,
      language_source: input.languageSource,
      skill_level: "ZERO",
      onboarding_done: false
    });
    return created;
  }
  async updateUser(userId, patch) {
    return this.db.update("users", { id: userId }, patch, { single: true });
  }
  async deleteUser(userId) {
    await this.db.delete("users", { id: userId });
  }
  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────
  async getActiveSubscription(userId) {
    const rows = await this.db.select("subscriptions", {
      user_id: `eq.${userId}`,
      status: "eq.ACTIVE",
      expires_at: `gt.${(/* @__PURE__ */ new Date()).toISOString()}`,
      order: "expires_at.desc",
      limit: "1",
      select: "*"
    });
    return rows[0] ?? null;
  }
  async getLatestSubscription(userId) {
    const rows = await this.db.select("subscriptions", {
      user_id: `eq.${userId}`,
      order: "created_at.desc",
      limit: "1",
      select: "*"
    });
    return rows[0] ?? null;
  }
  async createSubscription(input) {
    const now = /* @__PURE__ */ new Date();
    let startsAt = input.startsAt ?? now;
    if (input.extend) {
      const active = await this.getActiveSubscription(input.userId);
      if (active && new Date(active.expires_at) > startsAt) {
        startsAt = new Date(active.expires_at);
      }
    }
    const expiresAt = input.expiresAt ?? addDays(startsAt, PLAN_DURATION_DAYS[input.planType] ?? 30);
    const created = await this.db.insert("subscriptions", {
      user_id: input.userId,
      plan_type: input.planType,
      status: "ACTIVE",
      source: input.source,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      granted_by: input.grantedBy ?? null,
      grant_note: input.grantNote ?? null,
      price_stars: input.priceStars ?? null,
      payment_ref: input.paymentRef ?? null
    });
    return created;
  }
  async expireSubscription(subscriptionId) {
    await this.db.update("subscriptions", { id: subscriptionId }, { status: "EXPIRED" });
  }
  // ── CYCLES ────────────────────────────────────────────────────────
  async getActiveCycle(userId) {
    const rows = await this.db.select("cycles", {
      user_id: `eq.${userId}`,
      status: "eq.ACTIVE",
      order: "cycle_number.desc",
      limit: "1",
      select: "*"
    });
    return rows[0] ?? null;
  }
  async getGeneratingCycle(userId) {
    const rows = await this.db.select("cycles", {
      user_id: `eq.${userId}`,
      status: "in.(GENERATING,FAILED)",
      order: "cycle_number.desc",
      limit: "1",
      select: "*"
    });
    return rows[0] ?? null;
  }
  async getLatestCycle(userId) {
    const rows = await this.db.select("cycles", {
      user_id: `eq.${userId}`,
      order: "cycle_number.desc",
      limit: "1",
      select: "*"
    });
    return rows[0] ?? null;
  }
  async getCycleById(cycleId) {
    try {
      const row = await this.db.select(
        "cycles",
        { id: `eq.${cycleId}`, select: "*" },
        { single: true }
      );
      return row ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound)
        return null;
      throw err;
    }
  }
  async createGeneratingCycle(userId, cycleNumber) {
    const created = await this.db.insert("cycles", {
      user_id: userId,
      cycle_number: cycleNumber,
      title: `Cycle ${cycleNumber}`,
      status: "GENERATING"
    });
    return created;
  }
  /**
   * نوشتن چرخه تولیدشده + ۷ درس آن به‌صورت اتمی‌نما.
   * اگر درس‌ها fail شود، چرخه به FAILED می‌رود.
   */
  async persistGeneratedCycle(cycleId, generated, meta) {
    await this.db.update("cycles", { id: cycleId }, {
      title: generated.title,
      title_fa: generated.titleFa,
      focus_summary: generated.focusSummary,
      status: "ACTIVE",
      started_at: (/* @__PURE__ */ new Date()).toISOString(),
      generated_from: meta.input.delta,
      generation_model: meta.model,
      generation_ms: meta.ms,
      generation_tokens: meta.tokens ?? null
    });
    const cycle = await this.getCycleById(cycleId);
    if (!cycle)
      throw new Error(`Cycle ${cycleId} vanished after update`);
    const rows = generated.lessons.map((lesson, index) => ({
      cycle_id: cycleId,
      user_id: cycle.user_id,
      day_number: lesson.dayNumber,
      title: lesson.title,
      title_fa: lesson.titleFa,
      kind: lesson.kind,
      part_1_data: lesson.part1,
      part_2_data: lesson.part2,
      status: lesson.dayNumber === 1 ? "AVAILABLE" : "LOCKED",
      is_completed: false,
      _order: index
    }));
    await this.db.insert("lessons", rows.map(({ _order, ...r }) => r));
  }
  // ── LESSONS ───────────────────────────────────────────────────────
  async getLessonsForCycle(cycleId) {
    const rows = await this.db.select("lessons", {
      cycle_id: `eq.${cycleId}`,
      order: "day_number.asc",
      select: "*"
    });
    return rows ?? [];
  }
  async getLessonById(lessonId) {
    try {
      const row = await this.db.select(
        "lessons",
        { id: `eq.${lessonId}`, select: "*" },
        { single: true }
      );
      return row ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound)
        return null;
      throw err;
    }
  }
  /** درس جاری قابل انجام = اولین درس تکمیل‌نشده */
  async getCurrentLesson(userId) {
    const cycle = await this.getActiveCycle(userId);
    if (!cycle)
      return null;
    const lessons = await this.getLessonsForCycle(cycle.id);
    const next = lessons.find((l) => !l.is_completed);
    if (!next)
      return null;
    return { cycle, lesson: next };
  }
  async completeLesson(lessonId, patch) {
    await this.db.update("lessons", { id: lessonId }, {
      is_completed: true,
      status: "COMPLETED",
      completed_at: (/* @__PURE__ */ new Date()).toISOString(),
      duration_seconds: patch.durationSeconds
    });
  }
  /** آزادسازی درس بعدی پس از تکمیل */
  async unlockNextLesson(cycleId, completedDay) {
    if (completedDay >= CYCLE_LENGTH_DAYS)
      return;
    const lessons = await this.getLessonsForCycle(cycleId);
    const next = lessons.find((l) => l.day_number === completedDay + 1);
    if (next && !next.is_completed) {
      await this.db.update("lessons", { id: next.id }, { status: "AVAILABLE" });
    }
  }
  async markCycleCompleted(cycleId) {
    await this.db.update("cycles", { id: cycleId }, {
      status: "COMPLETED",
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  // ── TELEMETRY ────────────────────────────────────────────────────
  async insertTelemetry(rows) {
    if (rows.length === 0)
      return;
    await this.db.insert("telemetry_events", rows);
  }
  async getTelemetryForCycle(cycleId) {
    const rows = await this.db.select("telemetry_events", {
      cycle_id: `eq.${cycleId}`,
      select: "event_type,item_id,is_correct,response_ms,pause_ms",
      limit: "5000"
    });
    return rows ?? [];
  }
  // ── LEXICAL (Leitner) ────────────────────────────────────────────
  async getLexicalItems(userId, targetLanguage) {
    const rows = await this.db.select("lexical_items", {
      user_id: `eq.${userId}`,
      target_language: `eq.${targetLanguage}`,
      select: "term,box,ease,lapses,repetitions,success_count,fail_count,mastered",
      limit: "2000"
    });
    return rows ?? [];
  }
  async upsertLexicalItem(userId, targetLanguage, item) {
    await this.db.insert(
      "lexical_items",
      {
        user_id: userId,
        target_language: targetLanguage,
        term: item.term,
        meaning_fa: item.meaning ?? null,
        example: item.example ?? null,
        box: item.box,
        ease: item.ease,
        repetitions: item.repetitions,
        lapses: item.lapses,
        interval_days: item.intervalDays,
        mastered: item.mastered,
        success_count: item.successCount,
        fail_count: item.failCount,
        last_reviewed_at: (/* @__PURE__ */ new Date()).toISOString(),
        next_review_at: item.nextReviewAt
      },
      { upsertOn: "user_id,target_language,term", returning: false }
    );
  }
  // ── PLANS ────────────────────────────────────────────────────────
  async getPlans() {
    const rows = await this.db.select("plans", {
      is_active: "eq.true",
      order: "sort_order.asc",
      select: "*"
    });
    return (rows ?? []).map((r) => {
      const priceIrr = Number(r.price_irr);
      const discount = r.discount_percent;
      return {
        id: r.id,
        planType: r.plan_type,
        titleFa: r.title_fa,
        titleEn: r.title_en,
        durationDays: r.duration_days,
        priceIrr,
        priceStars: r.price_stars,
        discountPercent: discount,
        finalPriceIrr: Math.round(priceIrr * (1 - discount / 100)),
        finalPriceStars: Math.round(r.price_stars * (1 - discount / 100)),
        badge: r.badge,
        isActive: r.is_active
      };
    });
  }
  async getPlanById(planId) {
    try {
      const row = await this.db.select(
        "plans",
        { id: `eq.${planId}`, select: "*" },
        { single: true }
      );
      return row ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound)
        return null;
      throw err;
    }
  }
  // ── STAR TRANSACTIONS ────────────────────────────────────────────
  async recordStarPayment(input) {
    try {
      await this.db.insert("star_transactions", {
        user_id: input.userId,
        subscription_id: input.subscriptionId,
        telegram_charge_id: input.telegramChargeId,
        provider_charge_id: input.providerChargeId ?? null,
        amount_stars: input.amountStars,
        plan_type: input.planType,
        currency: "XTR",
        raw_payload: input.rawPayload
      });
      return true;
    } catch (err) {
      if (err instanceof SupabaseError && err.isConflict)
        return false;
      throw err;
    }
  }
  async findStarTransactionByChargeId(chargeId) {
    const rows = await this.db.select("star_transactions", {
      telegram_charge_id: `eq.${chargeId}`,
      select: "id",
      limit: "1"
    });
    return rows[0] ?? null;
  }
  // ── ADMIN ────────────────────────────────────────────────────────
  async listUsersForAdmin(limit, offset, search) {
    const query = {
      order: "created_at.desc",
      limit: String(limit),
      offset: String(offset),
      select: "id,telegram_id,first_name,last_name,username,skill_level,streak_count,created_at"
    };
    if (search) {
      const term = search.replace(/[%,]/g, "");
      if (/^\d+$/.test(term)) {
        query.telegram_id = `eq.${term}`;
      } else {
        query.or = `(username.ilike.*${term}*,first_name.ilike.*${term}*)`;
      }
    }
    const rows = await this.db.select("users", query);
    const users = rows ?? [];
    return Promise.all(
      users.map(async (u) => {
        const sub = await this.getActiveSubscription(u.id);
        const cycle = await this.getActiveCycle(u.id);
        return {
          id: u.id,
          telegramId: u.telegram_id,
          displayName: [u.first_name, u.last_name].filter(Boolean).join(" ") || "\u2014",
          username: u.username,
          skillLevel: u.skill_level,
          planType: sub?.plan_type ?? null,
          daysRemaining: sub ? daysRemaining(new Date(sub.expires_at)) : 0,
          streakCount: u.streak_count,
          cycleNumber: cycle?.cycle_number ?? null,
          createdAt: u.created_at
        };
      })
    );
  }
  async logAdminGrant(input) {
    await this.db.insert("admin_grants", {
      admin_user_id: input.adminUserId,
      target_user_id: input.targetUserId,
      subscription_id: input.subscriptionId,
      action: input.action,
      plan_type: input.planType ?? null,
      days_delta: input.daysDelta ?? null,
      note: input.note ?? null
    });
  }
  async adminStats() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const [totalUsers, activeSubscriptions, receiptsPending] = await Promise.all([
      this.db.count("users"),
      this.db.count("subscriptions", { status: "eq.ACTIVE", expires_at: `gt.${now}` }),
      this.db.count("payment_receipts", { status: "eq.PENDING" })
    ]);
    return {
      totalUsers,
      activeSubscriptions,
      trialsActive: 0,
      receiptsPending
    };
  }
  // ── SETTINGS ─────────────────────────────────────────────────────
  async getSetting(key) {
    try {
      const row = await this.db.select(
        "app_settings",
        { key: `eq.${key}`, select: "value" },
        { single: true }
      );
      return row?.value ?? null;
    } catch {
      return null;
    }
  }
  // ── AI PROVIDERS ─────────────────────────────────────────────────
  //
  // The admin panel owns this table. Ordering is applied in the engine
  // (see resolveProviderChain) so a single rule governs both the UI list
  // and the actual failover chain.
  /** Active providers, ordered. Used by the engine on every generation. */
  async listActiveAiProviders() {
    try {
      const rows = await this.db.select("ai_providers", {
        is_active: "eq.true",
        select: "*",
        order: "priority.asc,created_at.asc"
      });
      return rows;
    } catch {
      return [];
    }
  }
  /** Every provider regardless of state, for the admin panel. */
  async listAllAiProviders() {
    try {
      const rows = await this.db.select("ai_providers", {
        select: "*",
        order: "priority.asc,created_at.asc"
      });
      return rows;
    } catch {
      return [];
    }
  }
  async createAiProvider(input) {
    const rows = await this.db.insert("ai_providers", {
      label: input.label,
      protocol: input.protocol,
      vendor: input.vendor,
      model: input.model,
      base_url: input.baseUrl,
      api_key_encrypted: input.apiKeyEncrypted,
      key_hint: input.keyHint,
      priority: input.priority,
      is_active: input.isActive,
      temperature: input.temperature,
      max_output_tokens: input.maxOutputTokens,
      supports_json_schema: input.supportsJsonSchema,
      note: input.note
    });
    return rows[0] ?? null;
  }
  /**
   * Partial update. `apiKeyEncrypted` is only present when the admin pasted a
   * new key — omitting it leaves the stored one untouched, which is what the
   * UI expects when you edit a label without re-entering the secret.
   */
  async updateAiProvider(id, patch) {
    const row = await this.db.update(
      "ai_providers",
      { id: `eq.${id}` },
      patch
    );
    return row ?? null;
  }
  async deleteAiProvider(id) {
    await this.db.delete("ai_providers", { id: `eq.${id}` });
  }
  async getAiProviderById(id) {
    try {
      const row = await this.db.select(
        "ai_providers",
        { id: `eq.${id}`, select: "*" },
        { single: true }
      );
      return row ?? null;
    } catch {
      return null;
    }
  }
  /**
   * Record the outcome of one provider attempt and roll the health counters.
   *
   * A success clears the consecutive-failure streak (a provider that recovers
   * should stop looking "failing"); a failure increments it. The status band
   * is derived from that streak so the panel shows at-a-glance state without
   * the engine having to store a separate flag.
   */
  async recordProviderOutcome(input) {
    try {
      await this.db.insert("ai_attempt_log", {
        cycle_id: input.cycleId,
        provider_id: input.providerId,
        provider_label: input.providerLabel,
        model: input.model,
        attempt_no: input.attemptNo,
        phase: input.phase,
        ok: input.ok,
        latency_ms: input.latencyMs,
        error: input.error ?? null,
        tokens_used: input.tokensUsed ?? null
      });
    } catch {
    }
    if (!input.providerId)
      return;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const patch = input.ok ? {
      health_status: "healthy",
      last_success_at: now,
      consecutive_failures: 0,
      total_successes: input.totalSuccesses ?? 0,
      avg_latency_ms: input.latencyMs
    } : {
      last_failure_at: now,
      last_error: input.error ?? "unknown error",
      consecutive_failures: input.consecutiveFailures ?? 0,
      total_failures: input.totalFailures ?? 0
    };
    if (!input.ok) {
      const streak = input.consecutiveFailures ?? 0;
      patch.health_status = streak >= 5 ? "failing" : streak >= 2 ? "degraded" : "unknown";
    }
    try {
      await this.db.update("ai_providers", { id: `eq.${input.providerId}` }, patch);
    } catch {
    }
  }
  /** Recent failover history for the admin panel. */
  async listAiAttempts(limit = 50) {
    try {
      const rows = await this.db.select("ai_attempt_log", {
        select: "*",
        order: "created_at.desc",
        limit: String(limit)
      });
      return rows;
    } catch {
      return [];
    }
  }
};
__name(ContentRepository, "ContentRepository");
function toUserProfile(user, subscription, opts) {
  const subInfo = subscription ? {
    planType: subscription.plan_type,
    status: subscription.status,
    startsAt: subscription.starts_at,
    expiresAt: subscription.expires_at,
    daysRemaining: daysRemaining(new Date(subscription.expires_at)),
    source: subscription.source
  } : null;
  const access = evaluateAccess({
    hasActiveSubscription: Boolean(subscription),
    trialStartedAt: new Date(user.created_at)
  });
  return {
    id: user.id,
    telegramId: user.telegram_id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    photoUrl: user.photo_url,
    uiLanguage: user.ui_language ?? "fa",
    languageSource: user.language_source,
    targetLanguage: user.target_language,
    skillLevel: user.skill_level,
    learningGoal: user.learning_goal,
    onboardingDone: user.onboarding_done,
    streakCount: user.streak_count,
    longestStreak: user.longest_streak,
    starsBalance: user.stars_balance,
    isAdmin: opts.isAdmin,
    createdAt: user.created_at,
    subscription: subInfo,
    hasAccess: access.hasAccess
  };
}
__name(toUserProfile, "toUserProfile");
function toCycleDto(cycle, lessons) {
  const completedDays = lessons.filter((l) => l.is_completed).map((l) => l.day_number);
  const titles = {};
  for (const l of lessons)
    titles[l.day_number] = l.title;
  const days = buildCycleDays({
    cycleStatus: cycle.status,
    completedDays,
    lessonTitles: titles
  });
  const currentDay = days.find((d) => d.isActive)?.dayNumber ?? null;
  return {
    id: cycle.id,
    cycleNumber: cycle.cycle_number,
    title: cycle.title,
    titleFa: cycle.title_fa,
    focusSummary: cycle.focus_summary,
    status: cycle.status,
    progress: {
      completedDays: completedDays.length,
      totalDays: CYCLE_LENGTH_DAYS,
      currentDay
    },
    days,
    startedAt: cycle.started_at,
    completedAt: cycle.completed_at
  };
}
__name(toCycleDto, "toCycleDto");
function toLessonDto(row) {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    dayNumber: row.day_number,
    title: row.title,
    titleFa: row.title_fa,
    kind: row.kind,
    part1: row.part_1_data,
    part2: row.part_2_data,
    status: row.status,
    isCompleted: row.is_completed,
    durationSeconds: row.duration_seconds
  };
}
__name(toLessonDto, "toLessonDto");
function buildProgressDashboard(input) {
  const answers = input.telemetry.filter((t) => t.event_type === "ANSWER");
  const correct = answers.filter((a) => a.is_correct === true).length;
  const accuracyPct = answers.length ? Math.round(correct / answers.length * 1e3) / 10 : 0;
  const pauses = input.telemetry.filter((t) => t.event_type === "PAUSE" || t.event_type === "ANSWER").map((t) => t.pause_ms ?? 0);
  const totalPauseMs = pauses.reduce((a, b) => a + b, 0);
  const masteredWords = input.lexical.filter((l) => l.mastered).length;
  const learningWords = input.lexical.filter((l) => !l.mastered).length;
  return {
    accuracyPct,
    lessonsCompleted: input.lessonsCompleted,
    totalMinutes: Math.round(totalPauseMs / 6e4),
    masteredWords,
    learningWords,
    streakCount: input.streakCount,
    qualitativeSkills: buildQualitativeSkills({
      lessonsCompleted: input.lessonsCompleted,
      masteredWords,
      accuracyPct
    }),
    weeklyActivity: input.weeklyMinutes.map((minutes, i) => ({
      day: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"][i] ?? `d${i}`,
      minutes,
      completed: minutes > 0
    })),
    skillBreakdown: buildSkillBreakdown(input.lexical, accuracyPct)
  };
}
__name(buildProgressDashboard, "buildProgressDashboard");
function buildQualitativeSkills(input) {
  const { lessonsCompleted, masteredWords, accuracyPct } = input;
  const defs = [
    {
      key: "greetings",
      icon: "\u{1F44B}",
      labelFa: "\u0633\u0644\u0627\u0645 \u0648 \u0627\u062D\u0648\u0627\u0644\u200C\u067E\u0631\u0633\u06CC \u0648 \u0645\u0639\u0631\u0641\u06CC \u062E\u0648\u062F\u062A",
      labelEn: "Greetings and introducing yourself",
      unlocked: lessonsCompleted >= 7,
      condition: lessonsCompleted >= 7
    },
    {
      key: "hotel",
      icon: "\u{1F3E8}",
      labelFa: "\u0631\u0632\u0631\u0648 \u0647\u062A\u0644 \u0648 \u0635\u062D\u0628\u062A \u062F\u0631 \u067E\u0630\u06CC\u0631\u0634",
      labelEn: "Hotel booking and check-in",
      unlocked: lessonsCompleted >= 14,
      condition: lessonsCompleted >= 14
    },
    {
      key: "directions",
      icon: "\u{1F5FA}\uFE0F",
      labelFa: "\u067E\u0631\u0633\u06CC\u062F\u0646 \u0622\u062F\u0631\u0633 \u0648 \u0645\u0633\u06CC\u0631",
      labelEn: "Asking for directions",
      unlocked: lessonsCompleted >= 21,
      condition: lessonsCompleted >= 21
    },
    {
      key: "negotiation",
      icon: "\u{1F4BC}",
      labelFa: "\u0645\u0630\u0627\u06A9\u0631\u0647 \u0648 \u0627\u0639\u0644\u0627\u0645 \u0642\u06CC\u0645\u062A \u062F\u0631 \u062C\u0644\u0633\u0627\u062A \u06A9\u0627\u0631\u06CC",
      labelEn: "Negotiating and quoting in meetings",
      unlocked: lessonsCompleted >= 28 && accuracyPct >= 70,
      condition: lessonsCompleted >= 28 && accuracyPct >= 70
    },
    {
      key: "fluency",
      icon: "\u{1F680}",
      labelFa: "\u0645\u06A9\u0627\u0644\u0645\u0647 \u0631\u0648\u0627\u0646 \u0628\u062F\u0648\u0646 \u0645\u06A9\u062B \u0637\u0648\u0644\u0627\u0646\u06CC",
      labelEn: "Fluent conversation without long pauses",
      unlocked: accuracyPct >= 85 && masteredWords >= 60,
      condition: accuracyPct >= 85 && masteredWords >= 60
    }
  ];
  return defs.map(({ condition, ...skill }) => ({ ...skill, unlocked: condition }));
}
__name(buildQualitativeSkills, "buildQualitativeSkills");
function buildSkillBreakdown(lexical, accuracyPct) {
  const byBox = [1, 2, 3, 4, 5].map(
    (box) => lexical.filter((l) => l.box === box).length
  );
  const total = lexical.length || 1;
  const vocabulary = lexical.length ? Math.round((byBox[3] + byBox[4]) / total * 100) : 0;
  return [
    { area: "vocabulary", score: vocabulary },
    { area: "accuracy", score: Math.round(accuracyPct) },
    { area: "retention", score: Math.round(lexical.filter((l) => l.repetitions > 1).length / total * 100) },
    { area: "consistency", score: Math.min(100, Math.round(byBox[4] / total * 200)) }
  ];
}
__name(buildSkillBreakdown, "buildSkillBreakdown");
function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
__name(addDays, "addDays");

// src/routes/admin.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();
function isAdminFromEnv(env2, telegramId) {
  const ids = (env2.TELEGRAM_ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  return ids.includes(telegramId);
}
__name(isAdminFromEnv, "isAdminFromEnv");
function repo(env2) {
  return new ContentRepository(new SupabaseClient(env2), env2);
}
__name(repo, "repo");
async function handleAdminUsers(request, context2) {
  const { env: env2, requestId } = context2;
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), 1, 100, 25);
  const offset = clampInt(url.searchParams.get("offset"), 0, 1e5, 0);
  const search = url.searchParams.get("q") ?? void 0;
  const r = repo(env2);
  const users = await r.listUsersForAdmin(limit, offset, search);
  return jsonSuccess({ users, limit, offset }, requestId, env2);
}
__name(handleAdminUsers, "handleAdminUsers");
async function handleAdminUserDetail(request, context2) {
  const { env: env2, requestId } = context2;
  const url = new URL(request.url);
  const telegramId = Number(url.searchParams.get("telegramId"));
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    return jsonError("VALIDATION_ERROR", "telegramId is required", requestId, env2, 400);
  }
  const r = repo(env2);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user) {
    return jsonError("NOT_FOUND", "User not found", requestId, env2, 404);
  }
  const [subscription, latest, cycle, lexical, stats] = await Promise.all([
    r.getActiveSubscription(user.id),
    r.getLatestSubscription(user.id),
    r.getActiveCycle(user.id),
    r.getLexicalItems(user.id, user.target_language),
    r.getTelemetryForCycle("00000000-0000-0000-0000-000000000000")
  ]);
  return jsonSuccess(
    {
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        uiLanguage: user.ui_language,
        targetLanguage: user.target_language,
        skillLevel: user.skill_level,
        learningGoal: user.learning_goal,
        onboardingDone: user.onboarding_done,
        streakCount: user.streak_count,
        longestStreak: user.longest_streak,
        starsBalance: user.stars_balance,
        isBlocked: user.is_blocked,
        createdAt: user.created_at
      },
      subscription: subscription ? {
        id: subscription.id,
        planType: subscription.plan_type,
        status: subscription.status,
        source: subscription.source,
        startsAt: subscription.starts_at,
        expiresAt: subscription.expires_at
      } : null,
      lastSubscription: latest ? { planType: latest.plan_type, status: latest.status, expiresAt: latest.expires_at } : null,
      cycle: cycle ? { id: cycle.id, cycleNumber: cycle.cycle_number, status: cycle.status, title: cycle.title } : null,
      lexical: {
        total: lexical.length,
        mastered: lexical.filter((l) => l.mastered).length,
        boxes: [1, 2, 3, 4, 5].map(
          (b) => lexical.filter((l) => l.box === b).length
        )
      },
      telemetryCount: stats.length
    },
    requestId,
    env2
  );
}
__name(handleAdminUserDetail, "handleAdminUserDetail");
async function handleAdminGift(request, context2) {
  const { env: env2, requestId, userId: adminUserId } = context2;
  const body = await readJson(request);
  const parsed = adminGiftSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid gift payload",
      requestId,
      env2,
      400
    );
  }
  const { telegramId, planType, note, extend } = parsed.data;
  const r = repo(env2);
  let adminRowId = adminUserId ?? null;
  if (!adminRowId) {
    const admin = await r.findUserByTelegramId(context2.telegramId);
    adminRowId = admin?.id ?? null;
  }
  const target = await r.findUserByTelegramId(telegramId);
  if (!target) {
    return jsonError(
      "NOT_FOUND",
      `No user with telegram_id ${telegramId}. The user must start the bot first.`,
      requestId,
      env2,
      404
    );
  }
  const existing = await r.getActiveSubscription(target.id);
  const subscription = await r.createSubscription({
    userId: target.id,
    planType,
    source: "ADMIN_GIFT",
    grantedBy: adminRowId,
    grantNote: note ?? null,
    extend
  });
  if (adminRowId) {
    await r.logAdminGrant({
      adminUserId: adminRowId,
      targetUserId: target.id,
      subscriptionId: subscription.id,
      action: extend && existing ? "EXTEND" : "GIFT",
      planType,
      daysDelta: PLAN_DURATION_DAYS[planType],
      note
    });
  }
  context2.waitUntil?.(
    notifyUserOfGift(env2, target.telegram_id, planType, subscription.expires_at)
  );
  return jsonSuccess(
    {
      granted: true,
      target: {
        telegramId: target.telegram_id,
        name: [target.first_name, target.last_name].filter(Boolean).join(" ") || "\u2014"
      },
      subscription: {
        id: subscription.id,
        planType: subscription.plan_type,
        startsAt: subscription.starts_at,
        expiresAt: subscription.expires_at,
        source: subscription.source
      },
      replacedActive: Boolean(existing) && !extend
    },
    requestId,
    env2
  );
}
__name(handleAdminGift, "handleAdminGift");
async function handleAdminRevoke(request, context2) {
  const { env: env2, requestId, userId: adminUserId } = context2;
  const body = await readJson(request);
  const telegramId = Number(body?.telegramId);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    return jsonError("VALIDATION_ERROR", "telegramId is required", requestId, env2, 400);
  }
  const r = repo(env2);
  let adminRowId = adminUserId ?? null;
  if (!adminRowId) {
    const admin = await r.findUserByTelegramId(context2.telegramId);
    adminRowId = admin?.id ?? null;
  }
  const target = await r.findUserByTelegramId(telegramId);
  if (!target) {
    return jsonError("NOT_FOUND", "User not found", requestId, env2, 404);
  }
  const active = await r.getActiveSubscription(target.id);
  if (!active) {
    return jsonError("NOT_FOUND", "No active subscription to revoke", requestId, env2, 409);
  }
  await r.expireSubscription(active.id);
  if (adminRowId) {
    await r.logAdminGrant({
      adminUserId: adminRowId,
      targetUserId: target.id,
      subscriptionId: active.id,
      action: "REVOKE",
      planType: active.plan_type,
      note: "Revoked by admin console"
    });
  }
  return jsonSuccess({ revoked: true, subscriptionId: active.id }, requestId, env2);
}
__name(handleAdminRevoke, "handleAdminRevoke");
async function handleAdminStats(request, context2) {
  const { env: env2, requestId } = context2;
  const r = repo(env2);
  const stats = await r.adminStats();
  const plans = await r.getPlans();
  return jsonSuccess({ stats, plans }, requestId, env2);
}
__name(handleAdminStats, "handleAdminStats");
function clampInt(raw, min, max, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n))
    return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
__name(clampInt, "clampInt");
async function notifyUserOfGift(env2, telegramId, planType, expiresAt) {
  if (!env2.TELEGRAM_BOT_TOKEN)
    return;
  const labels = {
    "2_WEEKS": "\u06F2 \u0647\u0641\u062A\u0647\u200C\u0627\u06CC",
    "1_MONTH": "\u06F1 \u0645\u0627\u0647\u0647",
    "3_MONTHS": "\u06F3 \u0645\u0627\u0647\u0647",
    "6_MONTHS": "\u06F6 \u0645\u0627\u0647\u0647",
    "1_YEAR": "\u06F1 \u0633\u0627\u0644\u0647",
    TRIAL: "\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC"
  };
  const expiry = new Date(expiresAt).toLocaleDateString("fa-IR");
  const text = [
    "\u{1F381} \u06CC\u06A9 \u0647\u062F\u06CC\u0647 \u0628\u0631\u0627\u06CC \u0634\u0645\u0627!",
    "",
    `\u067E\u0644\u0646 ${labels[planType] ?? planType} \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0628\u0647 \u062D\u0633\u0627\u0628 \u0634\u0645\u0627 \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.`,
    `\u0627\u0639\u062A\u0628\u0627\u0631 \u062A\u0627: ${expiry}`,
    "",
    "\u0645\u0648\u0641\u0642 \u0628\u0627\u0634\u06CC\u062F! \u{1F680}"
  ].join("\n");
  try {
    await fetch(
      `https://api.telegram.org/bot${env2.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramId, text })
      }
    );
  } catch {
  }
}
__name(notifyUserOfGift, "notifyUserOfGift");

// src/routes/auth.ts
async function handleAuth(request, context2) {
  const { env: env2, requestId } = context2;
  const body = await readJson(request);
  const parsed = authRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "initData is required",
      requestId,
      env2,
      400
    );
  }
  const validation = await validateInitData(
    parsed.data.initData,
    env2.TELEGRAM_BOT_TOKEN,
    { maxAgeSeconds: SECURITY.initDataMaxAgeSeconds }
  );
  if (!validation.ok || !validation.user) {
    return jsonError(
      "INVALID_INIT_DATA",
      validation.error ?? "initData validation failed",
      requestId,
      env2,
      401,
      "errors.invalid_session"
    );
  }
  const tgUser = validation.user;
  const detectedLanguage = languageFromTelegramCode(tgUser.language_code);
  const db = new SupabaseClient(env2);
  const repo5 = new ContentRepository(db, env2);
  const user = await repo5.upsertUser({
    telegramId: tgUser.id,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
    username: tgUser.username,
    photoUrl: tgUser.photo_url,
    uiLanguage: detectedLanguage,
    languageSource: "TELEGRAM"
  });
  if (user.is_blocked) {
    return jsonError(
      "UNAUTHORIZED",
      "Account is blocked",
      requestId,
      env2,
      403,
      "errors.account_blocked"
    );
  }
  const subscription = await repo5.getActiveSubscription(user.id);
  const isAdmin2 = isAdminFromEnv(env2, tgUser.id);
  if (isAdmin2 !== user.is_admin) {
    await repo5.updateUser(user.id, { is_admin: isAdmin2 });
    user.is_admin = isAdmin2;
  }
  const token = await signJwt(
    {
      telegram_id: tgUser.id,
      sub: user.id,
      ui_language: user.ui_language ?? detectedLanguage
    },
    env2.JWT_SECRET,
    SECURITY.jwtTtlSeconds
  );
  const profile3 = toUserProfile(user, subscription, { isAdmin: isAdmin2 });
  return jsonSuccess({ token, user: profile3 }, requestId, env2);
}
__name(handleAuth, "handleAuth");
async function handleMe(request, context2) {
  const { env: env2, requestId, telegramId } = context2;
  if (!telegramId) {
    return jsonError("UNAUTHORIZED", "No identity", requestId, env2, 401);
  }
  const db = new SupabaseClient(env2);
  const repo5 = new ContentRepository(db, env2);
  const user = await repo5.findUserByTelegramId(telegramId);
  if (!user) {
    return jsonError("NOT_FOUND", "User not found", requestId, env2, 404);
  }
  const subscription = await repo5.getActiveSubscription(user.id);
  const profile3 = toUserProfile(user, subscription, {
    isAdmin: isAdminFromEnv(env2, telegramId)
  });
  return jsonSuccess({ user: profile3 }, requestId, env2);
}
__name(handleMe, "handleMe");
async function handleHealth(request, context2) {
  const { env: env2, requestId } = context2;
  return jsonSuccess(
    {
      status: "ok",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      version: "0.1.0",
      features: {
        telegramStars: true,
        adminGift: true,
        payloadEncryption: String(env2.ENABLE_PAYLOAD_ENCRYPTION ?? "false") === "true",
        aiProviders: {
          gemini: Boolean(env2.GEMINI_API_KEY),
          deepseek: Boolean(env2.DEEPSEEK_API_KEY),
          anthropic: Boolean(env2.ANTHROPIC_API_KEY)
        }
      }
    },
    requestId,
    env2
  );
}
__name(handleHealth, "handleHealth");

// src/routes/learn.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();

// src/services/qstash.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var QStashClient = class {
  constructor(env2) {
    this.env = env2;
    this.token = env2.QSTASH_TOKEN;
    this.selfUrl = env2.SELF_URL;
  }
  token;
  selfUrl;
  get available() {
    return Boolean(this.token && this.selfUrl);
  }
  async enqueue(message, options = {}) {
    if (!this.available) {
      return { ok: false, error: "QStash not configured (QSTASH_TOKEN / SELF_URL missing)" };
    }
    const url = `${this.selfUrl}/internal/queue?internal=${encodeURIComponent(message.kind)}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "Upstash-Retries": String(options.retries ?? 2),
      "Upstash-Method": "POST"
    };
    if (options.delaySeconds) {
      headers["Upstash-Delay"] = `${options.delaySeconds}s`;
    }
    try {
      const res = await fetch(`https://qstash.upstash.io/v2/publish/${url}`, {
        method: "POST",
        headers,
        body: JSON.stringify(message)
      });
      if (!res.ok) {
        return { ok: false, error: `QStash ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const json = await res.json();
      return { ok: true, messageId: json.messageId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  /**
   * مسیر جایگزین: اگر QStash تنظیم نشده باشد، کار را با waitUntil
   * در پس‌زمینه همان isolate اجرا می‌کنیم (برای dev و استقرارهای کوچک).
   */
  get supportsInlineFallback() {
    return true;
  }
};
__name(QStashClient, "QStashClient");

// src/routes/learn.ts
function repo2(env2) {
  return new ContentRepository(new SupabaseClient(env2), env2);
}
__name(repo2, "repo");
async function requireUser(context2) {
  const { env: env2, telegramId } = context2;
  if (!telegramId)
    return { error: "no identity" };
  const r = repo2(env2);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user)
    return { error: "user not found" };
  return {
    user: {
      ...user,
      target_language: user.target_language ?? "en",
      skill_level: user.skill_level ?? "ZERO",
      ui_language: user.ui_language ?? "fa"
    },
    repo: r
  };
}
__name(requireUser, "requireUser");
async function handleHome(request, context2) {
  const { env: env2, requestId } = context2;
  const resolved = await requireUser(context2);
  if ("error" in resolved) {
    return jsonError("NOT_FOUND", resolved.error, requestId, env2, 404);
  }
  const { user } = resolved;
  const r = resolved.repo;
  const subscription = await r.getActiveSubscription(user.id);
  const profile3 = toUserProfile(user, subscription, {
    isAdmin: isAdminFromEnv(env2, user.telegram_id)
  });
  const activeCycle = await r.getActiveCycle(user.id);
  const generatingCycle = activeCycle ? null : await r.getGeneratingCycle(user.id);
  if (!activeCycle) {
    return jsonSuccess(
      {
        user: profile3,
        cycle: null,
        lesson: null,
        generating: Boolean(generatingCycle),
        generationStatus: generatingCycle?.status ?? null
      },
      requestId,
      env2
    );
  }
  const lessons = await r.getLessonsForCycle(activeCycle.id);
  const cycleDto = toCycleDto(activeCycle, lessons);
  const current = lessons.find((l) => !l.is_completed);
  return jsonSuccess(
    {
      user: profile3,
      cycle: cycleDto,
      lesson: current ? toLessonDto(current) : null,
      generating: false,
      generationStatus: null
    },
    requestId,
    env2
  );
}
__name(handleHome, "handleHome");
async function handleGetTodayLesson(request, context2) {
  const { env: env2, requestId } = context2;
  const resolved = await requireUser(context2);
  if ("error" in resolved) {
    return jsonError("NOT_FOUND", resolved.error, requestId, env2, 404);
  }
  const { user, repo: r } = resolved;
  const subscription = await r.getActiveSubscription(user.id);
  const profile3 = toUserProfile(user, subscription, { isAdmin: false });
  if (!profile3.hasAccess) {
    return jsonError(
      "SUBSCRIPTION_REQUIRED",
      "Trial expired and no active subscription",
      requestId,
      env2,
      402,
      "errors.subscription_required"
    );
  }
  const current = await r.getCurrentLesson(user.id);
  if (!current) {
    const generating = await r.getGeneratingCycle(user.id);
    return jsonError(
      "CYCLE_NOT_READY",
      generating ? "Next cycle is being generated" : "No active cycle available",
      requestId,
      env2,
      409,
      generating ? "errors.cycle_generating" : "errors.no_cycle"
    );
  }
  if (!current.lesson.started_at) {
    await r["db"].update("lessons", { id: current.lesson.id }, {
      status: "IN_PROGRESS",
      started_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return jsonSuccess(
    {
      cycleId: current.cycle.id,
      dayNumber: current.lesson.day_number,
      lesson: toLessonDto(current.lesson)
    },
    requestId,
    env2
  );
}
__name(handleGetTodayLesson, "handleGetTodayLesson");
async function handleTelemetry(request, context2) {
  const { env: env2, requestId } = context2;
  const resolved = await requireUser(context2);
  if ("error" in resolved) {
    return jsonError("NOT_FOUND", resolved.error, requestId, env2, 404);
  }
  const { user, repo: r } = resolved;
  const body = await readJson(request);
  const parsed = telemetryBatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid telemetry payload", requestId, env2, 400);
  }
  const lessonId = parsed.data.lessonId ?? null;
  let cycleId = null;
  if (lessonId) {
    const lesson = await r.getLessonById(lessonId);
    if (!lesson || lesson.user_id !== user.id) {
      return jsonError("NOT_FOUND", "Lesson not found", requestId, env2, 404);
    }
    cycleId = lesson.cycle_id;
  }
  await r.insertTelemetry(
    parsed.data.events.map((e) => ({
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: cycleId,
      event_type: e.eventType,
      item_id: e.itemId ?? null,
      is_correct: e.isCorrect ?? null,
      response_ms: e.responseMs ?? null,
      pause_ms: e.pauseMs ?? null,
      payload: e.payload ?? null
    }))
  );
  return jsonSuccess({ accepted: parsed.data.events.length }, requestId, env2);
}
__name(handleTelemetry, "handleTelemetry");
async function handleCompleteLesson(request, context2) {
  const { env: env2, requestId } = context2;
  const resolved = await requireUser(context2);
  if ("error" in resolved) {
    return jsonError("NOT_FOUND", resolved.error, requestId, env2, 404);
  }
  const { user, repo: r } = resolved;
  const body = await readJson(request);
  const parsed = completeLessonSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid payload",
      requestId,
      env2,
      400
    );
  }
  const { lessonId, durationSeconds, answers } = parsed.data;
  const lesson = await r.getLessonById(lessonId);
  if (!lesson || lesson.user_id !== user.id) {
    return jsonError("NOT_FOUND", "Lesson not found", requestId, env2, 404);
  }
  if (lesson.is_completed) {
    return jsonSuccess(
      { alreadyCompleted: true, dayNumber: lesson.day_number },
      requestId,
      env2
    );
  }
  const lexical = await r.getLexicalItems(user.id, user.target_language);
  const boxByTerm = new Map(lexical.map((l) => [l.term, l]));
  const updates = /* @__PURE__ */ new Map();
  for (const answer of answers) {
    const term = answer.linkedTerm;
    if (!term)
      continue;
    const existing = boxByTerm.get(term);
    const review = applyLeitnerReview({
      box: existing?.box ?? 1,
      ease: existing?.ease ?? 2.5,
      repetitions: existing?.repetitions ?? 0,
      lapses: existing?.lapses ?? 0,
      isCorrect: answer.isCorrect,
      responseMs: answer.responseMs
    });
    updates.set(term, {
      term,
      box: review.box,
      ease: review.ease,
      repetitions: review.repetitions,
      lapses: review.lapses,
      intervalDays: review.intervalDays,
      mastered: review.mastered,
      successCount: (existing?.success_count ?? 0) + (answer.isCorrect ? 1 : 0),
      failCount: (existing?.fail_count ?? 0) + (answer.isCorrect ? 0 : 1),
      nextReviewAt: nextReviewDate(review.intervalDays).toISOString()
    });
  }
  await Promise.all(
    [...updates.values()].map(
      (u) => r.upsertLexicalItem(user.id, user.target_language, u)
    )
  );
  await r.insertTelemetry([
    {
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: "LESSON_START",
      payload: { day: lesson.day_number }
    },
    ...answers.map((a) => ({
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: "ANSWER",
      item_id: a.itemId,
      is_correct: a.isCorrect,
      response_ms: a.responseMs,
      payload: a.usedHint ? { usedHint: true } : null
    })),
    {
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: "LESSON_END",
      payload: { day: lesson.day_number, durationSeconds }
    }
  ]);
  await r.completeLesson(lessonId, { durationSeconds, status: "COMPLETED" });
  await r.unlockNextLesson(lesson.cycle_id, lesson.day_number);
  const lessonScore = scoreLesson({
    answers: answers.map((a) => ({ isCorrect: a.isCorrect, responseMs: a.responseMs })),
    usedHints: answers.filter((a) => a.usedHint).length
  });
  const streak = computeStreak(
    user.last_active_date ? new Date(user.last_active_date) : null,
    user.streak_count
  );
  let reward = ECONOMY.rewardPerLesson;
  if (lessonScore.isPerfect)
    reward += ECONOMY.rewardPerfectDay;
  if (streak.streak % CYCLE_LENGTH_DAYS === 0 && streak.isNewDay) {
    reward += ECONOMY.rewardStreak7;
  }
  await r.updateUser(user.id, {
    stars_balance: user.stars_balance + reward,
    streak_count: streak.streak,
    longest_streak: Math.max(user.longest_streak, streak.streak),
    last_active_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
  });
  const lessons = await r.getLessonsForCycle(lesson.cycle_id);
  const completedDays = lessons.filter((l) => l.is_completed || l.id === lessonId).map((l) => l.day_number);
  const allDone = completedDays.length >= CYCLE_LENGTH_DAYS;
  let nextCycleTriggered = false;
  let generationDeferred = null;
  if (allDone) {
    await r.markCycleCompleted(lesson.cycle_id);
  }
  const cycle = await r.getCycleById(lesson.cycle_id);
  const generating = await r.getGeneratingCycle(user.id);
  const decision = shouldGenerateNextCycle({
    cycleStatus: allDone ? "COMPLETED" : "ACTIVE",
    completedDays,
    cycleStartedAt: cycle?.started_at ? new Date(cycle.started_at) : null,
    stallDays: Number(env2.CYCLE_STALL_DAYS ?? 12),
    hasGeneratingCycle: Boolean(generating)
  });
  if (decision.shouldGenerate && cycle) {
    const nextNumber = cycle.cycle_number + 1;
    await r.createGeneratingCycle(user.id, nextNumber);
    const qstash = new QStashClient(env2);
    const userId = user.id;
    if (qstash.available) {
      const enqueued = await qstash.enqueue({
        kind: "generate-cycle",
        userId,
        cycleNumber: nextNumber
      });
      nextCycleTriggered = enqueued.ok;
      if (!enqueued.ok)
        generationDeferred = "queue_unavailable";
    } else {
      generationDeferred = "inline";
      nextCycleTriggered = true;
      context2.waitUntil?.(
        generateCycleInline(context2, userId, nextNumber).catch(() => {
        })
      );
    }
  } else if (decision.reason === "CALENDAR_PAUSED_STALL") {
    generationDeferred = "calendar_paused";
  }
  return jsonSuccess(
    {
      dayNumber: lesson.day_number,
      score: lessonScore,
      reward,
      streak: streak.streak,
      cycleCompleted: allDone,
      nextCycleTriggered,
      generationDeferred,
      appLocked: allDone && !nextCycleTriggered
    },
    requestId,
    env2
  );
}
__name(handleCompleteLesson, "handleCompleteLesson");
async function runCycleGeneration(env2, userId, cycleNumber) {
  const r = repo2(env2);
  const user = await r.findUserById(userId);
  if (!user)
    return { ok: false, error: "user not found" };
  const generating = await r.getGeneratingCycle(userId);
  if (!generating || generating.cycle_number !== cycleNumber) {
    return { ok: false, error: "no matching GENERATING cycle" };
  }
  const previous = await r.getActiveCycle(userId);
  const previousLessons = previous ? await r.getLessonsForCycle(previous.id) : [];
  const telemetry = previous ? await r.getTelemetryForCycle(previous.id) : [];
  const lexical = await r.getLexicalItems(userId, user.target_language);
  const day6 = previousLessons.find((l) => l.day_number === 6);
  let hiddenScore = null;
  if (day6) {
    const day6Answers = telemetry.filter((t) => t.event_type === "ANSWER");
    if (day6Answers.length > 0) {
      const correct = day6Answers.filter((a) => a.is_correct).length;
      hiddenScore = Math.round(correct / day6Answers.length * 100);
    }
  }
  const delta = buildSkillDelta({
    events: telemetry.map((t) => ({
      eventType: t.event_type,
      itemId: t.item_id,
      isCorrect: t.is_correct,
      responseMs: t.response_ms,
      pauseMs: t.pause_ms
    })),
    lexical: lexical.map((l) => ({
      term: l.term,
      box: l.box,
      lapses: l.lapses,
      successCount: l.success_count,
      failCount: l.fail_count
    })),
    hiddenAssessmentScore: hiddenScore
  });
  const { AiEngine: AiEngine2, resolveProviderChain: resolveProviderChain2 } = await Promise.resolve().then(() => (init_ai_engine(), ai_engine_exports));
  const providerRows = await r.listActiveAiProviders();
  const chain = await resolveProviderChain2(providerRows, env2);
  const engine = new AiEngine2(env2, chain);
  if (!engine.hasAnyProvider) {
    const reason = providerRows.length === 0 ? "no AI provider configured" : "no AI provider could be resolved (check keys / PROVIDER_ENCRYPTION_KEY)";
    await markCycleFailed(r, generating.id, reason);
    return { ok: false, error: reason };
  }
  const generationInput = {
    user: {
      id: user.id,
      skillLevel: user.skill_level ?? "ZERO",
      learningGoal: user.learning_goal,
      uiLanguage: user.ui_language ?? "fa",
      targetLanguage: user.target_language ?? "en"
    },
    cycleNumber,
    delta,
    previousCycleSummary: previous ? `${previous.title}${previous.focus_summary ? ` \u2014 ${previous.focus_summary}` : ""}` : null
  };
  const result = await engine.generateCycle(generationInput);
  await recordAttempts(r, generating.id, result.attempts);
  if (!result.cycle) {
    const detail = result.attempts.map((a) => `${a.provider}/${a.model}: ${a.error ?? "failed"}`).join(" | ");
    await markCycleFailed(r, generating.id, detail);
    return { ok: false, error: detail };
  }
  await r.persistGeneratedCycle(generating.id, result.cycle, {
    model: result.model ?? "unknown",
    ms: result.totalMs,
    tokens: result.attempts.find((a) => a.ok)?.tokensUsed,
    input: generationInput
  });
  return { ok: true };
}
__name(runCycleGeneration, "runCycleGeneration");
async function recordAttempts(r, cycleId, attempts) {
  const streak = /* @__PURE__ */ new Map();
  for (let i = 0; i < attempts.length; i += 1) {
    const a = attempts[i];
    if (!a)
      continue;
    const key = a.providerId ?? a.provider;
    const fails = a.ok ? 0 : (streak.get(key) ?? 0) + 1;
    streak.set(key, fails);
    await r.recordProviderOutcome({
      cycleId,
      providerId: a.providerId,
      providerLabel: a.provider,
      model: a.model,
      attemptNo: i + 1,
      phase: "initial",
      ok: a.ok,
      latencyMs: a.ms,
      error: a.error,
      tokensUsed: a.tokensUsed,
      consecutiveFailures: fails
    }).catch(() => void 0);
  }
}
__name(recordAttempts, "recordAttempts");
async function markCycleFailed(r, cycleId, reason) {
  await r["db"].update("cycles", { id: cycleId }, {
    status: "FAILED",
    focus_summary: `Generation failed: ${reason.slice(0, 400)}`
  });
}
__name(markCycleFailed, "markCycleFailed");
async function generateCycleInline(context2, userId, cycleNumber) {
  await runCycleGeneration(context2.env, userId, cycleNumber);
}
__name(generateCycleInline, "generateCycleInline");
async function handleOnboarding(request, context2) {
  const { env: env2, requestId, telegramId } = context2;
  if (!telegramId)
    return jsonError("UNAUTHORIZED", "No identity", requestId, env2, 401);
  const body = await readJson(request);
  const parsed = onboardingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid onboarding data", requestId, env2, 400);
  }
  const r = repo2(env2);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user)
    return jsonError("NOT_FOUND", "User not found", requestId, env2, 404);
  await r.updateUser(user.id, {
    ui_language: parsed.data.uiLanguage,
    language_source: "MANUAL",
    target_language: parsed.data.targetLanguage,
    skill_level: parsed.data.skillLevel,
    learning_goal: parsed.data.learningGoal,
    onboarding_done: true
  });
  const existing = await r.getLatestCycle(user.id);
  if (!existing) {
    const cycle = await r.createGeneratingCycle(user.id, 1);
    const qstash = new QStashClient(env2);
    if (qstash.available) {
      await qstash.enqueue({ kind: "generate-cycle", userId: user.id, cycleNumber: 1 });
    } else {
      context2.waitUntil?.(
        generateCycleInline(context2, user.id, 1).catch(() => {
        })
      );
    }
    return jsonSuccess(
      { onboardingComplete: true, firstCycleId: cycle.id, generating: true },
      requestId,
      env2
    );
  }
  return jsonSuccess({ onboardingComplete: true, generating: false }, requestId, env2);
}
__name(handleOnboarding, "handleOnboarding");
async function handleUpdateProfile(request, context2) {
  const { env: env2, requestId, telegramId } = context2;
  if (!telegramId)
    return jsonError("UNAUTHORIZED", "No identity", requestId, env2, 401);
  const body = await readJson(request);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid profile data", requestId, env2, 400);
  }
  const r = repo2(env2);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user)
    return jsonError("NOT_FOUND", "User not found", requestId, env2, 404);
  const patch = {};
  const d = parsed.data;
  if (d.uiLanguage) {
    patch.ui_language = d.uiLanguage;
    patch.language_source = "MANUAL";
  }
  if (d.targetLanguage)
    patch.target_language = d.targetLanguage;
  if (d.learningGoal !== void 0)
    patch.learning_goal = d.learningGoal;
  if (d.timezone)
    patch.timezone = d.timezone;
  if (Object.keys(patch).length === 0) {
    return jsonSuccess({ updated: false }, requestId, env2);
  }
  const updated = await r.updateUser(user.id, patch);
  const subscription = await r.getActiveSubscription(user.id);
  return jsonSuccess(
    {
      updated: true,
      user: toUserProfile(updated ?? user, subscription, {
        isAdmin: isAdminFromEnv(env2, telegramId)
      })
    },
    requestId,
    env2
  );
}
__name(handleUpdateProfile, "handleUpdateProfile");
async function handleDeleteAccount(request, context2) {
  const { env: env2, requestId, telegramId } = context2;
  if (!telegramId)
    return jsonError("UNAUTHORIZED", "No identity", requestId, env2, 401);
  const r = repo2(env2);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user)
    return jsonSuccess({ deleted: true }, requestId, env2);
  await r.deleteUser(user.id);
  return jsonSuccess({ deleted: true }, requestId, env2);
}
__name(handleDeleteAccount, "handleDeleteAccount");
async function handleProgress(request, context2) {
  const { env: env2, requestId } = context2;
  const resolved = await requireUser(context2);
  if ("error" in resolved) {
    return jsonError("NOT_FOUND", resolved.error, requestId, env2, 404);
  }
  const { user, repo: r } = resolved;
  const cycle = await r.getActiveCycle(user.id);
  const telemetry = cycle ? await r.getTelemetryForCycle(cycle.id) : [];
  const lexical = await r.getLexicalItems(user.id, user.target_language);
  const lessons = cycle ? await r.getLessonsForCycle(cycle.id) : [];
  const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];
  const dashboard = buildProgressDashboard({
    telemetry: telemetry.map((t) => ({
      event_type: t.event_type,
      is_correct: t.is_correct,
      response_ms: t.response_ms,
      pause_ms: t.pause_ms
    })),
    lessonsCompleted: lessons.filter((l) => l.is_completed).length,
    lexical: lexical.map((l) => ({ ...l, repetitions: l.repetitions })),
    streakCount: user.streak_count,
    weeklyMinutes
  });
  return jsonSuccess({ dashboard }, requestId, env2);
}
__name(handleProgress, "handleProgress");
async function handleDebugDelta(request, context2) {
  const { env: env2, requestId } = context2;
  const resolved = await requireUser(context2);
  if ("error" in resolved) {
    return jsonError("NOT_FOUND", resolved.error, requestId, env2, 404);
  }
  const { user, repo: r } = resolved;
  const cycle = await r.getActiveCycle(user.id);
  const telemetry = cycle ? await r.getTelemetryForCycle(cycle.id) : [];
  const lexical = await r.getLexicalItems(user.id, user.target_language);
  const delta = buildSkillDelta({
    events: telemetry.map((t) => ({
      eventType: t.event_type,
      itemId: t.item_id,
      isCorrect: t.is_correct,
      responseMs: t.response_ms,
      pauseMs: t.pause_ms
    })),
    lexical: lexical.map((l) => ({
      term: l.term,
      box: l.box,
      lapses: l.lapses,
      successCount: l.success_count,
      failCount: l.fail_count
    }))
  });
  return jsonSuccess({ delta, weakTerms: delta.weakTerms }, requestId, env2);
}
__name(handleDebugDelta, "handleDebugDelta");

// src/routes/store.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();
function repo3(env2) {
  return new ContentRepository(new SupabaseClient(env2), env2);
}
__name(repo3, "repo");
async function handlePlans(request, context2) {
  const { env: env2, requestId } = context2;
  const r = repo3(env2);
  const plans = await r.getPlans();
  const bankInfo = await r.getSetting("bank_info");
  const features2 = await r.getSetting("features");
  return jsonSuccess(
    {
      plans,
      bankInfo: features2?.adminBotReceipt ? bankInfo : null,
      paymentMethods: {
        telegramStars: features2?.telegramStars !== false,
        zarinpal: features2?.zarinpal === true,
        adminReceipt: features2?.adminBotReceipt === true
      },
      starsOnly: features2?.zarinpal !== true && features2?.adminBotReceipt !== true
    },
    requestId,
    env2
  );
}
__name(handlePlans, "handlePlans");
async function handleCreateInvoice(request, context2) {
  const { env: env2, requestId, telegramId, userId } = context2;
  if (!telegramId || !userId) {
    return jsonError("UNAUTHORIZED", "No identity", requestId, env2, 401);
  }
  const body = await readJson(request);
  const parsed = purchasePlanSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "planId is required", requestId, env2, 400);
  }
  const r = repo3(env2);
  const plans = await r.getPlans();
  const plan = plans.find((p) => p.id === parsed.data.planId);
  if (!plan) {
    return jsonError("NOT_FOUND", `Unknown plan: ${parsed.data.planId}`, requestId, env2, 404);
  }
  const result = await createStarsInvoice(
    env2.TELEGRAM_BOT_TOKEN,
    plan,
    userId,
    telegramId
  );
  if (!result.ok) {
    return jsonError(
      "INTERNAL_ERROR",
      result.error ?? "Could not create invoice",
      requestId,
      env2,
      502,
      "errors.payment_unavailable"
    );
  }
  return jsonSuccess(
    {
      invoiceLink: result.invoiceLink,
      planId: plan.id,
      amountStars: plan.finalPriceStars,
      planTitle: plan.titleFa
    },
    requestId,
    env2
  );
}
__name(handleCreateInvoice, "handleCreateInvoice");
async function createStarsInvoice(botToken, plan, userId, telegramId) {
  const payload = JSON.stringify({
    v: 1,
    planId: plan.id,
    planType: plan.planType,
    userId,
    telegramId
  });
  if (payload.length > 128) {
    return { ok: false, error: "invoice payload too long" };
  }
  const body = {
    title: `${plan.titleFa} \u2014 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0622\u0645\u0648\u0632\u0634 \u0632\u0628\u0627\u0646`,
    description: `${plan.durationDays} \u0631\u0648\u0632 \u062F\u0633\u062A\u0631\u0633\u06CC \u06A9\u0627\u0645\u0644 \u0628\u0647 \u0645\u0639\u0644\u0645 \u0647\u0648\u0634\u0645\u0646\u062F \u062A\u0637\u0628\u06CC\u0642\u06CC`,
    payload,
    currency: "XTR",
    prices: [{ label: plan.titleFa, amount: plan.finalPriceStars }]
  };
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    const json = await res.json();
    if (!json.ok || !json.result) {
      return { ok: false, error: json.description ?? `Telegram returned not-ok` };
    }
    return { ok: true, invoiceLink: json.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
__name(createStarsInvoice, "createStarsInvoice");
async function fulfilStarPayment(env2, input) {
  if (input.currency !== "XTR") {
    return { ok: false, error: `Unexpected currency: ${input.currency}` };
  }
  let payload;
  try {
    payload = JSON.parse(input.invoicePayload);
  } catch {
    return { ok: false, error: "invoice payload is not valid JSON" };
  }
  if (!payload.planId || !payload.userId) {
    return { ok: false, error: "invoice payload missing planId/userId" };
  }
  const r = repo3(env2);
  const existing = await r.findStarTransactionByChargeId(input.telegramChargeId);
  if (existing) {
    return { ok: true, duplicate: true };
  }
  const planRow = await r.getPlanById(payload.planId);
  if (!planRow) {
    return { ok: false, error: `unknown plan: ${payload.planId}` };
  }
  const expectedStars = Math.round(
    planRow.price_stars * (1 - planRow.discount_percent / 100)
  );
  if (input.totalAmount < expectedStars) {
    return {
      ok: false,
      error: `underpaid: got ${input.totalAmount} XTR, expected ${expectedStars}`
    };
  }
  const user = await r.findUserById(payload.userId);
  if (!user) {
    return { ok: false, error: "user not found for payload" };
  }
  const subscription = await r.createSubscription({
    userId: user.id,
    planType: planRow.plan_type,
    source: "TELEGRAM_STARS",
    priceStars: input.totalAmount,
    paymentRef: input.telegramChargeId,
    extend: true
  });
  const recorded = await r.recordStarPayment({
    userId: user.id,
    subscriptionId: subscription.id,
    telegramChargeId: input.telegramChargeId,
    providerChargeId: input.providerChargeId,
    amountStars: input.totalAmount,
    planType: planRow.plan_type,
    rawPayload: input
  });
  return {
    ok: true,
    duplicate: !recorded,
    planType: planRow.plan_type,
    expiresAt: subscription.expires_at
  };
}
__name(fulfilStarPayment, "fulfilStarPayment");

// src/routes/admin-ai.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();
init_provider_vault();
init_ai_engine();
function repo4(env2) {
  return new ContentRepository(new SupabaseClient(env2), env2);
}
__name(repo4, "repo");
async function handleAdminListProviders(_request, context2) {
  const { env: env2, requestId } = context2;
  const r = repo4(env2);
  const [rows, attempts] = await Promise.all([
    r.listAllAiProviders(),
    r.listAiAttempts(30)
  ]);
  const chain = await resolveProviderChain(rows, env2);
  const usableIds = new Set(chain.map((p) => p.id));
  const providers = rows.map((row) => toProviderDto(row, usableIds.has(row.id)));
  return jsonSuccess(
    {
      providers,
      attempts,
      // The exact order the engine will try, for display.
      chain: chain.map((p) => ({ id: p.id, label: p.label, model: p.model })),
      encryptionReady: Boolean(env2.PROVIDER_ENCRYPTION_KEY)
    },
    requestId,
    env2
  );
}
__name(handleAdminListProviders, "handleAdminListProviders");
async function handleAdminCreateProvider(request, context2) {
  const { env: env2, requestId } = context2;
  if (!env2.PROVIDER_ENCRYPTION_KEY) {
    return jsonError(
      "INTERNAL_ERROR",
      "PROVIDER_ENCRYPTION_KEY is not configured on the Worker",
      requestId,
      env2,
      500,
      "admin.ai.encryptionMissing"
    );
  }
  const body = await readJson(request);
  const parsed = validateWithDetail(createAiProviderSchema, body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.errors.join("; "), requestId, env2, 422);
  }
  const input = parsed.data;
  const r = repo4(env2);
  const encrypted = await encryptProviderKey(input.apiKey, env2.PROVIDER_ENCRYPTION_KEY);
  const row = await r.createAiProvider({
    label: input.label,
    protocol: input.protocol,
    vendor: input.vendor,
    model: input.model,
    baseUrl: input.baseUrl ?? null,
    apiKeyEncrypted: encrypted,
    keyHint: keyHint(input.apiKey),
    priority: input.priority ?? 100,
    isActive: input.isActive ?? true,
    temperature: input.temperature ?? null,
    maxOutputTokens: input.maxOutputTokens ?? null,
    supportsJsonSchema: input.supportsJsonSchema ?? false,
    note: input.note ?? null
  });
  if (!row) {
    return jsonError("INTERNAL_ERROR", "Could not save provider", requestId, env2, 500);
  }
  return jsonSuccess({ provider: toProviderDto(row, true) }, requestId, env2);
}
__name(handleAdminCreateProvider, "handleAdminCreateProvider");
async function handleAdminUpdateProvider(request, context2) {
  const { env: env2, requestId } = context2;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonError("VALIDATION_ERROR", "id is required", requestId, env2, 422);
  }
  const body = await readJson(request);
  const parsed = validateWithDetail(updateAiProviderSchema, body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.errors.join("; "), requestId, env2, 422);
  }
  const input = parsed.data;
  const patch = {};
  if (input.label !== void 0)
    patch.label = input.label;
  if (input.protocol !== void 0)
    patch.protocol = input.protocol;
  if (input.vendor !== void 0)
    patch.vendor = input.vendor;
  if (input.model !== void 0)
    patch.model = input.model;
  if (input.baseUrl !== void 0)
    patch.base_url = input.baseUrl ?? null;
  if (input.priority !== void 0)
    patch.priority = input.priority;
  if (input.isActive !== void 0)
    patch.is_active = input.isActive;
  if (input.temperature !== void 0)
    patch.temperature = input.temperature ?? null;
  if (input.maxOutputTokens !== void 0) {
    patch.max_output_tokens = input.maxOutputTokens ?? null;
  }
  if (input.supportsJsonSchema !== void 0) {
    patch.supports_json_schema = input.supportsJsonSchema;
  }
  if (input.note !== void 0)
    patch.note = input.note ?? null;
  if (input.apiKey) {
    if (!env2.PROVIDER_ENCRYPTION_KEY) {
      return jsonError(
        "INTERNAL_ERROR",
        "PROVIDER_ENCRYPTION_KEY is not configured on the Worker",
        requestId,
        env2,
        500,
        "admin.ai.encryptionMissing"
      );
    }
    patch.api_key_encrypted = await encryptProviderKey(
      input.apiKey,
      env2.PROVIDER_ENCRYPTION_KEY
    );
    patch.key_hint = keyHint(input.apiKey);
    patch.health_status = "unknown";
    patch.consecutive_failures = 0;
    patch.last_error = null;
  }
  if (Object.keys(patch).length === 0) {
    return jsonError("VALIDATION_ERROR", "Nothing to update", requestId, env2, 422);
  }
  const r = repo4(env2);
  const row = await r.updateAiProvider(id, patch);
  if (!row) {
    return jsonError("NOT_FOUND", "Provider not found", requestId, env2, 404);
  }
  return jsonSuccess({ provider: toProviderDto(row, true) }, requestId, env2);
}
__name(handleAdminUpdateProvider, "handleAdminUpdateProvider");
async function handleAdminDeleteProvider(request, context2) {
  const { env: env2, requestId } = context2;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonError("VALIDATION_ERROR", "id is required", requestId, env2, 422);
  }
  const r = repo4(env2);
  await r.deleteAiProvider(id);
  return jsonSuccess({ deleted: true, id }, requestId, env2);
}
__name(handleAdminDeleteProvider, "handleAdminDeleteProvider");
async function handleAdminReorderProviders(request, context2) {
  const { env: env2, requestId } = context2;
  const body = await readJson(request);
  const parsed = validateWithDetail(reorderAiProvidersSchema, body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.errors.join("; "), requestId, env2, 422);
  }
  const { order } = parsed.data;
  const r = repo4(env2);
  await Promise.all(
    order.map(
      (id, index) => r.updateAiProvider(id, { priority: index + 1 }).catch(() => null)
    )
  );
  const rows = await r.listAllAiProviders();
  const chain = await resolveProviderChain(rows, env2);
  const usableIds = new Set(chain.map((p) => p.id));
  return jsonSuccess(
    { providers: rows.map((row) => toProviderDto(row, usableIds.has(row.id))) },
    requestId,
    env2
  );
}
__name(handleAdminReorderProviders, "handleAdminReorderProviders");
async function handleAdminTestProvider(request, context2) {
  const { env: env2, requestId } = context2;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonError("VALIDATION_ERROR", "id is required", requestId, env2, 422);
  }
  const r = repo4(env2);
  const row = await r.getAiProviderById(id);
  if (!row) {
    return jsonError("NOT_FOUND", "Provider not found", requestId, env2, 404);
  }
  const chain = await resolveProviderChain([row], env2);
  const provider = chain[0];
  if (!provider) {
    return jsonSuccess(
      {
        ok: false,
        error: row.api_key_encrypted === FROM_ENV_MARKER ? "No matching environment secret is set for this provider." : "The stored key could not be decrypted (wrong PROVIDER_ENCRYPTION_KEY?)."
      },
      requestId,
      env2
    );
  }
  const result = await probeProvider(provider);
  await r.recordProviderOutcome({
    cycleId: null,
    providerId: provider.id,
    providerLabel: provider.label,
    model: provider.model,
    attemptNo: 1,
    phase: "initial",
    ok: result.ok,
    latencyMs: result.ms,
    error: result.error
  });
  return jsonSuccess(result, requestId, env2);
}
__name(handleAdminTestProvider, "handleAdminTestProvider");
async function probeProvider(provider) {
  const t0 = Date.now();
  try {
    const sample = await probeOnce(provider);
    return { ok: true, ms: Date.now() - t0, sample };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300)
    };
  }
}
__name(probeProvider, "probeProvider");
async function probeOnce(provider) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2e4);
  try {
    if (provider.protocol === "gemini") {
      const base2 = provider.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
      const res2 = await fetch(
        `${base2.replace(/\/$/, "")}/models/${provider.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": provider.apiKey
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }],
            generationConfig: { maxOutputTokens: 16 }
          }),
          signal: controller.signal
        }
      );
      if (!res2.ok)
        throw new Error(`Gemini ${res2.status}: ${(await res2.text()).slice(0, 200)}`);
      const json2 = await res2.json();
      return json2.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    }
    if (provider.protocol === "anthropic") {
      const base2 = provider.baseUrl ?? "https://api.anthropic.com";
      const res2 = await fetch(`${base2.replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 16,
          messages: [{ role: "user", content: "Reply with the single word: OK" }]
        }),
        signal: controller.signal
      });
      if (!res2.ok)
        throw new Error(`Anthropic ${res2.status}: ${(await res2.text()).slice(0, 200)}`);
      const json2 = await res2.json();
      return json2.content?.map((c) => c.text ?? "").join("") ?? "";
    }
    const base = provider.baseUrl ?? "https://api.deepseek.com";
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with the single word: OK" }]
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`${provider.vendor} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}
__name(probeOnce, "probeOnce");
function toProviderDto(row, usable) {
  return {
    id: row.id,
    label: row.label,
    protocol: row.protocol,
    vendor: row.vendor,
    model: row.model,
    baseUrl: row.base_url,
    keyHint: row.key_hint ?? "",
    fromEnv: row.api_key_encrypted === FROM_ENV_MARKER,
    priority: row.priority,
    isActive: row.is_active,
    temperature: row.temperature === null ? null : Number(row.temperature),
    maxOutputTokens: row.max_output_tokens,
    supportsJsonSchema: row.supports_json_schema,
    healthStatus: row.health_status ?? "unknown",
    lastError: row.last_error ?? null,
    consecutiveFailures: row.consecutive_failures ?? 0,
    totalSuccesses: row.total_successes ?? 0,
    totalFailures: row.total_failures ?? 0,
    lastSuccessAt: row.last_success_at ?? null,
    lastFailureAt: row.last_failure_at ?? null,
    note: row.note ?? null,
    /** False when the key cannot be resolved — the engine will skip it. */
    usable
  };
}
__name(toProviderDto, "toProviderDto");

// src/routes/telegram-bot.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function handleTelegramWebhook(request, context2) {
  const { env: env2, requestId } = context2;
  if (env2.TELEGRAM_WEBHOOK_SECRET) {
    const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (provided !== env2.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
  }
  const update = await readJson(request);
  if (!update) {
    return jsonSuccess({ ignored: true }, requestId, env2);
  }
  if (update.pre_checkout_query) {
    context2.waitUntil?.(answerPreCheckout(env2, update.pre_checkout_query.id, true));
    return jsonSuccess({ ok: true }, requestId, env2);
  }
  const message = update.message;
  if (!message)
    return jsonSuccess({ ignored: true }, requestId, env2);
  if (message.successful_payment && message.from) {
    const payment = message.successful_payment;
    context2.waitUntil?.(
      handleSuccessfulPayment(env2, message.from.id, payment)
    );
    return jsonSuccess({ ok: true }, requestId, env2);
  }
  const text = (message.text ?? "").trim();
  const from = message.from;
  if (text.startsWith("/start")) {
    const startParam = text.split(" ")[1];
    context2.waitUntil?.(
      handleStart(env2, message.chat.id, from, startParam)
    );
    return jsonSuccess({ ok: true }, requestId, env2);
  }
  if (text.startsWith("/app") || text.startsWith("/store") || text.startsWith("/buy")) {
    defer(context2, sendAppButton(env2, message.chat.id));
    return jsonSuccess({ ok: true }, requestId, env2);
  }
  if (text.startsWith("/help")) {
    defer(context2, sendHelp(env2, message.chat.id));
    return jsonSuccess({ ok: true }, requestId, env2);
  }
  return jsonSuccess({ ignored: true }, requestId, env2);
}
__name(handleTelegramWebhook, "handleTelegramWebhook");
function defer(context2, work) {
  if (context2.waitUntil) {
    context2.waitUntil(work);
  } else {
    void work.catch(() => {
    });
  }
}
__name(defer, "defer");
async function handleStart(env2, chatId, from, startParam) {
  if (!from)
    return;
  try {
    const repo5 = new ContentRepository(new SupabaseClient(env2), env2);
    await repo5.upsertUser({
      telegramId: from.id,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      uiLanguage: normalizeLang(from.language_code),
      languageSource: "TELEGRAM"
    });
  } catch {
  }
  const name = from.first_name;
  const text = [
    `\u0633\u0644\u0627\u0645 ${name} \u{1F44B}`,
    "",
    "\u0645\u0646 \u0645\u0639\u0644\u0645 \u0647\u0648\u0634\u0645\u0646\u062F \u0632\u0628\u0627\u0646 \u062A\u0648 \u0647\u0633\u062A\u0645.",
    "\u062F\u0631\u0633\u200C\u0647\u0627 \u062F\u0642\u06CC\u0642\u0627\u064B \u0628\u0631 \u0627\u0633\u0627\u0633 \u0633\u0631\u0639\u062A \u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC\u060C \u0646\u0642\u0627\u0637 \u0636\u0639\u0641 \u0648 \u0647\u062F\u0641\u062A \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u2014 \u0646\u0647 \u06CC\u06A9 \u0628\u0631\u0646\u0627\u0645\u0647 \u062B\u0627\u0628\u062A \u0628\u0631\u0627\u06CC \u0647\u0645\u0647.",
    "",
    "\u{1F381} \u0647\u0641\u062A\u0647 \u0627\u0648\u0644 \u06A9\u0627\u0645\u0644\u0627\u064B \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0627\u0633\u062A.",
    "",
    "\u0628\u0631\u0627\u06CC \u0634\u0631\u0648\u0639\u060C \u0627\u067E\u0644\u06CC\u06A9\u06CC\u0634\u0646 \u0631\u0627 \u0628\u0627\u0632 \u06A9\u0646:"
  ].join("\n");
  await sendMessage(env2, chatId, text, {
    reply_markup: buildAppKeyboard(env2, startParam)
  });
}
__name(handleStart, "handleStart");
async function sendAppButton(env2, chatId) {
  await sendMessage(env2, chatId, "\u0628\u0631\u0627\u06CC \u0627\u062F\u0627\u0645\u0647\u060C \u0627\u067E\u0644\u06CC\u06A9\u06CC\u0634\u0646 \u0631\u0627 \u0628\u0627\u0632 \u06A9\u0646:", {
    reply_markup: buildAppKeyboard(env2)
  });
}
__name(sendAppButton, "sendAppButton");
async function sendHelp(env2, chatId) {
  const text = [
    "\u{1F4DA} \u0631\u0627\u0647\u0646\u0645\u0627",
    "",
    "/app \u2014 \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0627\u067E\u0644\u06CC\u06A9\u06CC\u0634\u0646 \u0622\u0645\u0648\u0632\u0634\u06CC",
    "/store \u2014 \u062E\u0631\u06CC\u062F \u0627\u0634\u062A\u0631\u0627\u06A9",
    "/help \u2014 \u0647\u0645\u06CC\u0646 \u0631\u0627\u0647\u0646\u0645\u0627",
    "",
    "\u062F\u0631 \u0627\u067E\u0644\u06CC\u06A9\u06CC\u0634\u0646 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC:",
    "\u2022 \u062F\u0631\u0633 \u0631\u0648\u0632\u0627\u0646\u0647\u200C\u0627\u062A \u0631\u0627 \u0628\u0628\u06CC\u0646\u06CC",
    "\u2022 \u067E\u06CC\u0634\u0631\u0641\u062A\u062A \u0631\u0627 \u062F\u0646\u0628\u0627\u0644 \u06A9\u0646\u06CC",
    "\u2022 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0628\u062E\u0631\u06CC",
    "\u2022 \u0632\u0628\u0627\u0646 \u0648 \u0647\u062F\u0641\u062A \u0631\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0647\u06CC"
  ].join("\n");
  await sendMessage(env2, chatId, text);
}
__name(sendHelp, "sendHelp");
async function handleSuccessfulPayment(env2, telegramId, payment) {
  if (!payment)
    return;
  const result = await fulfilStarPayment(env2, {
    telegramChargeId: payment.telegram_payment_charge_id,
    providerChargeId: payment.provider_payment_charge_id,
    totalAmount: payment.total_amount,
    currency: payment.currency,
    invoicePayload: payment.invoice_payload,
    telegramId
  });
  if (result.ok) {
    const expiry = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString("fa-IR") : "\u2014";
    const text = result.duplicate ? "\u2705 \u067E\u0631\u062F\u0627\u062E\u062A \u0634\u0645\u0627 \u0642\u0628\u0644\u0627\u064B \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A." : [
      "\u{1F389} \u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F!",
      "",
      `\u0627\u0634\u062A\u0631\u0627\u06A9 \u0634\u0645\u0627 \u0641\u0639\u0627\u0644 \u0634\u062F \u0648 \u062A\u0627 ${expiry} \u0627\u0639\u062A\u0628\u0627\u0631 \u062F\u0627\u0631\u062F.`,
      "",
      "\u062D\u0627\u0644\u0627 \u0628\u0631\u06AF\u0631\u062F \u0628\u0647 \u0627\u067E\u0644\u06CC\u06A9\u06CC\u0634\u0646 \u0648 \u0627\u062F\u0627\u0645\u0647 \u0628\u062F\u0647 \u{1F680}"
    ].join("\n");
    await sendMessage(env2, telegramId, text, {
      reply_markup: buildAppKeyboard(env2)
    });
  } else {
    await sendMessage(
      env2,
      telegramId,
      "\u26A0\uFE0F \u067E\u0631\u062F\u0627\u062E\u062A \u0634\u0645\u0627 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F \u0627\u0645\u0627 \u062F\u0631 \u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0627\u0634\u062A\u0631\u0627\u06A9 \u0645\u0634\u06A9\u0644\u06CC \u067E\u06CC\u0634 \u0622\u0645\u062F.\n\u0628\u0627 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F. \u0645\u0634\u06A9\u0644 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u062E\u0648\u062F\u06A9\u0627\u0631 \u062B\u0628\u062A \u0634\u062F."
    );
  }
}
__name(handleSuccessfulPayment, "handleSuccessfulPayment");
function buildAppKeyboard(env2, startParam) {
  const base = env2.MINI_APP_URL ?? "";
  const url = startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
  if (!url) {
    return { inline_keyboard: [] };
  }
  return {
    inline_keyboard: [[{ text: "\u{1F393} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0627\u067E\u0644\u06CC\u06A9\u06CC\u0634\u0646", web_app: { url } }]]
  };
}
__name(buildAppKeyboard, "buildAppKeyboard");
async function sendMessage(env2, chatId, text, extra = {}) {
  if (!env2.TELEGRAM_BOT_TOKEN)
    return;
  try {
    await fetch(`https://api.telegram.org/bot${env2.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...extra
      })
    });
  } catch {
  }
}
__name(sendMessage, "sendMessage");
async function answerPreCheckout(env2, queryId, ok, errorMessage) {
  if (!env2.TELEGRAM_BOT_TOKEN)
    return;
  try {
    await fetch(
      `https://api.telegram.org/bot${env2.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pre_checkout_query_id: queryId,
          ok,
          error_message: errorMessage
        })
      }
    );
  } catch {
  }
}
__name(answerPreCheckout, "answerPreCheckout");
function normalizeLang(code) {
  if (!code)
    return "fa";
  const base = code.split("-")[0]?.toLowerCase() ?? "fa";
  return ["fa", "en", "ar", "tr", "ru"].includes(base) ? base : "fa";
}
__name(normalizeLang, "normalizeLang");

// src/routes/admin-bot.ts
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
init_src();
var COMMANDS = [
  ["/gift <telegram_id> <plan> [\u0631\u0648\u0632\u0647\u0627\u06CC \u0627\u0636\u0627\u0641\u0647]", "\u0627\u0647\u062F\u0627\u06CC \u0627\u0634\u062A\u0631\u0627\u06A9"],
  ["/user <telegram_id>", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u0628\u0631"],
  ["/revoke <telegram_id>", "\u0644\u063A\u0648 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0641\u0639\u0627\u0644"],
  ["/stats", "\u0622\u0645\u0627\u0631 \u06A9\u0644\u06CC \u067E\u0644\u062A\u0641\u0631\u0645"],
  ["/plans", "\u0641\u0647\u0631\u0633\u062A \u067E\u0644\u0646\u200C\u0647\u0627 \u0648 \u0642\u06CC\u0645\u062A\u200C\u0647\u0627"],
  ["/help", "\u0631\u0627\u0647\u0646\u0645\u0627"]
];
async function handleAdminWebhook(request, context2) {
  const { env: env2, requestId } = context2;
  const update = await readJson(request);
  if (!update)
    return jsonSuccess({ ignored: true }, requestId, env2);
  const message = update.message;
  if (!message?.from)
    return jsonSuccess({ ignored: true }, requestId, env2);
  const adminId = message.from.id;
  if (!isAdmin(env2, adminId)) {
    await adminSend(env2, message.chat.id, "\u26D4\uFE0F \u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u0646\u062F\u0627\u0631\u06CC\u062F.");
    return jsonSuccess({ denied: true }, requestId, env2);
  }
  const text = (message.text ?? "").trim();
  const [command, ...args] = text.split(/\s+/);
  const repo5 = new ContentRepository(new SupabaseClient(env2), env2);
  context2.waitUntil?.(
    dispatchAdminCommand(env2, repo5, message.chat.id, adminId, command ?? "", args)
  );
  return jsonSuccess({ ok: true }, requestId, env2);
}
__name(handleAdminWebhook, "handleAdminWebhook");
async function dispatchAdminCommand(env2, repo5, chatId, adminId, command, args) {
  switch (command) {
    case "/start":
    case "/help":
      return adminHelp(env2, chatId);
    case "/plans":
      return adminPlans(env2, chatId);
    case "/stats":
      return adminStats(env2, repo5, chatId);
    case "/gift":
      return adminGift(env2, repo5, chatId, adminId, args);
    case "/user":
      return adminUser(env2, repo5, chatId, args);
    case "/revoke":
      return adminRevoke(env2, repo5, chatId, adminId, args);
    default:
      return adminHelp(env2, chatId);
  }
}
__name(dispatchAdminCommand, "dispatchAdminCommand");
async function adminHelp(env2, chatId) {
  const lines = [
    "\u{1F6E0} <b>\u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A</b>",
    "",
    ...COMMANDS.map(([cmd, desc]) => `<code>${escapeHtml(cmd)}</code>
   ${desc}`),
    "",
    "<b>\u067E\u0644\u0646\u200C\u0647\u0627\u06CC \u0645\u0639\u062A\u0628\u0631:</b>",
    PLAN_DEFINITIONS.map(
      (p) => `   <code>${p.planType}</code> \u2014 ${p.titleFa} (${p.durationDays} \u0631\u0648\u0632)`
    ).join("\n"),
    "",
    "\u0645\u062B\u0627\u0644:",
    "<code>/gift 123456789 1_MONTH</code>",
    "<code>/gift 123456789 3_MONTHS 15</code> \u2192 \u06F1\u06F5 \u0631\u0648\u0632 \u0627\u0636\u0627\u0641\u0647"
  ];
  await adminSend(env2, chatId, lines.join("\n"));
}
__name(adminHelp, "adminHelp");
async function adminPlans(env2, chatId) {
  const lines = [
    "\u{1F4B3} <b>\u0641\u0647\u0631\u0633\u062A \u067E\u0644\u0646\u200C\u0647\u0627</b>",
    "",
    ...PLAN_DEFINITIONS.map((p) => {
      const finalIrr = Math.round(p.priceIrr * (1 - p.discountPercent / 100));
      return [
        `<b>${p.titleFa}</b>  <code>${p.planType}</code>`,
        `   ${p.durationDays} \u0631\u0648\u0632`,
        `   ${finalIrr.toLocaleString("fa-IR")} \u062A\u0648\u0645\u0627\u0646  |  ${p.priceStars} \u2B50`
      ].join("\n");
    })
  ];
  await adminSend(env2, chatId, lines.join("\n"));
}
__name(adminPlans, "adminPlans");
async function adminStats(env2, repo5, chatId) {
  try {
    const stats = await repo5.adminStats();
    const text = [
      "\u{1F4CA} <b>\u0622\u0645\u0627\u0631 \u067E\u0644\u062A\u0641\u0631\u0645</b>",
      "",
      `\u06A9\u0644 \u06A9\u0627\u0631\u0628\u0631\u0627\u0646: <b>${stats.totalUsers}</b>`,
      `\u0627\u0634\u062A\u0631\u0627\u06A9 \u0641\u0639\u0627\u0644: <b>${stats.activeSubscriptions}</b>`,
      `\u0631\u0633\u06CC\u062F \u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631: <b>${stats.receiptsPending}</b>`
    ].join("\n");
    await adminSend(env2, chatId, text);
  } catch (err) {
    await adminSend(env2, chatId, `\u274C \u062E\u0637\u0627: ${escapeHtml(String(err))}`);
  }
}
__name(adminStats, "adminStats");
async function adminGift(env2, repo5, chatId, adminId, args) {
  const [rawId, rawPlan, rawExtra] = args;
  const telegramId = Number(rawId);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    await adminSend(env2, chatId, "\u274C \u0634\u0646\u0627\u0633\u0647 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0646\u0627\u0645\u0639\u062A\u0628\u0631.\n\u0645\u062B\u0627\u0644: <code>/gift 123456789 1_MONTH</code>");
    return;
  }
  const planType = normalizePlan(rawPlan);
  if (!planType) {
    await adminSend(
      env2,
      chatId,
      `\u274C \u067E\u0644\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: <code>${escapeHtml(rawPlan ?? "")}</code>
\u067E\u0644\u0646\u200C\u0647\u0627\u06CC \u0645\u0639\u062A\u0628\u0631:
${PLAN_DEFINITIONS.map((p) => `\u2022 <code>${p.planType}</code>`).join("\n")}`
    );
    return;
  }
  const extraDays = Number(rawExtra);
  const bonusDays = Number.isFinite(extraDays) && extraDays > 0 ? Math.trunc(extraDays) : 0;
  const target = await repo5.findUserByTelegramId(telegramId);
  if (!target) {
    await adminSend(
      env2,
      chatId,
      `\u274C \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 <code>${telegramId}</code> \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.
\u06A9\u0627\u0631\u0628\u0631 \u0628\u0627\u06CC\u062F \u0627\u0628\u062A\u062F\u0627 \u0631\u0628\u0627\u062A \u0631\u0627 \u0627\u0633\u062A\u0627\u0631\u062A \u06A9\u0631\u062F\u0647 \u0628\u0627\u0634\u062F.`
    );
    return;
  }
  const admin = await repo5.findUserByTelegramId(adminId);
  const sub = await repo5.createSubscription({
    userId: target.id,
    planType,
    source: "ADMIN_GIFT",
    grantedBy: admin?.id ?? null,
    grantNote: `Gifted via admin bot by ${adminId}`,
    extend: true
  });
  if (bonusDays > 0) {
    const base = new Date(sub.expires_at);
    base.setUTCDate(base.getUTCDate() + bonusDays);
    await repo5["db"].update("subscriptions", { id: sub.id }, {
      expires_at: base.toISOString()
    });
    sub.expires_at = base.toISOString();
  }
  if (admin) {
    await repo5.logAdminGrant({
      adminUserId: admin.id,
      targetUserId: target.id,
      subscriptionId: sub.id,
      action: "GIFT",
      planType,
      daysDelta: (PLAN_DURATION_DAYS[planType] ?? 30) + bonusDays,
      note: "Gifted via admin bot"
    });
  }
  const name = [target.first_name, target.last_name].filter(Boolean).join(" ") || "\u2014";
  const expiry = new Date(sub.expires_at).toLocaleDateString("fa-IR");
  await adminSend(
    env2,
    chatId,
    [
      "\u2705 <b>\u0627\u0634\u062A\u0631\u0627\u06A9 \u0627\u0647\u062F\u0627 \u0634\u062F</b>",
      "",
      `\u06A9\u0627\u0631\u0628\u0631: ${escapeHtml(name)}`,
      `\u0634\u0646\u0627\u0633\u0647: <code>${target.telegram_id}</code>`,
      `\u067E\u0644\u0646: <b>${planType}</b>`,
      bonusDays > 0 ? `\u0631\u0648\u0632 \u0627\u0636\u0627\u0641\u0647: <b>${bonusDays}</b>` : "",
      `\u0627\u0639\u062A\u0628\u0627\u0631 \u062A\u0627: <b>${expiry}</b>`
    ].filter(Boolean).join("\n")
  );
  await notifyGift(env2, target.telegram_id, planType, expiry);
}
__name(adminGift, "adminGift");
async function adminUser(env2, repo5, chatId, args) {
  const telegramId = Number(args[0]);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    await adminSend(env2, chatId, "\u274C \u0645\u062B\u0627\u0644: <code>/user 123456789</code>");
    return;
  }
  const user = await repo5.findUserByTelegramId(telegramId);
  if (!user) {
    await adminSend(env2, chatId, "\u274C \u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    return;
  }
  const [sub, cycle, lexical] = await Promise.all([
    repo5.getActiveSubscription(user.id),
    repo5.getActiveCycle(user.id),
    repo5.getLexicalItems(user.id, user.target_language)
  ]);
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "\u2014";
  await adminSend(
    env2,
    chatId,
    [
      "\u{1F464} <b>\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u0628\u0631</b>",
      "",
      `\u0646\u0627\u0645: ${escapeHtml(name)}`,
      `\u06CC\u0648\u0632\u0631\u0646\u06CC\u0645: ${user.username ? "@" + escapeHtml(user.username) : "\u2014"}`,
      `\u0634\u0646\u0627\u0633\u0647: <code>${user.telegram_id}</code>`,
      "",
      `\u0632\u0628\u0627\u0646 \u0631\u0627\u0628\u0637: <b>${user.ui_language ?? "\u2014"}</b>`,
      `\u0632\u0628\u0627\u0646 \u0647\u062F\u0641: <b>${user.target_language}</b>`,
      `\u0633\u0637\u062D: <b>${user.skill_level}</b>`,
      `\u0647\u062F\u0641: <b>${user.learning_goal ?? "\u2014"}</b>`,
      "",
      `\u0627\u0634\u062A\u0631\u0627\u06A9: <b>${sub ? sub.plan_type : "\u0628\u062F\u0648\u0646 \u0627\u0634\u062A\u0631\u0627\u06A9"}</b>`,
      sub ? `\u0627\u0646\u0642\u0636\u0627: ${new Date(sub.expires_at).toLocaleDateString("fa-IR")}` : "",
      `\u0645\u0646\u0628\u0639: ${sub?.source ?? "\u2014"}`,
      "",
      `\u0627\u0633\u062A\u0631\u06CC\u06A9: \u{1F525} ${user.streak_count} \u0631\u0648\u0632`,
      `\u0627\u0633\u062A\u0627\u0631\u0632: \u2B50 ${user.stars_balance}`,
      `\u0686\u0631\u062E\u0647: ${cycle ? `#${cycle.cycle_number} (${cycle.status})` : "\u2014"}`,
      `\u0648\u0627\u0698\u06AF\u0627\u0646: ${lexical.length} (\u062A\u062B\u0628\u06CC\u062A\u200C\u0634\u062F\u0647: ${lexical.filter((l) => l.mastered).length})`
    ].filter(Boolean).join("\n")
  );
}
__name(adminUser, "adminUser");
async function adminRevoke(env2, repo5, chatId, adminId, args) {
  const telegramId = Number(args[0]);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    await adminSend(env2, chatId, "\u274C \u0645\u062B\u0627\u0644: <code>/revoke 123456789</code>");
    return;
  }
  const target = await repo5.findUserByTelegramId(telegramId);
  if (!target) {
    await adminSend(env2, chatId, "\u274C \u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    return;
  }
  const active = await repo5.getActiveSubscription(target.id);
  if (!active) {
    await adminSend(env2, chatId, "\u274C \u0627\u06CC\u0646 \u06A9\u0627\u0631\u0628\u0631 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0641\u0639\u0627\u0644 \u0646\u062F\u0627\u0631\u062F.");
    return;
  }
  await repo5.expireSubscription(active.id);
  const admin = await repo5.findUserByTelegramId(adminId);
  if (admin) {
    await repo5.logAdminGrant({
      adminUserId: admin.id,
      targetUserId: target.id,
      subscriptionId: active.id,
      action: "REVOKE",
      planType: active.plan_type,
      note: "Revoked via admin bot"
    });
  }
  await adminSend(
    env2,
    chatId,
    `\u2705 \u0627\u0634\u062A\u0631\u0627\u06A9 <code>${telegramId}</code> (${active.plan_type}) \u0644\u063A\u0648 \u0634\u062F.`
  );
}
__name(adminRevoke, "adminRevoke");
function isAdmin(env2, telegramId) {
  const ids = (env2.TELEGRAM_ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  return ids.includes(telegramId);
}
__name(isAdmin, "isAdmin");
function normalizePlan(raw) {
  if (!raw)
    return null;
  const upper = raw.toUpperCase().replace(/[-\s]/g, "_");
  const aliases = {
    "2W": "2_WEEKS",
    "2_WEEK": "2_WEEKS",
    "2_WEEKS": "2_WEEKS",
    "1M": "1_MONTH",
    "1_MONTH": "1_MONTH",
    MONTH: "1_MONTH",
    "3M": "3_MONTHS",
    "3_MONTH": "3_MONTHS",
    "3_MONTHS": "3_MONTHS",
    "6M": "6_MONTHS",
    "6_MONTH": "6_MONTHS",
    "6_MONTHS": "6_MONTHS",
    "1Y": "1_YEAR",
    "1_YEAR": "1_YEAR",
    YEAR: "1_YEAR",
    TRIAL: "TRIAL"
  };
  return aliases[upper] ?? null;
}
__name(normalizePlan, "normalizePlan");
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(escapeHtml, "escapeHtml");
async function adminSend(env2, chatId, text) {
  const token = env2.TELEGRAM_ADMIN_BOT_TOKEN;
  if (!token)
    return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
  } catch {
  }
}
__name(adminSend, "adminSend");
async function notifyGift(env2, telegramId, planType, expiry) {
  if (!env2.TELEGRAM_BOT_TOKEN)
    return;
  const labels = {
    "2_WEEKS": "\u06F2 \u0647\u0641\u062A\u0647\u200C\u0627\u06CC",
    "1_MONTH": "\u06F1 \u0645\u0627\u0647\u0647",
    "3_MONTHS": "\u06F3 \u0645\u0627\u0647\u0647",
    "6_MONTHS": "\u06F6 \u0645\u0627\u0647\u0647",
    "1_YEAR": "\u06F1 \u0633\u0627\u0644\u0647",
    TRIAL: "\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC"
  };
  try {
    await fetch(`https://api.telegram.org/bot${env2.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: [
          "\u{1F381} <b>\u06CC\u06A9 \u0647\u062F\u06CC\u0647 \u0628\u0631\u0627\u06CC \u0634\u0645\u0627!</b>",
          "",
          `\u067E\u0644\u0646 <b>${labels[planType] ?? planType}</b> \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0628\u0647 \u062D\u0633\u0627\u0628 \u0634\u0645\u0627 \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.`,
          `\u0627\u0639\u062A\u0628\u0627\u0631 \u062A\u0627: <b>${expiry}</b>`,
          "",
          "\u0645\u0648\u0641\u0642 \u0628\u0627\u0634\u06CC\u062F! \u{1F680}"
        ].join("\n"),
        parse_mode: "HTML"
      })
    });
  } catch {
  }
}
__name(notifyGift, "notifyGift");

// src/index.ts
var src_default = {
  async fetch(request, rawEnv, ctx) {
    const env2 = withDefaults(rawEnv);
    const requestId = newRequestId();
    const origin = clientOrigin(request);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }
    const url = new URL(request.url);
    const route = resolveRoute(url);
    if (!isKnownPath(url, env2, route.action)) {
      return new Response("Not Found", { status: 404 });
    }
    const baseContext = { env: env2, requestId };
    try {
      const limited = await enforceRateLimit(request, baseContext);
      if (limited)
        return withCors(limited, origin);
      const auth = await authenticate(request, env2, requestId, route.routeClass);
      if (auth.error)
        return withCors(auth.error, origin);
      const context2 = {
        ...auth.context,
        waitUntil: (p) => ctx.waitUntil(p)
      };
      const scanTarget = request.method === "POST" && route.routeClass === "AUTHENTICATED";
      let bodyText = null;
      if (scanTarget) {
        bodyText = await request.clone().text();
        if (bodyText) {
          try {
            const parsed = JSON.parse(bodyText);
            const strict = route.action === "update-profile" || route.action === "onboarding" || route.action === "admin-gift";
            const scan = scanPayloadForInjection(parsed, { strict });
            if (!scan.allowed) {
              return withCors(
                await jsonError(
                  "CONTENT_REJECTED",
                  `Request rejected: ${scan.reason}${scan.detail ? ` (${scan.detail})` : ""}`,
                  requestId,
                  env2,
                  400,
                  "errors.invalid_input"
                ),
                origin
              );
            }
          } catch {
          }
        }
      }
      const response = await dispatch(request, context2, route.action, url, env2, ctx);
      return withCors(response, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${requestId}] Unhandled:`, message, err);
      return withCors(
        await jsonError(
          "INTERNAL_ERROR",
          "An unexpected error occurred",
          requestId,
          env2,
          500,
          "errors.server_error"
        ),
        origin
      );
    }
  }
};
function isKnownPath(url, env2, action) {
  const path = url.pathname.replace(/\/$/, "");
  if (path === env2.GATE_PATH)
    return Boolean(action);
  if (path.endsWith("/telegram/webhook"))
    return true;
  if (path.endsWith("/telegram/admin-webhook"))
    return true;
  if (path.endsWith("/internal/queue"))
    return true;
  if (path === "/ping")
    return true;
  return false;
}
__name(isKnownPath, "isKnownPath");
async function dispatch(request, context2, action, url, env2, ctx) {
  const path = url.pathname.replace(/\/$/, "");
  if (path.endsWith("/telegram/webhook")) {
    return handleTelegramWebhook(request, context2);
  }
  if (path.endsWith("/telegram/admin-webhook")) {
    return handleAdminWebhook(request, context2);
  }
  if (path.endsWith("/internal/queue")) {
    return handleQueueCallback(request, context2, url, env2);
  }
  if (path === "/ping") {
    return new Response(JSON.stringify({ pong: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  switch (action) {
    case "auth":
      return handleAuth(request, context2);
    case "me":
      return handleMe(request, context2);
    case "health":
      return handleHealth(request, context2);
    case "onboarding":
      return handleOnboarding(request, context2);
    case "update-profile":
      return handleUpdateProfile(request, context2);
    case "delete-account":
      return handleDeleteAccount(request, context2);
    case "home":
      return handleHome(request, context2);
    case "get-today-lesson":
      return handleGetTodayLesson(request, context2);
    case "telemetry":
      return handleTelemetry(request, context2);
    case "complete-lesson":
      return handleCompleteLesson(request, context2);
    case "progress":
      return handleProgress(request, context2);
    case "debug-delta":
      return handleDebugDelta(request, context2);
    case "plans":
      return handlePlans(request, context2);
    case "create-invoice":
      return handleCreateInvoice(request, context2);
    case "admin-users":
      return handleAdminUsers(request, context2);
    case "admin-user-detail":
      return handleAdminUserDetail(request, context2);
    case "admin-gift":
      return handleAdminGift(request, context2);
    case "admin-revoke":
      return handleAdminRevoke(request, context2);
    case "admin-stats":
      return handleAdminStats(request, context2);
    case "admin-ai-providers":
      return handleAdminListProviders(request, context2);
    case "admin-ai-provider-create":
      return handleAdminCreateProvider(request, context2);
    case "admin-ai-provider-update":
      return handleAdminUpdateProvider(request, context2);
    case "admin-ai-provider-delete":
      return handleAdminDeleteProvider(request, context2);
    case "admin-ai-provider-reorder":
      return handleAdminReorderProviders(request, context2);
    case "admin-ai-provider-test":
      return handleAdminTestProvider(request, context2);
    default:
      return jsonError("NOT_FOUND", `Unknown action`, context2.requestId, env2, 404);
  }
}
__name(dispatch, "dispatch");
async function handleQueueCallback(request, context2, url, env2) {
  const kind = url.searchParams.get("internal");
  if (kind !== "generate-cycle") {
    return jsonError("NOT_FOUND", "Unknown job kind", context2.requestId, env2, 404);
  }
  const body = await request.json().catch(() => null);
  if (!body?.userId || typeof body.cycleNumber !== "number") {
    return jsonError("VALIDATION_ERROR", "userId and cycleNumber required", context2.requestId, env2, 400);
  }
  const result = await runCycleGeneration(env2, body.userId, body.cycleNumber);
  if (!result.ok) {
    return jsonError(
      "AI_UNAVAILABLE",
      result.error ?? "Cycle generation failed",
      context2.requestId,
      env2,
      500
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleQueueCallback, "handleQueueCallback");
function withCors(response, origin) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withCors, "withCors");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
