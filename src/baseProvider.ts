import {
  createIdRemapMiddleware,
  createStreamMiddleware,
  getRpcPromiseCallback,
  JRPCEngine,
  JRPCRequest,
  JRPCResponse,
  ObjectMultiplex,
  SafeEventEmitter,
  Stream,
} from "@toruslabs/openlogin-jrpc";
import { ethErrors } from "eth-rpc-errors";
import { isDuplexStream } from "is-stream";
import pump from "pump";
import type { Duplex } from "readable-stream";

import { BaseProviderState, Maybe, ProviderOptions, RequestArguments, UnValidatedJsonRpcRequest } from "./interfaces";
import messages from "./messages";
import { createErrorMiddleware, logStreamDisconnectWarning } from "./utils";

/**
 * @param {Object} connectionStream - A Node.js duplex stream
 * @param {Object} opts - An options bag
 * @param {number} opts.maxEventListeners - The maximum number of event listeners
 */
abstract class BaseProvider<U extends BaseProviderState> extends SafeEventEmitter {
  protected _state: U;

  _rpcEngine: JRPCEngine;

  jsonRpcConnectionEvents: SafeEventEmitter;

  /**
   * Indicating that this provider is a Torus provider.
   */
  public readonly isTorus: true;

  constructor(connectionStream: Duplex, { maxEventListeners = 100, jsonRpcStreamName = "provider" }: ProviderOptions) {
    super();
    if (!isDuplexStream(connectionStream)) {
      throw new Error(messages.errors.invalidDuplexStream());
    }
    this.isTorus = true;
    this.setMaxListeners(maxEventListeners);

    // bind functions (to prevent e.g. web3@1.x from making unbound calls)
    this._handleConnect = this._handleConnect.bind(this);
    this._handleDisconnect = this._handleDisconnect.bind(this);
    this._handleStreamDisconnect = this._handleStreamDisconnect.bind(this);

    this._rpcRequest = this._rpcRequest.bind(this);
    this._initializeState = this._initializeState.bind(this);

    this.request = this.request.bind(this);
    this.sendAsync = this.sendAsync.bind(this);
    // this.enable = this.enable.bind(this);

    // setup connectionStream multiplexing
    const mux = new ObjectMultiplex();
    pump(
      connectionStream as unknown as Stream,
      mux as unknown as Stream,
      connectionStream as unknown as Stream,
      this._handleStreamDisconnect.bind(this, "Torus")
    );

    // ignore phishing warning message (handled elsewhere)
    mux.ignoreStream("phishing");

    // setup own event listeners
    // connect to async provider

    const jsonRpcConnection = createStreamMiddleware();
    pump(
      jsonRpcConnection.stream as unknown as Stream,
      mux.createStream(jsonRpcStreamName) as unknown as Stream,
      jsonRpcConnection.stream as unknown as Stream,
      this._handleStreamDisconnect.bind(this, "Torus RpcProvider")
    );

    // handle RPC requests via dapp-side rpc engine
    const rpcEngine = new JRPCEngine();
    rpcEngine.push(createIdRemapMiddleware());
    rpcEngine.push(createErrorMiddleware());
    rpcEngine.push(jsonRpcConnection.middleware);
    this._rpcEngine = rpcEngine;

    this.jsonRpcConnectionEvents = jsonRpcConnection.events;
  }

  /**
   * Submits an RPC request for the given method, with the given params.
   * Resolves with the result of the method call, or rejects on error.
   *
   * @param {Object} args - The RPC request arguments.
   * @param {string} args.method - The RPC method name.
   * @param {unknown[] | Object} [args.params] - The parameters for the RPC method.
   * @returns {Promise<unknown>} A Promise that resolves with the result of the RPC method,
   * or rejects if an error is encountered.
   */
  async request<T>(args: RequestArguments): Promise<Maybe<T>> {
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestArgs(),
        data: args,
      });
    }

    const { method, params } = args;

    if (typeof method !== "string" || method.length === 0) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestMethod(),
        data: args,
      });
    }

    if (params !== undefined && !Array.isArray(params) && (typeof params !== "object" || params === null)) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestParams(),
        data: args,
      });
    }

    return new Promise((resolve, reject) => {
      this._rpcRequest({ method, params }, getRpcPromiseCallback(resolve, reject));
    });
  }

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   *
   * @param {Object} payload - The RPC request object.
   * @param {Function} cb - The callback function.
   */
  sendAsync(payload: JRPCRequest<unknown>, callback: (error: Error | null, result?: JRPCResponse<unknown>) => void): void {
    this._rpcRequest(payload, callback);
  }

  // Private Methods
  //= ===================
  /**
   * Constructor helper.
   * Populates initial state by calling 'wallet_getProviderState' and emits
   * necessary events.
   */
  abstract _initializeState(...args: any[]): Promise<void>;

  /**
   * Internal RPC method. Forwards requests to background via the RPC engine.
   * Also remap ids inbound and outbound
   */
  protected abstract _rpcRequest(
    payload: UnValidatedJsonRpcRequest | UnValidatedJsonRpcRequest[],
    callback: (...args: any[]) => void,
    isInternal?: boolean
  ): void;

  /**
   * When the provider becomes connected, updates internal state and emits
   * required events. Idempotent.
   *
   * @param chainId - The ID of the newly connected chain.
   * @emits TorusInPageProvider#connect
   */
  protected abstract _handleConnect(...args: any[]): void;

  /**
   * When the provider becomes disconnected, updates internal state and emits
   * required events. Idempotent with respect to the isRecoverable parameter.
   *
   * Error codes per the CloseEvent status codes as required by EIP-1193:
   * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
   *
   * @param isRecoverable - Whether the disconnection is recoverable.
   * @param errorMessage - A custom error message.
   * @emits TorusInpageProvider#disconnect
   */
  protected abstract _handleDisconnect(isRecoverable: boolean, errorMessage?: string): void;

  /**
   * Called when connection is lost to critical streams.
   *
   * @emits TorusInpageProvider#disconnect
   */
  protected _handleStreamDisconnect(streamName: string, error: Error): void {
    logStreamDisconnectWarning(streamName, error, this);
    this._handleDisconnect(false, error ? error.message : undefined);
  }
}

export default BaseProvider;
